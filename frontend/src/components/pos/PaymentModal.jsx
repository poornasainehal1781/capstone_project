import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { QrCode, Banknote, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { posApi } from '../../services/posApi';

export const PaymentModal = ({
  isOpen,
  onClose,
  cart,
  subtotal,
  taxAmount,
  totalDiscount,
  grandTotal,
  customer,
  currentUser,
  onPaymentSuccess
}) => {
  const [method, setMethod] = useState('UPI'); // 'UPI' | 'CASH' | 'CARD'
  const [cashTendered, setCashTendered] = useState(grandTotal ? Math.ceil(grandTotal / 100) * 100 : 500);
  const [processing, setProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const changeDue = Math.max(0, (cashTendered || 0) - grandTotal);

  const handlePay = async () => {
    setProcessing(true);
    setCheckoutError(null);

    // Map cart items for backend schema
    const saleItems = cart.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
      unit_price: parseFloat(item.selling_price || item.mrp || 0),
      tax_rate: parseFloat(item.tax_rate || item.taxRate || 5.0),
      discount: 0.00,
      batch_number: item.batchAssigned || `BATCH-${item.id}`
    }));

    // Generate unique idempotency key
    const idempotencyKey = `TXN-POS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const payload = {
      customer_id: customer && customer.id !== 999 ? customer.id : null,
      customer_phone: customer ? customer.phone : null,
      customer_name: customer ? customer.name : null,
      payment_method: method === 'UPI' ? 'UPI_QR' : method,
      discount_amount: parseFloat(totalDiscount || 0),
      idempotency_key: idempotencyKey,
      notes: `POS Register #02 checkout by cashier '${currentUser?.username || currentUser?.name}'`,
      items: saleItems,
    };

    try {
      const response = await posApi.checkoutSale(payload);
      setProcessing(false);
      onPaymentSuccess({
        ...response,
        cashTendered: method === 'CASH' ? cashTendered : null,
        changeReturned: method === 'CASH' ? changeDue : null,
      });
      onClose();
    } catch (err) {
      console.error("Checkout transaction error:", err);
      setProcessing(false);
      setCheckoutError(err.message || "Failed to process sale. Please verify stock availability.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!processing) onClose();
      }}
      title="Complete POS Payment Settlement"
      subtitle={`Total Payable: ₹${grandTotal.toFixed(2)} (Tax Included)`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {/* Error Banner */}
        {checkoutError && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="space-y-0.5">
              <span className="font-bold">Transaction Declined:</span>
              <p>{checkoutError}</p>
            </div>
          </div>
        )}

        {/* Payment Method Selector */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setMethod('UPI')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              method === 'UPI'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>UPI Dynamic QR</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('CASH')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              method === 'CASH'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Cash Tender</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('CARD')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              method === 'CARD'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Card POS (EDC)</span>
          </button>
        </div>

        {/* Dynamic Payment Body */}
        {method === 'UPI' && (
          <div className="text-center p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="inline-block p-3 rounded-2xl bg-white shadow-xl shadow-emerald-950/30">
              <div className="w-44 h-44 bg-white p-2 flex flex-col items-center justify-center border-4 border-slate-900 rounded-lg">
                <QrCode className="w-36 h-36 text-slate-950" />
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-white">Scan with any UPI App</p>
              <p className="text-xs text-slate-400 mt-0.5">Google Pay, PhonePe, Paytm, BHIM</p>
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-slate-800 rounded-lg text-[11px] text-emerald-400 font-mono">
                <span>upi://pay?pa=smartretail@icici&am={grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Awaiting payment webhook confirmation...</span>
            </div>
          </div>
        )}

        {method === 'CASH' && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Cash Received from Customer (₹)</label>
              <div className="relative">
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Quick Cash Buttons */}
            <div className="flex gap-2">
              {[grandTotal, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCashTendered(Math.ceil(amt))}
                  className="flex-1 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                >
                  ₹{Math.ceil(amt)}
                </button>
              ))}
            </div>

            {/* Change Due Display */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Return Change to Customer:</span>
                <p className="text-xl font-extrabold text-emerald-400">₹{changeDue.toFixed(2)}</p>
              </div>
              <Banknote className="w-8 h-8 text-emerald-500/40" />
            </div>
          </div>
        )}

        {method === 'CARD' && (
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
            <CreditCard className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <div>
              <p className="text-sm font-bold text-white">Swipe / Tap Card on Connected EDC Machine</p>
              <p className="text-xs text-slate-400 mt-1">Terminal ID: EDC-BLR-04 • Integrated Pinelabs / Mosambee</p>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl text-xs text-slate-300 font-mono">
              Terminal Status: READY FOR CARD INSERTION
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            Cancel Transaction
          </button>

          <button
            type="button"
            onClick={handlePay}
            disabled={processing || (method === 'CASH' && cashTendered < grandTotal)}
            className="btn-primary py-2.5 px-5 text-xs font-bold disabled:opacity-40 flex items-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving to Database & Updating Stock...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm ₹{grandTotal.toFixed(2)} & Settle Invoice</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
