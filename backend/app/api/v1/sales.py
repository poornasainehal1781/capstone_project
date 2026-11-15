import uuid
import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.customer import Customer
from app.models.stock_movement import StockMovement
from app.models.batch import ProductBatch
from app.schemas.sale import SaleCreate, SaleResponse, SaleItemResponse
from app.api.deps import get_current_user, get_current_cashier, get_current_manager
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter()

def generate_unique_invoice_number(db: Session) -> str:
    today_str = datetime.datetime.now().strftime("%Y%m%d")
    for _ in range(10):
        suffix = uuid.uuid4().hex[:5].upper()
        inv_no = f"INV-{today_str}-{suffix}"
        if not db.query(Sale).filter(Sale.invoice_number == inv_no).first():
            return inv_no
    # Fallback timestamp
    return f"INV-{today_str}-{int(datetime.datetime.now().timestamp() * 1000) % 100000}"

def format_sale_response(sale: Sale) -> SaleResponse:
    items_formatted = []
    for it in sale.items:
        items_formatted.append(
            SaleItemResponse(
                id=it.id,
                sale_id=it.sale_id,
                product_id=it.product_id,
                product_name=it.product.name if it.product else f"Product #{it.product_id}",
                product_barcode=it.product.barcode if it.product else None,
                product_sku=it.product.sku if it.product else None,
                batch_number=it.batch_number,
                quantity=it.quantity,
                unit_price=it.unit_price,
                tax_rate=it.tax_rate,
                tax_amount=it.tax_amount,
                discount=it.discount,
                line_total=it.line_total,
            )
        )

    return SaleResponse(
        id=sale.id,
        invoice_number=sale.invoice_number,
        customer_id=sale.customer_id,
        customer_name=sale.customer.name if sale.customer else None,
        customer_phone=sale.customer.phone if sale.customer else None,
        cashier_id=sale.cashier_id,
        cashier_name=sale.cashier.full_name if sale.cashier else f"User #{sale.cashier_id}",
        subtotal=sale.subtotal,
        tax_amount=sale.tax_amount,
        discount_amount=sale.discount_amount,
        grand_total=sale.grand_total,
        payment_method=sale.payment_method,
        status=sale.status,
        idempotency_key=getattr(sale, "idempotency_key", None),
        notes=getattr(sale, "notes", None),
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        items=items_formatted
    )

