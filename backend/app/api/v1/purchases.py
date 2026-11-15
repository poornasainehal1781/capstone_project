import datetime
import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier import Supplier
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.models.user import User
from app.schemas.purchase import PurchaseCreate, PurchaseResponse, PurchaseItemResponse
from app.api.deps import get_current_user, get_current_manager, get_current_admin

router = APIRouter(prefix="/purchases", tags=["Purchase Orders & Procurement"])

class DetailedPurchaseItem(BaseModel):
    id: int
    product_id: int
    product_name: str
    barcode: str
    quantity: int
    unit_cost: Decimal
    subtotal: Decimal

class DetailedPurchaseResponse(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    supplier_name: str
    created_by_user_id: int
    created_by_name: str
    total_amount: Decimal
    status: str
    expected_delivery_date: Optional[datetime.date] = None
    created_at: datetime.datetime
    items: List[DetailedPurchaseItem] = []

def format_detailed_purchase(po: Purchase) -> DetailedPurchaseResponse:
    return DetailedPurchaseResponse(
        id=po.id,
        po_number=po.po_number,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name if po.supplier else "Unknown",
        created_by_user_id=po.created_by_user_id,
        created_by_name=po.creator.full_name if po.creator else "System",
        total_amount=po.total_amount,
        status=po.status,
        expected_delivery_date=po.expected_delivery_date,
        created_at=po.created_at,
        items=[
            DetailedPurchaseItem(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else f"Product #{item.product_id}",
                barcode=item.product.barcode if item.product else "N/A",
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                subtotal=item.subtotal
            )
            for item in po.items
        ]
    )

@router.get(
    "",
    response_model=List[DetailedPurchaseResponse],
    summary="List Purchase Orders [MANAGER / ADMIN]"
)
def list_purchases(
    status_filter: Optional[str] = Query(None, description="Filter by status: DRAFT, CONFIRMED, IN_TRANSIT, RECEIVED, CANCELLED"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    query = db.query(Purchase).order_by(Purchase.created_at.desc())
    if status_filter:
        query = query.filter(Purchase.status == status_filter.upper())
    pos = query.limit(limit).all()
    return [format_detailed_purchase(po) for po in pos]

@router.get(
    "/{purchase_id}",
    response_model=DetailedPurchaseResponse,
    summary="Get Purchase Order by ID"
)
def get_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    po = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase Order #{purchase_id} not found.")
    return format_detailed_purchase(po)

@router.post(
    "",
    response_model=DetailedPurchaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Purchase Order [MANAGER / ADMIN]"
)
def create_purchase(
    req: PurchaseCreate,
    receive_immediately: bool = Query(False, description="Whether to immediately inward inventory as RECEIVED"),
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager)
):
    supplier = db.query(Supplier).filter(Supplier.id == req.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Supplier ID {req.supplier_id} not found.")

    po_num = req.po_number or f"PO-{datetime.date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    # Calculate total
    total_val = Decimal("0.00")
    line_items = []
    for item_data in req.items:
        prod = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product ID {item_data.product_id} not found.")
        sub = Decimal(item_data.quantity) * Decimal(str(item_data.unit_cost))
        total_val += sub
        line_items.append((prod, item_data.quantity, item_data.unit_cost, sub))

    init_status = "RECEIVED" if receive_immediately else "CONFIRMED"

    new_po = Purchase(
        po_number=po_num,
        supplier_id=supplier.id,
        created_by_user_id=manager.id,
        total_amount=total_val,
        status=init_status,
        expected_delivery_date=req.expected_delivery_date
    )
    db.add(new_po)
    db.flush()  # assign new_po.id

    for prod, qty, cost, sub in line_items:
        po_item = PurchaseItem(
            purchase_id=new_po.id,
            product_id=prod.id,
            quantity=qty,
            unit_cost=cost,
            subtotal=sub
        )
        db.add(po_item)

        # If receiving immediately, update stock and movement ledger
        if receive_immediately:
            prod.current_stock += qty
            movement = StockMovement(
                product_id=prod.id,
                movement_type="PURCHASE_RECEIPT",
                quantity=qty,
                reference_id=new_po.po_number,
                notes=f"Goods Receipt Note for PO {new_po.po_number} from {supplier.name}"
            )
            db.add(movement)

    db.commit()
    db.refresh(new_po)
    return format_detailed_purchase(new_po)

@router.post(
    "/{purchase_id}/receive",
    response_model=DetailedPurchaseResponse,
    summary="Record Goods Receipt Note & Inward Stock [MANAGER / ADMIN]",
    description="Marks PO as RECEIVED, increments product stock, and records StockMovement ledger entry in a single transaction."
)
def receive_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager)
):
    po = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase Order #{purchase_id} not found.")

    if po.status == "RECEIVED":
        raise HTTPException(status_code=400, detail=f"Purchase Order '{po.po_number}' has already been received.")

    if po.status == "CANCELLED":
        raise HTTPException(status_code=400, detail=f"Cannot receive cancelled Purchase Order '{po.po_number}'.")

    # Inward each item
    for item in po.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.current_stock += item.quantity
            movement = StockMovement(
                product_id=product.id,
                movement_type="PURCHASE_RECEIPT",
                quantity=item.quantity,
                reference_id=po.po_number,
                notes=f"Goods Receipt Note for PO {po.po_number} from {po.supplier.name if po.supplier else 'Supplier'}"
            )
            db.add(movement)

    po.status = "RECEIVED"
    db.commit()
    db.refresh(po)
    return format_detailed_purchase(po)

@router.post(
    "/{purchase_id}/cancel",
    response_model=DetailedPurchaseResponse,
    summary="Cancel Purchase Order [MANAGER / ADMIN]"
)
def cancel_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager)
):
    po = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase Order #{purchase_id} not found.")

    if po.status == "RECEIVED":
        raise HTTPException(status_code=400, detail=f"Cannot cancel PO '{po.po_number}' because goods have already been received and inwarded.")

    po.status = "CANCELLED"
    db.commit()
    db.refresh(po)
    return format_detailed_purchase(po)

