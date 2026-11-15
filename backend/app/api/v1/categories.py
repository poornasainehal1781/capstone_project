from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.api.deps import get_current_user, get_current_manager, get_current_admin

router = APIRouter()

@router.get(
    "",
    response_model=List[CategoryResponse],
    summary="List All Supermarket Categories",
    description="Returns all merchandise departments and categories."
)
def list_categories(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    categories = db.query(Category).order_by(Category.name.asc()).all()
    return categories

@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Get Category by ID"
)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found."
        )
    return cat

@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Category [MANAGER / ADMIN]",
    description="Registers a new department classification. Prevents duplicate name or code."
)
def create_category(
    req: CategoryCreate,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    # Check for duplicate name or code
    existing = db.query(Category).filter(
        (Category.name.ilike(req.name)) | (Category.code.ilike(req.code))
    ).first()

    if existing:
        if existing.name.lower() == req.name.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with name '{req.name}' already exists."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with code '{req.code}' already exists."
            )

    new_cat = Category(
        name=req.name.strip(),
        code=req.code.strip().upper(),
        description=req.description.strip() if req.description else None
    )

    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.put(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Update Category [MANAGER / ADMIN]"
)
def update_category(
    category_id: int,
    req: CategoryUpdate,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found."
        )

    # Check duplicate conflicts if name or code is changing
    if req.name and req.name.strip().lower() != cat.name.lower():
        duplicate_name = db.query(Category).filter(
            Category.name.ilike(req.name.strip()),
            Category.id != category_id
        ).first()
        if duplicate_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category name '{req.name}' is already used by another category."
            )
        cat.name = req.name.strip()

    if req.code and req.code.strip().upper() != cat.code.upper():
        duplicate_code = db.query(Category).filter(
            Category.code.ilike(req.code.strip()),
            Category.id != category_id
        ).first()
        if duplicate_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category code '{req.code}' is already used by another category."
            )
        cat.code = req.code.strip().upper()

    if req.description is not None:
        cat.description = req.description.strip() if req.description else None

    db.commit()
    db.refresh(cat)
    return cat

@router.delete(
    "/{category_id}",
    summary="Delete Category [ADMIN ONLY]",
    description="Deletes category if unused. Rejects deletion if products are still assigned."
)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found."
        )

    # Check if category is in use
    product_count = db.query(Product).filter(Product.category_id == category_id).count()
    if product_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete category '{cat.name}' because it contains {product_count} active product(s). "
                "Please reassign or delete these products first."
            )
        )

    db.delete(cat)
    db.commit()
    return {
        "status": "success",
        "message": f"Category '{cat.name}' (ID: {category_id}) deleted successfully."
    }
