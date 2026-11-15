import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  AlertCircle,
  RefreshCw,
  Loader2,
  PackageCheck
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { storeApi } from '../services/storeApi';

export const PurchaseManagement = ({ setActivePage }) => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Form State
  const [newPO, setNewPO] = useState({
    supplierId: "",
    productId: "",
    quantity: 20,
    unitCost: 50.0,
    expectedDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    receiveImmediately: false
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pos, supps, prods] = await Promise.all([
        storeApi.getPurchases(statusFilter),
        storeApi.getSuppliers(),
        storeApi.getProducts("", null, 100)
      ]);
      setOrders(pos || []);
      setSuppliers(supps || []);
      setProducts(prods || []);

      if (supps && supps.length > 0 && !newPO.supplierId) {
        setNewPO(prev => ({
          ...prev,
          supplierId: supps[0].id,
          productId: prods && prods.length > 0 ? prods[0].id : ""
        }));
      }
    } catch (err) {
      console.warn("Failed to load purchases:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredOrders = orders.filter((o) => {
    const sTerm = searchTerm.toLowerCase();
    const matchesSearch =
      (o.po_number || "").toLowerCase().includes(sTerm) ||
      (o.supplier_name || "").toLowerCase().includes(sTerm);
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreatePO = async (e) => {
    e.preventDefault();
    try {
      const prod = products.find(p => p.id === parseInt(newPO.productId)) || products[0];
      const supp = suppliers.find(s => s.id === parseInt(newPO.supplierId)) || suppliers[0];

      if (!prod || !supp) {
        alert("Please ensure at least one supplier and product are available.");
        return;
      }

      const payload = {
        supplier_id: supp.id,
        expected_delivery_date: newPO.expectedDate,
        items: [
          {
            product_id: prod.id,
            quantity: parseInt(newPO.quantity) || 10,
            unit_cost: parseFloat(newPO.unitCost || prod.cost_price || 50.0)
          }
        ]
      };

      await storeApi.createPurchase(payload, newPO.receiveImmediately);
      setIsAddModalOpen(false);
      alert(`Purchase Order created successfully${newPO.receiveImmediately ? " and inwarded to inventory" : ""}!`);
      fetchData();
    } catch (err) {
      alert(`PO creation failed: ${err.message}`);
    }
  };

  const markReceived = async (poId) => {
    setActionLoadingId(poId);
    try {
      await storeApi.receivePurchase(poId);
      alert(`Purchase Order received successfully! Products inwarded and stock movement audit record logged.`);
      fetchData();
    } catch (err) {
      alert(`Receive failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-400" />
            <span>Purchase Order Management & Procurement Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Procurement replenishment orders, supplier delivery tracking, and transactional Goods Receipt Note (GRN) inwarding.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {[
            { id: "ALL", label: "All Orders" },
            { id: "CONFIRMED", label: "In Transit / Confirmed" },
            { id: "RECEIVED", label: "Received (GRN Complete)" },
            { id: "DRAFT", label: "Draft" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? "bg-emerald-500 text-slate-950 shadow-sm font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search PO # or supplier name..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      {loading && orders.length === 0 && (
        <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs">Loading purchase ledger from database...</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4">PO Number</th>
                <th className="p-4">Supplier Partner</th>
                <th className="p-4">Order Date</th>
                <th className="p-4">Expected Delivery</th>
                <th className="p-4 text-center">Items Inwarded</th>
                <th className="p-4 text-right">PO Total (₹)</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No purchase orders found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => {
                  const isReceived = po.status === "RECEIVED";
                  const isConfirmed = po.status === "CONFIRMED" || po.status === "IN_TRANSIT";

                  return (
                    <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>{po.po_number}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="font-bold text-white">{po.supplier_name}</p>
                        <p className="text-[10px] text-slate-400">Created by: {po.created_by_name}</p>
                      </td>

                      <td className="p-4 text-slate-400 font-mono">
                        {new Date(po.created_at).toLocaleDateString()}
                      </td>

                      <td className="p-4 font-mono text-slate-300">
                        {po.expected_delivery_date || "Express 3-Day"}
                      </td>

                      <td className="p-4 text-center font-mono">
                        {po.items ? po.items.length : 1} Line(s)
                      </td>

                      <td className="p-4 text-right font-bold text-emerald-400 font-mono">
                        ₹{Number(po.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isReceived
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : isConfirmed
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {isReceived ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>{po.status}</span>
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {!isReceived ? (
                          <button
                            onClick={() => markReceived(po.id)}
                            disabled={actionLoadingId === po.id}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 mx-auto transition-colors disabled:opacity-50"
                          >
                            {actionLoadingId === po.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PackageCheck className="w-3.5 h-3.5" />
                            )}
                            <span>Receive & Inward</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                            ✓ Inwarded to Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Draft New Purchase Order"
        subtitle="Issues a replenishment requisition to FMCG supplier partner"
      >
        <form onSubmit={handleCreatePO} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Select Supplier Partner</label>
            <select
              value={newPO.supplierId}
              onChange={(e) => setNewPO({ ...newPO, supplierId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Lead Time: {s.lead_time_days || s.leadTimeDays || 3}d)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Select Product to Reorder</label>
            <select
              value={newPO.productId}
              onChange={(e) => {
                const prod = products.find(p => p.id === parseInt(e.target.value));
                setNewPO({
                  ...newPO,
                  productId: e.target.value,
                  unitCost: prod ? prod.cost_price : newPO.unitCost
                });
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current Stock: {p.current_stock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Reorder Quantity (Units)</label>
              <input
                type="number"
                min="1"
                required
                value={newPO.quantity}
                onChange={(e) => setNewPO({ ...newPO, quantity: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Unit Purchase Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newPO.unitCost}
                onChange={(e) => setNewPO({ ...newPO, unitCost: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Expected Delivery Date</label>
            <input
              type="date"
              required
              value={newPO.expectedDate}
              onChange={(e) => setNewPO({ ...newPO, expectedDate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="receiveNow"
              checked={newPO.receiveImmediately}
              onChange={(e) => setNewPO({ ...newPO, receiveImmediately: e.target.checked })}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <label htmlFor="receiveNow" className="text-xs text-slate-300 cursor-pointer">
              Goods already at receiving dock (Inward & increment stock immediately)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              Issue Purchase Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
