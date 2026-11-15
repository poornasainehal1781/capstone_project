import io
import csv
import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database import get_db
from app.models.sale import Sale, SaleItem
from app.models.purchase import Purchase, PurchaseItem
from app.models.product import Product
from app.models.category import Category
from app.models.supplier import Supplier
from app.schemas.reports import (
    ReportSummaryResponse,
    RevenueSummaryData,
    PurchaseSummaryData,
    ProductSalesReportRow,
    CategorySalesReportRow
)
from app.api.deps import get_current_manager
from app.services.pdf_report_service import generate_report_pdf

router = APIRouter()

def resolve_date_bounds(date_range: str, from_date: Optional[str], to_date: Optional[str]):
    local_today = datetime.datetime.now().date()
    utc_today = datetime.datetime.now(datetime.timezone.utc).date()

    if date_range == "today":
        start_d = min(local_today, utc_today)
        end_d = max(local_today, utc_today)
        label = "Today"
    elif date_range == "yesterday":
        yest = min(local_today, utc_today) - datetime.timedelta(days=1)
        start_d, end_d = yest, yest
        label = "Yesterday"
    elif date_range == "last_7_days":
        start_d = min(local_today, utc_today) - datetime.timedelta(days=7)
        end_d = max(local_today, utc_today)
        label = "Last 7 Days"
    elif date_range == "last_30_days":
        start_d = min(local_today, utc_today) - datetime.timedelta(days=30)
        end_d = max(local_today, utc_today)
        label = "Last 30 Days"
    elif date_range == "month_to_date":
        ref_d = min(local_today, utc_today)
        start_d = datetime.date(ref_d.year, ref_d.month, 1)
        end_d = max(local_today, utc_today)
        label = "Month to Date"
    elif date_range == "custom" and from_date and to_date:
        try:
            start_d = datetime.datetime.strptime(from_date, "%Y-%m-%d").date()
            end_d = datetime.datetime.strptime(to_date, "%Y-%m-%d").date()
            if start_d > end_d:
                raise HTTPException(status_code=400, detail="from_date cannot be greater than to_date.")
            label = f"{start_d} to {end_d}"
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
    else:
        start_d = today_date - datetime.timedelta(days=30)
        end_d = today_date
        label = "All Time (Last 30 Days Default)"

    start_dt = datetime.datetime.combine(start_d, datetime.time.min)
    end_dt = datetime.datetime.combine(end_d, datetime.time.max)
    return start_d, end_d, start_dt, end_dt, label