@router.post(
    "",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Checkout POS Cart & Generate Tax Invoice [CASHIER / MANAGER / ADMIN]",
    description=(
        "Executes atomic supermarket checkout in a single database transaction:\n"
        "1. Validates real-time stock levels.\n"
        "2. Prevents overselling (rejects if cart quantity exceeds current stock).\n"
        "3. Accurately calculates GST tax amounts, discounts, and payable total.\n"
        "4. Generates unique Tax Invoice sequence number.\n"
        "5. Deducts inventory and logs immutable StockMovement audit records.\n"
        "6. Updates customer loyalty balance.\n"
        "7. Idempotency protection prevents double billing."
    )
)
def checkout_sale(
    req: SaleCreate,
    db: Session = Depends(get_db),
    cashier = Depends(get_current_cashier)
):
    # 1. Idempotency Check (prevent accidental double submission)
    if req.idempotency_key and req.idempotency_key.strip():
        existing_sale = db.query(Sale).filter(Sale.idempotency_key == req.idempotency_key.strip()).first()
        if existing_sale:
            return format_sale_response(existing_sale)

    # 2. Resolve Customer (if provided)
    customer = None
    if req.customer_id:
        customer = db.query(Customer).filter(Customer.id == req.customer_id).first()
    elif req.customer_phone and req.customer_phone.strip():
        clean_phone = req.customer_phone.strip()
        customer = db.query(Customer).filter(Customer.phone == clean_phone).first()
        if not customer and req.customer_name and req.customer_name.strip():
            # Auto-register guest customer profile
            customer = Customer(
                name=req.customer_name.strip(),
                phone=clean_phone,
                loyalty_points=0,
                tier="Silver"
            )
            db.add(customer)
            db.flush()

    # 3. Validate Cart & Calculate Pricing in a strictly atomic transaction
    prepared_items = []
    total_subtotal = Decimal("0.00")
    total_tax = Decimal("0.00")
    line_discount_sum = Decimal("0.00")

    try:
        for item_in in req.items:
            # Lock product record for update to prevent race conditions
            product = db.query(Product).filter(Product.id == item_in.product_id).with_for_update().first()
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {item_in.product_id} not found in catalog."
                )

            # Prevent billing more items than available stock
            if product.current_stock < item_in.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for '{product.name}'. "
                        f"Current stock available: {product.current_stock} {product.unit}, "
                        f"requested: {item_in.quantity}."
                    )
                )

            # Expiry & FEFO Batch Validation
            today = datetime.date.today()
            assigned_batch_num = item_in.batch_number.strip() if item_in.batch_number else None
            batch_obj = None

            if assigned_batch_num:
                batch_obj = db.query(ProductBatch).filter(
                    ProductBatch.product_id == product.id,
                    ProductBatch.batch_number == assigned_batch_num
                ).first()
                if batch_obj and batch_obj.expiry_date < today:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Strict Food Safety Violation: Product '{product.name}' (Batch '{batch_obj.batch_number}') "
                            f"expired on {batch_obj.expiry_date.strftime('%Y-%m-%d')}. Expired stock cannot be sold."
                        )
                    )
            elif product.is_perishable:
                # FEFO: Automatically pick earliest unexpired active batch
                batch_obj = (
                    db.query(ProductBatch)
                    .filter(
                        ProductBatch.product_id == product.id,
                        ProductBatch.is_active == True,
                        ProductBatch.current_quantity > 0,
                        ProductBatch.expiry_date >= today
                    )
                    .order_by(ProductBatch.expiry_date.asc())
                    .first()
                )
                if not batch_obj:
                    # If all batches are expired, block sale on safety grounds
                    any_expired = (
                        db.query(ProductBatch)
                        .filter(
                            ProductBatch.product_id == product.id,
                            ProductBatch.is_active == True,
                            ProductBatch.current_quantity > 0
                        )
                        .first()
                    )
                    if any_expired:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                f"Food Safety Block: All remaining batches for '{product.name}' have expired. "
                                f"Please discard expired stock and inward fresh inventory."
                            )
                        )
                else:
                    assigned_batch_num = batch_obj.batch_number

            unit_price = Decimal(str(item_in.unit_price)) if item_in.unit_price is not None else product.selling_price
            tax_rate = Decimal(str(item_in.tax_rate)) if item_in.tax_rate is not None else product.tax_rate
            discount = Decimal(str(item_in.discount)) if item_in.discount is not None else Decimal("0.00")

            line_gross = round(Decimal(item_in.quantity) * unit_price, 2)
            line_taxable = max(Decimal("0.00"), line_gross - discount)
            line_tax = round(line_taxable * (tax_rate / Decimal("100.00")), 2)
            line_total = line_taxable + line_tax

            total_subtotal += line_gross
            total_tax += line_tax
            line_discount_sum += discount

            prepared_items.append({
                "product": product,
                "quantity": item_in.quantity,
                "unit_price": unit_price,
                "tax_rate": tax_rate,
                "tax_amount": line_tax,
                "discount": discount,
                "line_total": line_total,
                "batch_number": assigned_batch_num or f"BATCH-{product.id}",
                "batch_obj": batch_obj
            })

        overall_discount = round(Decimal(str(req.discount_amount)) + line_discount_sum, 2)
        grand_total = max(Decimal("0.00"), total_subtotal + total_tax - Decimal(str(req.discount_amount)))

        # 4. Generate unique invoice number
        invoice_number = generate_unique_invoice_number(db)

        # 5. Create Sale
        new_sale = Sale(
            invoice_number=invoice_number,
            customer_id=customer.id if customer else None,
            cashier_id=cashier.id,
            subtotal=total_subtotal,
            tax_amount=total_tax,
            discount_amount=overall_discount,
            grand_total=grand_total,
            payment_method=req.payment_method.upper(),
            status="COMPLETED",
            idempotency_key=req.idempotency_key.strip() if req.idempotency_key else None,
            notes=req.notes.strip() if req.notes else None
        )
        db.add(new_sale)
        db.flush()  # Populates new_sale.id

        # 6. Create Sale Items and Reduce Stock with StockMovements
        for item_data in prepared_items:
            prod = item_data["product"]
            qty = item_data["quantity"]

            sale_item = SaleItem(
                sale_id=new_sale.id,
                product_id=prod.id,
                batch_number=item_data["batch_number"],
                quantity=qty,
                unit_price=item_data["unit_price"],
                tax_rate=item_data["tax_rate"],
                tax_amount=item_data["tax_amount"],
                discount=item_data["discount"],
                line_total=item_data["line_total"]
            )
            db.add(sale_item)

            # Deduct stock
            prod.current_stock -= qty
            if item_data.get("batch_obj"):
                b_obj = item_data["batch_obj"]
                b_obj.current_quantity = max(0, b_obj.current_quantity - qty)

            # Create immutable StockMovement audit record
            stock_move = StockMovement(
                product_id=prod.id,
                batch_number=item_data["batch_number"],
                movement_type="POS_SALE",
                quantity=-qty,
                unit_cost=prod.cost_price,
                reference_id=invoice_number,
                notes=f"POS Sale Checkout #{invoice_number} by cashier '{cashier.username}'."
            )
            db.add(stock_move)

        # 7. Customer Loyalty Points Calculation (1 pt per ₹100 spent)
        if customer:
            earned_points = int(grand_total // 100)
            customer.loyalty_points += earned_points

        # 8. Single Atomic Transaction Commit
        db.commit()
        db.refresh(new_sale)

        return format_sale_response(new_sale)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transaction failed during checkout: {str(exc)}"
        )

