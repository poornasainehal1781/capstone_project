import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.product import Product
from app.models.category import Category
from app.models.stock_movement import StockMovement
from app.models.batch import ProductBatch
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    StockAdjustmentRequest,
    StockAdjustmentResponse,
    BatchInwardRequest,
    BatchItemResponse
)
from app.api.deps import get_current_user, get_current_manager, get_current_admin

router = APIRouter()

def format_product_response(p: Product) -> ProductResponse:
    return ProductResponse(
        id=p.id,
        barcode=p.barcode,
        sku=p.sku,
        name=p.name,
        description=p.description,
        category_id=p.category_id,
        category_name=p.category.name if p.category else None,
        category_code=p.category.code if p.category else None,
        unit=p.unit,
        cost_price=p.cost_price,
        selling_price=p.selling_price,
        tax_rate=p.tax_rate,
        current_stock=p.current_stock,
        min_stock_level=p.min_stock_level,
        is_perishable=p.is_perishable,
        created_at=p.created_at,
        updated_at=p.updated_at
    )

@router.get(
    "",
    response_model=List[ProductResponse],
    summary="List Master SKU Products",
    description="Search, filter by category or low stock, and paginate product catalog."
)
def list_products(
    search: Optional[str] = Query(None, description="Search by name, barcode, or SKU"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    low_stock: Optional[bool] = Query(False, description="Filter items below or equal to min stock level"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Product).join(Product.category)

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_filter),
                Product.barcode.ilike(search_filter),
                Product.sku.ilike(search_filter)
            )
        )

    if category_id:
        query = query.filter(Product.category_id == category_id)

    if low_stock:
        query = query.filter(Product.current_stock <= Product.min_stock_level)

    products = query.order_by(Product.name.asc()).offset(skip).limit(limit).all()
    return [format_product_response(p) for p in products]

@router.get(
    "/barcode/{barcode}",
    response_model=ProductResponse,
    summary="Fast Barcode Lookup for POS Terminal",
    description="High-speed O(1) indexed barcode lookup."
)
def get_product_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.barcode == barcode.strip()).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode '{barcode}' not found in catalog."
        )
    return format_product_response(product)

@router.get(
    "/batches",
    response_model=List[BatchItemResponse],
    summary="List All Active Product Batches (FEFO Shelf-Life)",
    description="Returns product lots sorted by expiry date for FEFO compliance and shelf monitoring."
)
def list_batches(
    product_id: Optional[int] = Query(None, description="Filter by product ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    today = datetime.date.today()
    query = db.query(ProductBatch).join(ProductBatch.product).join(Product.category)
    if product_id:
        query = query.filter(ProductBatch.product_id == product_id)

    batches = query.order_by(ProductBatch.expiry_date.asc()).all()

    result = []
    for b in batches:
        days_left = (b.expiry_date - today).days
        if days_left < 0:
            batch_status = "EXPIRED"
        elif days_left <= 7:
            batch_status = "CRITICAL"
        elif days_left <= 15:
            batch_status = "WARNING"
        elif days_left <= 30:
            batch_status = "ATTENTION"
        else:
            batch_status = "OPTIMAL"

        result.append(
            BatchItemResponse(
                id=b.id,
                product_id=b.product_id,
                product_name=b.product.name if b.product else f"Product #{b.product_id}",
                barcode=b.product.barcode if b.product else "N/A",
                category_name=b.product.category.name if b.product and b.product.category else "General",
                batch_number=b.batch_number,
                mfg_date=b.mfg_date.strftime("%Y-%m-%d"),
                expiry_date=b.expiry_date.strftime("%Y-%m-%d"),
                days_to_expiry=days_left,
                initial_quantity=b.initial_quantity,
                current_quantity=b.current_quantity,
                unit_cost=b.unit_cost,
                is_active=b.is_active,
                status=batch_status
            )
        )
    return result

@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get Product by ID"
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return format_product_response(product)

@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Product [MANAGER / ADMIN]",
    description="Registers product SKU. Prevents duplicate barcodes and SKUs."
)
def create_product(
    req: ProductCreate,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    # 1. Prevent duplicate barcode
    existing_barcode = db.query(Product).filter(Product.barcode == req.barcode.strip()).first()
    if existing_barcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A product with barcode '{req.barcode}' already exists: '{existing_barcode.name}'."
        )

    # 2. Prevent duplicate SKU if provided
    if req.sku and req.sku.strip():
        existing_sku = db.query(Product).filter(Product.sku == req.sku.strip()).first()
        if existing_sku:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A product with SKU '{req.sku}' already exists: '{existing_sku.name}'."
            )

    # 3. Validate category exists
    cat = db.query(Category).filter(Category.id == req.category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with ID {req.category_id} does not exist."
        )

    new_prod = Product(
        barcode=req.barcode.strip(),
        sku=req.sku.strip() if req.sku else None,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        category_id=req.category_id,
        unit=req.unit.strip(),
        cost_price=req.cost_price,
        selling_price=req.selling_price,
        tax_rate=req.tax_rate,
        current_stock=req.initial_stock,
        min_stock_level=req.min_stock_level,
        is_perishable=req.is_perishable
    )

    db.add(new_prod)
    db.flush()  # Populates new_prod.id

    # If opening stock was supplied, record initial StockMovement
    if req.initial_stock > 0:
        movement = StockMovement(
            product_id=new_prod.id,
            batch_number=req.initial_batch_number or f"INIT-{new_prod.id}",
            movement_type="INWARD_GRN",
            quantity=req.initial_stock,
            unit_cost=req.cost_price,
            reference_id="OPENING_STOCK",
            notes="Opening stock balance registered at SKU creation."
        )
        db.add(movement)

    db.commit()
    db.refresh(new_prod)
    return format_product_response(new_prod)

