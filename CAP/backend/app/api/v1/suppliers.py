from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from app.api.deps import get_current_user, get_current_manager, get_current_admin

router = APIRouter(prefix="/suppliers", tags=["Suppliers & Vendors"])

@router.get(
    "",
    response_model=List[SupplierResponse],
    summary="List All FMCG Suppliers",
    description="Returns vendor partner directory with contact persons, lead times, and credit terms."
)
def list_suppliers(
    search: Optional[str] = Query(None, description="Search by name, contact, or email"),
    is_active: Optional[bool] = Query(None, description="Filter active status"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Supplier)

    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Supplier.name.ilike(s_term),
                Supplier.contact_person.ilike(s_term),
                Supplier.email.ilike(s_term),
                Supplier.phone.ilike(s_term)
            )
        )

    if is_active is not None:
        query = query.filter(Supplier.is_active == is_active)

    return query.order_by(Supplier.name.asc()).all()

@router.get(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Get Supplier by ID"
)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found."
        )
    return supplier

@router.post(
    "",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New Supplier [MANAGER / ADMIN]"
)
def create_supplier(
    req: SupplierCreate,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    existing = db.query(Supplier).filter(Supplier.name.ilike(req.name.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Supplier with name '{req.name}' already exists."
        )

    supplier = Supplier(
        name=req.name.strip(),
        contact_person=req.contact_person.strip(),
        phone=req.phone.strip(),
        email=req.email.strip().lower(),
        lead_time_days=req.lead_time_days,
        credit_terms=req.credit_terms,
        is_active=req.is_active
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier

@router.put(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Update Supplier Details [MANAGER / ADMIN]"
)
def update_supplier(
    supplier_id: int,
    req: SupplierUpdate,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found."
        )

    if req.name is not None:
        supplier.name = req.name.strip()
    if req.contact_person is not None:
        supplier.contact_person = req.contact_person.strip()
    if req.phone is not None:
        supplier.phone = req.phone.strip()
    if req.email is not None:
        supplier.email = req.email.strip().lower()
    if req.lead_time_days is not None:
        supplier.lead_time_days = req.lead_time_days
    if req.credit_terms is not None:
        supplier.credit_terms = req.credit_terms
    if req.is_active is not None:
        supplier.is_active = req.is_active

    db.commit()
    db.refresh(supplier)
    return supplier

@router.delete(
    "/{supplier_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate or Delete Supplier [ADMIN ONLY]"
)
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found."
        )

    if supplier.purchases:
        supplier.is_active = False
        db.commit()
        return {"message": f"Supplier '{supplier.name}' has purchase history. Deactivated successfully."}

    db.delete(supplier)
    db.commit()
    return {"message": f"Supplier '{supplier.name}' deleted successfully."}