@router.get(
    "/summary",
    response_model=ReportSummaryResponse,
    summary="Comprehensive Retail Executive Report [MANAGER / ADMIN]",
    description="Calculates revenue summaries, purchase order metrics, category contributions, and product-wise performance."
)
def get_report_summary(
    date_range: str = Query("last_30_days", description="today, yesterday, last_7_days, last_30_days, month_to_date, custom"),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    start_d, end_d, start_dt, end_dt, label = resolve_date_bounds(date_range, from_date, to_date)

    # 1. Sales & Revenue Summary
    sales = db.query(Sale).filter(
        Sale.status == "COMPLETED",
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt
    ).all()

    gross_rev = sum((Decimal(str(s.subtotal)) for s in sales), Decimal("0.00"))
    tax_amt = sum((Decimal(str(s.tax_amount)) for s in sales), Decimal("0.00"))
    disc_amt = sum((Decimal(str(s.discount_amount)) for s in sales), Decimal("0.00"))
    net_rev = sum((Decimal(str(s.grand_total)) for s in sales), Decimal("0.00"))
    completed_orders = len(sales)
    avg_basket = round(net_rev / Decimal(completed_orders), 2) if completed_orders > 0 else Decimal("0.00")

    revenue_summary = RevenueSummaryData(
        gross_revenue=round(gross_rev, 2),
        tax_amount=round(tax_amt, 2),
        discount_amount=round(disc_amt, 2),
        net_revenue=round(net_rev, 2),
        completed_orders=completed_orders,
        avg_basket_value=avg_basket
    )

    # 2. Purchase Summary
    purchases = db.query(Purchase).filter(
        Purchase.created_at >= start_dt,
        Purchase.created_at <= end_dt
    ).all()

    total_po_exp = sum((Decimal(str(p.total_amount)) for p in purchases), Decimal("0.00"))
    received_count = sum(1 for p in purchases if p.status == "RECEIVED")
    pending_count = sum(1 for p in purchases if p.status in ("CONFIRMED", "IN_TRANSIT"))
    draft_count = sum(1 for p in purchases if p.status == "DRAFT")

    purchase_summary = PurchaseSummaryData(
        total_orders=len(purchases),
        total_expenditure=round(total_po_exp, 2),
        received_orders=received_count,
        pending_orders=pending_count,
        draft_orders=draft_count
    )

    # 3. Category-wise Sales
    cat_query = (
        db.query(
            Category.id,
            Category.name,
            Category.code,
            func.sum(SaleItem.quantity).label("units_sold"),
            func.sum(SaleItem.line_total).label("gross_sales")
        )
        .join(Product, Product.category_id == Category.id)
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= start_dt, Sale.created_at <= end_dt)
        .group_by(Category.id, Category.name, Category.code)
        .order_by(desc("gross_sales"))
        .all()
    )

    category_sales = []
    for c in cat_query:
        c_gross = Decimal(str(c.gross_sales or "0.00"))
        pct = round((c_gross / net_rev * 100), 2) if net_rev > 0 else Decimal("0.00")
        category_sales.append(
            CategorySalesReportRow(
                category_id=c.id,
                category_name=c.name,
                category_code=c.code,
                units_sold=int(c.units_sold or 0),
                gross_sales=c_gross,
                contribution_percentage=pct
            )
        )

    # 4. Product-wise Sales
    prod_query = (
        db.query(
            Product.id,
            Product.name,
            Product.barcode,
            Product.selling_price,
            Category.name.label("category_name"),
            func.sum(SaleItem.quantity).label("units_sold"),
            func.sum(SaleItem.tax_amount).label("tax_collected"),
            func.sum(SaleItem.line_total).label("net_sales")
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .outerjoin(Category, Category.id == Product.category_id)
        .filter(Sale.status == "COMPLETED", Sale.created_at >= start_dt, Sale.created_at <= end_dt)
        .group_by(Product.id, Product.name, Product.barcode, Product.selling_price, Category.name)
        .order_by(desc("net_sales"))
        .all()
    )

    product_sales = []
    for p in prod_query:
        p_units = int(p.units_sold or 0)
        p_mrp = Decimal(str(p.selling_price))
        p_gross = Decimal(p_units) * p_mrp
        product_sales.append(
            ProductSalesReportRow(
                product_id=p.id,
                product_name=p.name,
                barcode=p.barcode,
                category_name=p.category_name or "General",
                units_sold=p_units,
                unit_mrp=p_mrp,
                gross_sales=round(p_gross, 2),
                tax_collected=Decimal(str(p.tax_collected or "0.00")),
                net_sales=Decimal(str(p.net_sales or "0.00"))
            )
        )

    # 5. Stock Overview
    all_prods = db.query(Product).all()
    total_val_cost = sum(Decimal(p.current_stock) * Decimal(str(p.cost_price)) for p in all_prods)
    total_val_mrp = sum(Decimal(p.current_stock) * Decimal(str(p.selling_price)) for p in all_prods)

    stock_overview = {
        "total_sku_count": len(all_prods),
        "total_stock_units": sum(p.current_stock for p in all_prods),
        "valuation_cost": round(total_val_cost, 2),
        "valuation_mrp": round(total_val_mrp, 2),
        "low_stock_count": sum(1 for p in all_prods if p.current_stock <= p.min_stock_level and p.current_stock > 0),
        "out_of_stock_count": sum(1 for p in all_prods if p.current_stock <= 0)
    }

    return ReportSummaryResponse(
        report_title="SmartRetail Store Executive Performance Summary",
        date_range_label=label,
        from_date=start_d.strftime("%Y-%m-%d"),
        to_date=end_d.strftime("%Y-%m-%d"),
        generated_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        revenue_summary=revenue_summary,
        purchase_summary=purchase_summary,
        category_sales=category_sales,
        product_sales=product_sales,
        stock_overview=stock_overview
    )

@router.get(
    "/export/csv",
    summary="Export Report as CSV [MANAGER / ADMIN]",
    description="Streams CSV export for sales, inventory, or purchase order records."
)
def export_report_csv(
    report_type: str = Query("sales", description="sales, inventory, purchases"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "sales":
        writer.writerow(["Invoice Number", "Date", "Customer", "Cashier ID", "Payment Method", "Subtotal", "Tax Amount", "Discount", "Grand Total", "Status"])
        query = db.query(Sale).filter(Sale.status == "COMPLETED")
        if from_date:
            query = query.filter(Sale.created_at >= datetime.datetime.strptime(from_date, "%Y-%m-%d"))
        if to_date:
            query = query.filter(Sale.created_at <= datetime.datetime.strptime(to_date, "%Y-%m-%d") + datetime.timedelta(days=1))

        sales = query.order_by(Sale.created_at.desc()).all()
        for s in sales:
            writer.writerow([
                s.invoice_number,
                s.created_at.strftime("%Y-%m-%d %H:%M"),
                s.customer.name if s.customer else "Walk-in Retail",
                s.cashier_id,
                s.payment_method,
                f"{Decimal(str(s.subtotal)):.2f}",
                f"{Decimal(str(s.tax_amount)):.2f}",
                f"{Decimal(str(s.discount_amount)):.2f}",
                f"{Decimal(str(s.grand_total)):.2f}",
                s.status
            ])

    elif report_type == "inventory":
        writer.writerow(["Product ID", "Barcode", "SKU", "Product Name", "Category", "Unit", "Cost Price", "MRP", "Tax Rate (%)", "Current Stock", "Min Stock Level", "Stock Value (Cost)", "Stock Value (MRP)"])
        products = db.query(Product).order_by(Product.name.asc()).all()
        for p in products:
            val_cost = Decimal(p.current_stock) * Decimal(str(p.cost_price))
            val_mrp = Decimal(p.current_stock) * Decimal(str(p.selling_price))
            writer.writerow([
                p.id,
                p.barcode,
                p.sku or "",
                p.name,
                p.category.name if p.category else "",
                p.unit,
                f"{Decimal(str(p.cost_price)):.2f}",
                f"{Decimal(str(p.selling_price)):.2f}",
                f"{Decimal(str(p.tax_rate)):.1f}",
                p.current_stock,
                p.min_stock_level,
                f"{val_cost:.2f}",
                f"{val_mrp:.2f}"
            ])

    elif report_type == "purchases":
        writer.writerow(["PO Number", "Date", "Supplier", "Created By User", "Total Amount", "Status", "Expected Delivery Date"])
        purchases = db.query(Purchase).order_by(Purchase.created_at.desc()).all()
        for po in purchases:
            writer.writerow([
                po.po_number,
                po.created_at.strftime("%Y-%m-%d"),
                po.supplier.name if po.supplier else "",
                po.created_by_user_id,
                f"{Decimal(str(po.total_amount)):.2f}",
                po.status,
                str(po.expected_delivery_date) if po.expected_delivery_date else ""
            ])
    else:
        raise HTTPException(status_code=400, detail="Invalid report_type. Expected sales, inventory, or purchases.")

    csv_data = output.getvalue()
    filename = f"SmartRetail_{report_type.capitalize()}_Report_{datetime.datetime.now().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.get(
    "/export/pdf",
    summary="Export Executive PDF Report [MANAGER / ADMIN]",
    description="Streams ReportLab-generated printable PDF report."
)
def export_report_pdf(
    report_type: str = Query("summary", description="summary, sales, inventory"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    start_d, end_d, start_dt, end_dt, label = resolve_date_bounds("custom" if from_date and to_date else "last_30_days", from_date, to_date)

    if report_type == "summary":
        sales = db.query(Sale).filter(Sale.status == "COMPLETED", Sale.created_at >= start_dt, Sale.created_at <= end_dt).all()
        purchases = db.query(Purchase).filter(Purchase.created_at >= start_dt, Purchase.created_at <= end_dt).all()
        products = db.query(Product).all()

        net_rev = sum((Decimal(str(s.grand_total)) for s in sales), Decimal("0.00"))
        po_exp = sum((Decimal(str(p.total_amount)) for p in purchases), Decimal("0.00"))
        val_cost = sum(Decimal(p.current_stock) * Decimal(str(p.cost_price)) for p in products)

        summary_data = {
            "Total Net Revenue": f"Rs. {net_rev:.2f}",
            "Completed Bills": str(len(sales)),
            "PO Expenditure": f"Rs. {po_exp:.2f}",
            "Inventory Valuation": f"Rs. {val_cost:.2f}"
        }

        # Itemized top sales rows
        cat_query = (
            db.query(
                Category.name,
                func.sum(SaleItem.quantity).label("units_sold"),
                func.sum(SaleItem.line_total).label("gross_sales")
            )
            .join(Product, Product.category_id == Category.id)
            .join(SaleItem, SaleItem.product_id == Product.id)
            .join(Sale, Sale.id == SaleItem.sale_id)
            .filter(Sale.status == "COMPLETED", Sale.created_at >= start_dt, Sale.created_at <= end_dt)
            .group_by(Category.name)
            .order_by(desc("gross_sales"))
            .all()
        )

        headers = ["Department / Category", "Units Sold", "Gross Revenue (Rs)", "Share (%)"]
        table_rows = []
        for c in cat_query:
            c_sales = Decimal(str(c.gross_sales or "0.00"))
            pct = f"{(c_sales / net_rev * 100):.1f}%" if net_rev > 0 else "0.0%"
            table_rows.append([c.name, str(c.units_sold), f"Rs. {c_sales:.2f}", pct])

        if not table_rows:
            table_rows = [["No transactions recorded in period", "0", "Rs. 0.00", "0%"]]

        pdf_bytes = generate_report_pdf(
            report_title="Supermarket Executive Summary Report",
            date_range_label=label,
            summary_data=summary_data,
            table_rows=table_rows,
            headers=headers,
            col_widths=[200, 100, 140, 100]
        )

    elif report_type == "sales":
        sales = db.query(Sale).filter(Sale.status == "COMPLETED", Sale.created_at >= start_dt, Sale.created_at <= end_dt).order_by(Sale.created_at.desc()).limit(40).all()
        total_rev = sum((Decimal(str(s.grand_total)) for s in sales), Decimal("0.00"))
        summary_data = {
            "Total Period Revenue": f"Rs. {total_rev:.2f}",
            "Invoices Count": str(len(sales)),
            "Audited Period": label
        }

        headers = ["Invoice #", "Date & Time", "Payment", "Subtotal (Rs)", "GST (Rs)", "Total (Rs)"]
        table_rows = []
        for s in sales:
            table_rows.append([
                s.invoice_number,
                s.created_at.strftime("%d-%b %H:%M"),
                s.payment_method,
                f"{Decimal(str(s.subtotal)):.2f}",
                f"{Decimal(str(s.tax_amount)):.2f}",
                f"{Decimal(str(s.grand_total)):.2f}"
            ])

        pdf_bytes = generate_report_pdf(
            report_title="Detailed POS Sales Invoices Audit",
            date_range_label=label,
            summary_data=summary_data,
            table_rows=table_rows,
            headers=headers,
            col_widths=[120, 90, 80, 80, 80, 90]
        )

    elif report_type == "inventory":
        products = db.query(Product).order_by(Product.current_stock.asc()).limit(40).all()
        val_cost = sum(Decimal(p.current_stock) * Decimal(str(p.cost_price)) for p in products)
        val_mrp = sum(Decimal(p.current_stock) * Decimal(str(p.selling_price)) for p in products)
        summary_data = {
            "Total SKUs Audited": str(len(products)),
            "Valuation (Cost)": f"Rs. {val_cost:.2f}",
            "Valuation (MRP)": f"Rs. {val_mrp:.2f}"
        }

        headers = ["Barcode", "Product Description", "Category", "Stock", "Min Stock", "Status"]
        table_rows = []
        for p in products:
            status_text = "OUT OF STOCK" if p.current_stock <= 0 else ("LOW STOCK" if p.current_stock <= p.min_stock_level else "OPTIMAL")
            cat_name = p.category.name if p.category else "General"
            table_rows.append([
                p.barcode,
                p.name[:25],
                cat_name[:15],
                f"{p.current_stock} {p.unit}",
                str(p.min_stock_level),
                status_text
            ])

        pdf_bytes = generate_report_pdf(
            report_title="Warehouse Inventory & Stock Health Audit",
            date_range_label="Current Shelf Balance",
            summary_data=summary_data,
            table_rows=table_rows,
            headers=headers,
            col_widths=[90, 160, 90, 70, 60, 70]
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid report_type. Expected summary, sales, or inventory.")

    filename = f"SmartRetail_{report_type.capitalize()}_Report_{datetime.datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={filename}"
        }
    )

