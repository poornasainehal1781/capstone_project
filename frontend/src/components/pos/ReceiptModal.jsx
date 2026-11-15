import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Printer, Download, CheckCircle2, FileText, Loader2, ArrowRight } from 'lucide-react';
import { STORE_INFO } from '../../data/mockData';
import { posApi } from '../../services/posApi';

export const ReceiptModal = ({ isOpen, onClose, receiptData }) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!receiptData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!receiptData.id) return;
    setDownloadingPdf(true);
    try {
      const blob = await posApi.downloadInvoicePdf(receiptData.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${receiptData.invoice_number || receiptData.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download PDF invoice: " + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const invoiceNumber = receiptData.invoice_number || receiptData.invoiceNo || `INV-SAMPLE`;
  const dateTime = receiptData.created_at
    ? new Date(receiptData.created_at).toLocaleString()
    : receiptData.date || new Date().toLocaleString();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="POS Tax Invoice Generated"
      subtitle={`Saved in Database • Receipt #${invoiceNumber}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Printable Thermal Receipt Box */}
        <div
          id="printable-receipt"
          className="bg-white text-slate-900 p-6 rounded-xl font-mono text-xs shadow-inner border border-slate-300"
        >
          {/* Store Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-400 space-y-1">
            <h2 className="font-extrabold text-sm tracking-wider uppercase">{STORE_INFO.name}</h2>
            <p className="text-[11px] font-sans text-slate-600">{STORE_INFO.branch}</p>
            <p className="text-[10px] text-slate-500 leading-tight">{STORE_INFO.address}</p>
            <p className="text-[10px] text-slate-600">GSTIN: {STORE_INFO.gstin} | PH: {STORE_INFO.phone}</p>
          </div>

          {/* Bill Meta */}
          <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
            <div className="flex justify-between">
              <span>Invoice: <strong>{invoiceNumber}</strong></span>
              <span>Register: #02</span>
            </div>
            <div className="flex justify-between">
              <span>Date: {dateTime}</span>
              <span>Cashier: {receiptData.cashier_name || receiptData.cashier || 'Cashier'}</span>
            </div>
            {(receiptData.customer_name || receiptData.customer) && (
              <div className="flex justify-between text-slate-700">
                <span>Customer: {receiptData.customer_name || receiptData.customer?.name}</span>
                <span>Phone: {receiptData.customer_phone || receiptData.customer?.phone || 'N/A'}</span>
              </div>
            )}
          </div>

          {/* Itemized Table */}
          <div className="py-2.5 border-b border-dashed border-slate-400">
            <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-300">
              <span className="w-1/2">Item Description</span>
              <span className="w-10 text-center">Qty</span>
              <span className="w-16 text-right">Rate</span>
              <span className="w-16 text-right">Amt</span>
            </div>

            <div className="divide-y divide-slate-100 py-1">
              {receiptData.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 text-[11px]">
                  <span className="w-1/2 truncate font-sans text-slate-800" title={item.product_name || item.name}>
                    {item.product_name || item.name}
                  </span>
                  <span className="w-10 text-center font-bold">{item.quantity}</span>
                  <span className="w-16 text-right">₹{parseFloat(item.unit_price || item.mrp || 0).toFixed(2)}</span>
                  <span className="w-16 text-right font-bold">
                    ₹{parseFloat(item.line_total || (item.quantity * (item.unit_price || item.mrp || 0))).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Tax Calculation */}
          <div className="py-2.5 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Items Subtotal:</span>
              <span>₹{parseFloat(receiptData.subtotal || 0).toFixed(2)}</span>
            </div>
            {parseFloat(receiptData.discount_amount || receiptData.discount || 0) > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Promotions & Loyalty Discounts:</span>
                <span>-₹{parseFloat(receiptData.discount_amount || receiptData.discount || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Applicable GST (CGST + SGST):</span>
              <span>₹{parseFloat(receiptData.tax_amount || receiptData.tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold pt-1.5 border-t border-dashed border-slate-400">
              <span>GRAND TOTAL:</span>
              <span>₹{parseFloat(receiptData.grand_total || receiptData.total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 pt-1">
              <span>Payment Mode: {receiptData.payment_method || receiptData.paymentMethod}</span>
              <span className="font-bold text-emerald-600">STATUS: {receiptData.status || 'COMPLETED'}</span>
            </div>
          </div>

          {/* Barcode & Footer */}
          <div className="pt-3 border-t border-dashed border-slate-400 text-center space-y-1">
            <div className="font-mono text-[9px] tracking-widest text-slate-600">
              ||| | ||||| |||| || |||||| | |||||
            </div>
            <p className="text-[10px] font-bold tracking-wider">{invoiceNumber}</p>
            <p className="text-[9px] text-slate-500 font-sans mt-1">
              Thank you for shopping at SmartRetail AI Hypermarket!
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Start New Bill
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || !receiptData.id}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
