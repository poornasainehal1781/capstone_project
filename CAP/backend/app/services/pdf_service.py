import io
from decimal import Decimal
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from app.models.sale import Sale

STORE_DETAILS = {
    "name": "SMARTRETAIL HYPERMARKET",
    "tagline": "AI-Powered Smart Supermarket System",
    "branch": "Branch #104 - Indiranagar Flagship",
    "address": "100 Feet Road, HAL 2nd Stage, Bengaluru, Karnataka 560038",
    "gstin": "29AAAAA0000A1Z5",
    "phone": "+91 80 4123 4567",
    "email": "billing@smartretail.ai"
}

def generate_invoice_pdf(sale: Sale) -> bytes:
    """
    Generates a professional Supermarket GST Tax Invoice PDF.
    Returns binary PDF data.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=1, # Center
        textColor=colors.HexColor("#0f172a")
    )
    
    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor("#475569")
    )

    bold_label = ParagraphStyle(
        'BoldLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1e293b")
    )

    norm_val = ParagraphStyle(
        'NormVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155")
    )

    story = []

    # Store Header
    story.append(Paragraph(STORE_DETAILS["name"], title_style))
    story.append(Paragraph(f"{STORE_DETAILS['branch']} • {STORE_DETAILS['address']}", sub_style))
    story.append(Paragraph(f"GSTIN: <b>{STORE_DETAILS['gstin']}</b> | Phone: {STORE_DETAILS['phone']} | Email: {STORE_DETAILS['email']}", sub_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f766e"), spaceAfter=12))

    # Invoice Metadata Header (2 Column Table)
    customer_name = sale.customer.name if sale.customer else "Walk-in Retail Shopper"
    customer_phone = sale.customer.phone if sale.customer else "N/A"
    customer_tier = sale.customer.tier if sale.customer else "Standard"
    cashier_name = sale.cashier.full_name if sale.cashier else f"Operator #{sale.cashier_id}"

    meta_data = [
        [
            Paragraph(f"<b>Tax Invoice No:</b> {sale.invoice_number}", bold_label),
            Paragraph(f"<b>Date:</b> {sale.created_at.strftime('%d-%b-%Y %I:%M %p') if sale.created_at else 'N/A'}", bold_label)
        ],
        [
            Paragraph(f"<b>Cashier:</b> {cashier_name} (Register #02)", norm_val),
            Paragraph(f"<b>Payment Mode:</b> {sale.payment_method}", norm_val)
        ],
        [
            Paragraph(f"<b>Customer:</b> {customer_name} ({customer_phone})", norm_val),
            Paragraph(f"<b>Status:</b> {sale.status} • Tier: {customer_tier}", norm_val)
        ]
    ]

    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # Itemized Table
    headers = [
        Paragraph("<b>#</b>", bold_label),
        Paragraph("<b>Item Description / SKU</b>", bold_label),
        Paragraph("<b>Qty</b>", bold_label),
        Paragraph("<b>Unit Price (Rs)</b>", bold_label),
        Paragraph("<b>Tax Rate</b>", bold_label),
        Paragraph("<b>Tax (Rs)</b>", bold_label),
        Paragraph("<b>Total (Rs)</b>", bold_label)
    ]
    items_data = [headers]

    for idx, item in enumerate(sale.items, start=1):
        p_name = item.product.name if item.product else f"Product #{item.product_id}"
        p_sku = f" [SKU: {item.product.barcode}]" if item.product and item.product.barcode else ""
        items_data.append([
            Paragraph(str(idx), norm_val),
            Paragraph(f"{p_name}{p_sku}", norm_val),
            Paragraph(str(item.quantity), norm_val),
            Paragraph(f"{Decimal(item.unit_price):.2f}", norm_val),
            Paragraph(f"{Decimal(item.tax_rate):.1f}%", norm_val),
            Paragraph(f"{Decimal(item.tax_amount):.2f}", norm_val),
            Paragraph(f"{Decimal(item.line_total):.2f}", bold_label)
        ])

    items_table = Table(items_data, colWidths=[25, 205, 45, 75, 55, 65, 70])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f766e")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 14))

    # Totals Summary Table
    subtotal_val = Decimal(sale.subtotal)
    tax_val = Decimal(sale.tax_amount)
    discount_val = Decimal(sale.discount_amount)
    grand_total_val = Decimal(sale.grand_total)

    summary_data = [
        [Paragraph("Items Subtotal:", norm_val), Paragraph(f"Rs. {subtotal_val:.2f}", norm_val)],
        [Paragraph("Applicable GST (CGST + SGST):", norm_val), Paragraph(f"Rs. {tax_val:.2f}", norm_val)],
        [Paragraph("Total Promotional & Loyalty Discounts:", norm_val), Paragraph(f"-Rs. {discount_val:.2f}", norm_val)],
        [Paragraph("<b>FINAL PAYABLE AMOUNT (ROUNDED):</b>", bold_label), Paragraph(f"<b>Rs. {grand_total_val:.2f}</b>", bold_label)]
    ]
    summary_table = Table(summary_data, colWidths=[360, 180])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEABOVE', (0, 3), (1, 3), 1, colors.HexColor("#0f766e")),
        ('BACKGROUND', (0, 3), (1, 3), colors.HexColor("#ccfbf1")),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))

    # Footer note
    footer_text = Paragraph(
        "<i>Thank you for shopping at SmartRetail AI Hypermarket! Returns for fresh / dairy accepted within 24 hrs. "
        "Generated digitally via SmartRetail POS Engine.</i>",
        sub_style
    )
    story.append(footer_text)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