@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update Product [MANAGER / ADMIN]"
)
def update_product(
    product_id: int,
    req: ProductUpdate,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    # Check barcode conflicts
    if req.barcode and req.barcode.strip() != prod.barcode:
        existing_barcode = db.query(Product).filter(
            Product.barcode == req.barcode.strip(),
            Product.id != product_id
        ).first()
        if existing_barcode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Barcode '{req.barcode}' is already in use by product '{existing_barcode.name}'."
            )
        prod.barcode = req.barcode.strip()

    # Check SKU conflicts
    if req.sku and req.sku.strip() != prod.sku:
        existing_sku = db.query(Product).filter(
            Product.sku == req.sku.strip(),
            Product.id != product_id
        ).first()
        if existing_sku:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SKU '{req.sku}' is already in use by product '{existing_sku.name}'."
            )
        prod.sku = req.sku.strip()

    # Check category existence if changing
    if req.category_id and req.category_id != prod.category_id:
        cat = db.query(Category).filter(Category.id == req.category_id).first()
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with ID {req.category_id} does not exist."
            )
        prod.category_id = req.category_id

    if req.name:
        prod.name = req.name.strip()
    if req.description is not None:
        prod.description = req.description.strip() if req.description else None
    if req.unit:
        prod.unit = req.unit.strip()
    if req.cost_price is not None:
        prod.cost_price = req.cost_price
    if req.selling_price is not None:
        prod.selling_price = req.selling_price
    if req.tax_rate is not None:
        prod.tax_rate = req.tax_rate
    if req.min_stock_level is not None:
        prod.min_stock_level = req.min_stock_level
    if req.is_perishable is not None:
        prod.is_perishable = req.is_perishable

    db.commit()
    db.refresh(prod)
    return format_product_response(prod)

@router.delete(
    "/{product_id}",
    summary="Delete Product [ADMIN ONLY]"
)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    # Check if product is in use by sales or purchase orders
    from app.models.sale import SaleItem
    from app.models.purchase import PurchaseItem

    has_sales = db.query(SaleItem).filter(SaleItem.product_id == product_id).first()
    has_purchases = db.query(PurchaseItem).filter(PurchaseItem.product_id == product_id).first()

    if has_sales or has_purchases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete product '{prod.name}' because transaction records (sales or purchases) exist for this SKU."
        )

    db.delete(prod)
    db.commit()
    return {
        "status": "success",
        "message": f"Product '{prod.name}' (ID: {product_id}) successfully deleted."
    }