@router.get(
    "",
    response_model=List[SaleResponse],
    summary="List POS Sales [CASHIER / MANAGER / ADMIN]",
    description="Cashiers view their own sales; Managers and Admins can view all sales."
)
def list_sales(
    search: Optional[str] = Query(None, description="Search by invoice number or customer phone"),
    status_filter: Optional[str] = Query(None, alias="status"),
    payment_method: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Sale)

    # Cashier restriction: can view their own transactions
    if current_user.role == "CASHIER":
        query = query.filter(Sale.cashier_id == current_user.id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(Sale.invoice_number.ilike(term))

    if status_filter:
        query = query.filter(Sale.status == status_filter.upper())

    if payment_method:
        query = query.filter(Sale.payment_method == payment_method.upper())

    sales = query.order_by(Sale.created_at.desc()).offset(skip).limit(limit).all()
    return [format_sale_response(s) for s in sales]

@router.get(
    "/{sale_id}",
    response_model=SaleResponse,
    summary="Get Sale Details by ID"
)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale with ID {sale_id} not found."
        )

    # Cashier permission check
    if current_user.role == "CASHIER" and sale.cashier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cashiers may only view their own sales records."
        )

    return format_sale_response(sale)

@router.get(
    "/{sale_id}/pdf",
    summary="Download Printable Tax Invoice PDF",
    description="Generates a downloadable PDF thermal receipt/invoice."
)
def download_invoice_pdf(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale with ID {sale_id} not found."
        )

    if current_user.role == "CASHIER" and sale.cashier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cashiers may only generate invoices for their own transactions."
        )

    pdf_bytes = generate_invoice_pdf(sale)
    filename = f"Invoice_{sale.invoice_number}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={filename}"
        }
    )

@router.post(
    "/{sale_id}/cancel",
    response_model=SaleResponse,
    summary="Cancel Sale & Restore Stock [MANAGER / ADMIN ONLY]",
    description="Authorized cancellation: restores product stock and logs reversing StockMovement ledger."
)
def cancel_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale with ID {sale_id} not found."
        )

    if sale.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sale '{sale.invoice_number}' is already cancelled."
        )

    try:
        # Mark as CANCELLED
        sale.status = "CANCELLED"

        # Restore stock and write reversing stock movements
        for item in sale.items:
            product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
            if product:
                product.current_stock += item.quantity

                if item.batch_number:
                    batch_record = db.query(ProductBatch).filter(
                        ProductBatch.product_id == product.id,
                        ProductBatch.batch_number == item.batch_number
                    ).first()
                    if batch_record:
                        batch_record.current_quantity += item.quantity

                compensating_movement = StockMovement(
                    product_id=product.id,
                    batch_number=item.batch_number,
                    movement_type="CUSTOMER_RETURN",
                    quantity=item.quantity,  # Positive: restores stock
                    unit_cost=product.cost_price,
                    reference_id=f"CANCEL-{sale.invoice_number}",
                    notes=f"Reversal for cancelled sale #{sale.invoice_number} authorized by {manager.username}."
                )
                db.add(compensating_movement)

        # Deduct loyalty points if applicable
        if sale.customer:
            points_to_revert = int(sale.grand_total // 100)
            sale.customer.loyalty_points = max(0, sale.customer.loyalty_points - points_to_revert)

        db.commit()
        db.refresh(sale)
        return format_sale_response(sale)

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel sale: {str(exc)}"
        )
