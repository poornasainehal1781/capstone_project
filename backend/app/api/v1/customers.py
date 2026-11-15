from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.customer import Customer
from app.models.sale import Sale
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.schemas.sale import SaleResponse
from app.api.v1.sales import format_sale_response
from app.api.deps import get_current_user, get_current_cashier, get_current_manager

router = APIRouter()

@router.get(
    "",
    response_model=List[CustomerResponse],
    summary="List and Search Customers",
    description="Search customers by mobile phone or name."
)
def list_customers(
    search: Optional[str] = Query(None, description="Search by phone number or name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cashier)
):
    query = db.query(Customer)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(Customer.name.ilike(term), Customer.phone.ilike(term)))
    return query.order_by(Customer.name.asc()).offset(skip).limit(limit).all()

@router.get(
    "/phone/{phone}",
    response_model=CustomerResponse,
    summary="Lookup Customer by Mobile Phone",
    description="High-speed lookup used during POS checkout."
)
def get_customer_by_phone(
    phone: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cashier)
):
    clean_phone = phone.strip()
    cust = db.query(Customer).filter(Customer.phone == clean_phone).first()
    if not cust:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with phone '{phone}' not registered."
        )
    return cust

@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Get Customer Details by ID"
)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cashier)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )
    return cust

@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Customer Profile",
    description="Creates a new customer loyalty account. Prevents duplicate phone numbers."
)
def create_customer(
    req: CustomerCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cashier)
):
    clean_phone = req.phone.strip()
    existing = db.query(Customer).filter(Customer.phone == clean_phone).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer with phone '{clean_phone}' is already registered: {existing.name}."
        )

    customer = Customer(
        name=req.name.strip(),
        phone=clean_phone,
        email=req.email.strip() if req.email else None,
        loyalty_points=0,
        tier="Silver"
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer

@router.put(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update Customer Profile",
    description="Updates customer personal details, contact number, or loyalty tier."
)
def update_customer(
    customer_id: int,
    req: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cashier)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )

    if req.phone and req.phone.strip() != customer.phone:
        clean_phone = req.phone.strip()
        existing = db.query(Customer).filter(
            Customer.phone == clean_phone,
            Customer.id != customer_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phone number '{clean_phone}' is already registered to '{existing.name}'."
            )
        customer.phone = clean_phone

    if req.name is not None:
        customer.name = req.name.strip()
    if req.email is not None:
        customer.email = req.email.strip() if req.email else None
    if req.loyalty_points is not None:
        customer.loyalty_points = req.loyalty_points
    if req.tier is not None:
        customer.tier = req.tier

    db.commit()
    db.refresh(customer)
    return customer

@router.get(
    "/{customer_id}/sales",
    response_model=List[SaleResponse],
    summary="Get Customer Purchase History",
    description="Returns chronological list of all sales invoices completed for this customer."
)
def get_customer_sales(
    customer_id: int,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cashier)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )

    sales = (
        db.query(Sale)
        .filter(Sale.customer_id == customer_id)
        .order_by(Sale.created_at.desc())
        .limit(limit)
        .all()
    )
    return [format_sale_response(s) for s in sales]