@router.post(
    "/{product_id}/adjust-stock",
    response_model=StockAdjustmentResponse,
    summary="Adjust Product Stock Level [MANAGER / ADMIN]",
    description="Records manual stock discrepancy adjustments or write-offs and logs immutable StockMovement audit entry."
)
def adjust_stock(
    product_id: int,
    req: StockAdjustmentRequest,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    prod = db.query(Product).filter(Product.id == product_id).with_for_update().first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    prev_stock = prod.current_stock
    new_stock = prev_stock + req.quantity_delta

    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment of {req.quantity_delta} would result in negative stock ({new_stock}). Current: {prev_stock}."
        )

    prod.current_stock = new_stock

    valid_types = ["AUDIT_ADJUSTMENT", "EXPIRED_DISCARD", "DAMAGE_WRITE_OFF", "STOCK_IN", "CUSTOMER_RETURN"]
    movement_type = req.movement_type if req.movement_type in valid_types else "AUDIT_ADJUSTMENT"

    movement = StockMovement(
        product_id=prod.id,
        batch_number=req.batch_number or f"ADJ-{prod.id}",
        movement_type=movement_type,
        quantity=req.quantity_delta,
        unit_cost=prod.cost_price,
        reference_id=f"ADJ-{int(datetime.datetime.now().timestamp())}",
        notes=req.notes or f"Stock adjustment by {manager.username} (delta: {req.quantity_delta:+d})"
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    db.refresh(prod)

    return StockAdjustmentResponse(
        product_id=prod.id,
        product_name=prod.name,
        previous_stock=prev_stock,
        current_stock=prod.current_stock,
        adjustment_applied=req.quantity_delta,
        movement_type=movement_type,
        movement_id=movement.id,
        timestamp=movement.created_at
    )

@router.post(
    "/{product_id}/batches",
    response_model=BatchItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Inward New Product Batch [MANAGER / ADMIN]",
    description="Registers a new manufacturing batch with FEFO expiry date, increments product inventory, and records StockMovement."
)
def inward_batch(
    product_id: int,
    req: BatchInwardRequest,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    prod = db.query(Product).filter(Product.id == product_id).with_for_update().first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )

    try:
        mfg = datetime.datetime.strptime(req.mfg_date, "%Y-%m-%d").date()
        exp = datetime.datetime.strptime(req.expiry_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dates must be in YYYY-MM-DD format."
        )

    if exp <= mfg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expiry date must be after manufacturing date."
        )

    # Create ProductBatch
    new_batch = ProductBatch(
        product_id=prod.id,
        batch_number=req.batch_number.strip(),
        mfg_date=mfg,
        expiry_date=exp,
        initial_quantity=req.quantity,
        current_quantity=req.quantity,
        unit_cost=req.unit_cost,
        is_active=True
    )
    db.add(new_batch)

    # Increment product inventory
    prod.current_stock += req.quantity

    # Create StockMovement
    movement = StockMovement(
        product_id=prod.id,
        batch_number=new_batch.batch_number,
        expiry_date=exp,
        movement_type="INWARD_GRN",
        quantity=req.quantity,
        unit_cost=req.unit_cost,
        reference_id=f"BATCH-{new_batch.batch_number}",
        notes=f"Inwarded batch {new_batch.batch_number} ({req.quantity} units, exp: {exp}) by {manager.username}"
    )
    db.add(movement)
    db.commit()
    db.refresh(new_batch)
    db.refresh(prod)

    today = datetime.date.today()
    days_left = (new_batch.expiry_date - today).days
    status_str = "EXPIRED" if days_left < 0 else "CRITICAL" if days_left <= 7 else "WARNING" if days_left <= 15 else "OPTIMAL"

    return BatchItemResponse(
        id=new_batch.id,
        product_id=new_batch.product_id,
        product_name=prod.name,
        barcode=prod.barcode,
        category_name=prod.category.name if prod.category else "General",
        batch_number=new_batch.batch_number,
        mfg_date=new_batch.mfg_date.strftime("%Y-%m-%d"),
        expiry_date=new_batch.expiry_date.strftime("%Y-%m-%d"),
        days_to_expiry=days_left,
        initial_quantity=new_batch.initial_quantity,
        current_quantity=new_batch.current_quantity,
        unit_cost=new_batch.unit_cost,
        is_active=new_batch.is_active,
        status=status_str
    )
