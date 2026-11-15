import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Tag,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Download,
  FileText,
  RefreshCw,
  Box,
  AlertCircle,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Package,
  History
} from 'lucide-react';
import { MOCK_PRODUCTS } from '../data/mockData';
import { Modal } from '../components/common/Modal';
import { DemoNoticeBanner } from '../components/common/DemoBadge';
import { analyticsApi } from '../services/analyticsApi';
import { posApi } from '../services/posApi';
import { storeApi } from '../services/storeApi';

export const Inventory = ({ onOpenAICopilot }) => {
  const [activeTab, setActiveTab] = useState("HEALTH"); // 'HEALTH' | 'REPLENISHMENT' | 'MOVEMENTS' | 'FEFO'
  const [healthFilter, setHealthFilter] = useState("ALL"); // 'ALL' | 'LOW' | 'OUT'
  const [searchTerm, setSearchTerm] = useState("");
  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Live Backend Inventory State
  const [inventoryData, setInventoryData] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [batchesList, setBatchesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Inward Stock Batch Form State
  const [inwardForm, setInwardForm] = useState({
    productId: 1,
    batchNo: `BAT-2026-${Math.floor(100 + Math.random() * 900)}`,
    mfgDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    quantity: 50,
    unitCost: 60.0,
  });

  // Stock Adjustment State
  const [adjustForm, setAdjustForm] = useState({
    productId: 1,
    quantityDelta: 0,
    reason: "AUDIT_RECONCILIATION",
    referenceId: "",
  });

  // Fetch Inventory Analytics from backend
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invData, prods, batches] = await Promise.all([
        analyticsApi.getInventoryAnalytics(),
        posApi.searchProducts("", null, 100).catch(() => []),
        storeApi.getBatches().catch(() => [])
      ]);
      setInventoryData(invData);
      setProductsList(prods && prods.length > 0 ? prods : []);
      setBatchesList(batches && batches.length > 0 ? batches : []);
      if (prods && prods.length > 0 && !inwardForm.productId) {
        setInwardForm(prev => ({ ...prev, productId: prods[0].id }));
        setAdjustForm(prev => ({ ...prev, productId: prods[0].id }));
      }
    } catch (err) {
      console.warn("Failed to load inventory analytics from backend:", err);
      setError(err.message || "Failed to load live inventory analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Export handlers
  const handleExportCsv = async () => {
    setDownloadingCsv(true);
    try {
      await analyticsApi.downloadReportCsv("inventory");
    } catch (err) {
      alert(`CSV Export failed: ${err.message}`);
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    setDownloadingPdf(true);
    try {
      await analyticsApi.downloadReportPdf("inventory");
    } catch (err) {
      alert(`PDF Export failed: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Batches computation (Live PostgreSQL/SQLite batches with FEFO)
  const activeBatchesData = batchesList.length > 0
    ? batchesList.map((b) => ({
        id: b.id,
        batchNo: b.batch_number,
        productId: b.product_id,
        productName: b.product_name,
        barcode: b.product_barcode,
        category: "Active Lot",
        unit: "Units",
        costPrice: parseFloat(b.cost_price || 0),
        mrp: 0,
        expiryDate: b.expiry_date,
        daysLeft: b.days_to_expiry,
        qty: b.current_quantity,
        totalProductStock: b.current_quantity,
        fefoStatus: b.fefo_status,
      }))
    : MOCK_PRODUCTS.flatMap((p) =>
        (p.activeBatches || []).map((b) => ({
          ...b,
          productId: p.id,
          productName: p.name,
          barcode: p.barcode,
          category: p.category,
          unit: p.unit,
          costPrice: p.costPrice,
          mrp: p.mrp,
          isPerishable: p.isPerishable,
          totalProductStock: p.currentStock,
          minStockLevel: p.minStockLevel,
          fefoStatus: b.daysLeft <= 0 ? "EXPIRED" : b.daysLeft <= 7 ? "CRITICAL" : b.daysLeft <= 15 ? "WARNING" : "OPTIMAL",
        }))
      );

  const filteredBatches = activeBatchesData.filter((b) => {
    const matchesSearch =
      (b.productName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.batchNo || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // All products for stock health tab
  const allStockItems = productsList.length > 0 ? productsList : (
    (inventoryData?.low_stock_products || []).concat(inventoryData?.out_of_stock_products || [])
  );

  const filteredStockItems = allStockItems.filter((item) => {
    const nameMatch = (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.barcode || "").toLowerCase().includes(searchTerm.toLowerCase());
    if (!nameMatch) return false;

    const currentStock = item.current_stock ?? item.stock ?? 0;
    const minStock = item.min_stock_level ?? item.minStockLevel ?? 10;

    if (healthFilter === "LOW") return currentStock > 0 && currentStock <= minStock;
    if (healthFilter === "OUT") return currentStock <= 0;
    return true;
  });

  const handleInwardStock = async (e) => {
    e.preventDefault();
    try {
      await storeApi.inwardBatch(inwardForm.productId, {
        batch_number: inwardForm.batchNo.trim(),
        mfg_date: inwardForm.mfgDate,
        expiry_date: inwardForm.expiryDate,
        initial_quantity: parseInt(inwardForm.quantity),
        cost_price: parseFloat(inwardForm.unitCost),
      });
      alert(`Batch ${inwardForm.batchNo} (${inwardForm.quantity} units) successfully inwarded to database.`);
      setIsInwardModalOpen(false);
      fetchInventory();
    } catch (err) {
      alert(`Inward batch failed: ${err.message}`);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    try {
      const res = await storeApi.adjustStock(adjustForm.productId, {
        quantity_delta: parseInt(adjustForm.quantityDelta),
        reason: adjustForm.reason,
        reference_id: adjustForm.referenceId ? adjustForm.referenceId.trim() : `ADJ-${Date.now()}`
      });
      alert(`Stock adjusted successfully. New on-hand stock: ${res.new_stock}`);
      setIsAdjustModalOpen(false);
      fetchInventory();
    } catch (err) {
      alert(`Stock adjustment failed: ${err.message}`);
    }
  };

  const openInwardForProduct = (prod) => {
    setInwardForm({
      productId: prod.id || prod.product_id,
      batchNo: `BAT-2026-${Math.floor(100 + Math.random() * 900)}`,
      mfgDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      quantity: prod.suggested_reorder_qty || 25,
      unitCost: 50.0,
    });
    setIsInwardModalOpen(true);
  };

  const openAdjustForProduct = (prod) => {
    setAdjustForm({
      productId: prod.id || prod.product_id,
      quantityDelta: 0,
      reason: "AUDIT_RECONCILIATION",
      referenceId: `AUDIT-${Date.now().toString().slice(-6)}`,
    });
    setIsAdjustModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            <span>Inventory Health & Replenishment Analytics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time stock valuation, reorder point alerts, replenishment radar, and movement audit trail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* AI Copilot shortcut */}
          <button
            onClick={onOpenAICopilot}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>AI Expiry Advice</span>
          </button>

          {/* CSV Export */}
          <button
            onClick={handleExportCsv}
            disabled={downloadingCsv}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Download CSV Inventory Report"
          >
            {downloadingCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export CSV</span>
          </button>

          {/* PDF Export */}
          <button
            onClick={handleExportPdf}
            disabled={downloadingPdf}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Download PDF Stock Report"
          >
            {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <FileText className="w-3.5 h-3.5 text-rose-400" />}
            <span>Export PDF</span>
          </button>

          {/* Stock Adjustment Button */}
          <button
            onClick={() => setIsAdjustModalOpen(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            title="Adjust Stock Discrepancy"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Stock Adjustment</span>
          </button>

          {/* Inward Batch Button */}
          <button
            onClick={() => setIsInwardModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Inward New Batch (GRN)</span>
          </button>
        </div>
      </div>

      {/* Top Inventory Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-card p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Catalog SKUs</span>
            <Box className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {inventoryData?.total_products ?? productsList.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Active items</div>
        </div>

        <div className="glass-card p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Units</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {inventoryData?.total_stock_units ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Units on hand</div>
        </div>

        <div className="glass-card p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Valuation (Cost)</span>
            <Tag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono">
            ₹{Number(inventoryData?.inventory_valuation_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">At purchase price</div>
        </div>

        <div className="glass-card p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Valuation (MRP)</span>
            <ArrowUpRight className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-indigo-300 font-mono">
            ₹{Number(inventoryData?.inventory_valuation_mrp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Retail potential</div>
        </div>

        <div className="glass-card p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {inventoryData?.low_stock_count ?? 0}
          </div>
          <div className="text-[10px] text-amber-300/80 mt-1">Below safety level</div>
        </div>

        <div className="glass-card p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Out of Stock</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono">
            {inventoryData?.out_of_stock_count ?? 0}
          </div>
          <div className="text-[10px] text-rose-300/80 mt-1">Stockout alerts</div>
        </div>
      </div>

      {/* Tab Navigation & Search Filter */}
      <div className="glass-card p-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "HEALTH", label: "Stock Levels & Status", icon: Package, badge: inventoryData?.total_products },
            { id: "REPLENISHMENT", label: "Replenishment Radar", icon: ShoppingCart, badge: inventoryData?.replenishment_needed?.length, alert: (inventoryData?.replenishment_needed?.length || 0) > 0 },
            { id: "MOVEMENTS", label: "Movement Audit Log", icon: History, badge: inventoryData?.recent_stock_movements?.length },
            { id: "FEFO", label: "FEFO Batch Expiry", icon: Clock, badge: filteredBatches.length }
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  isActive
                    ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                    : "bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      isActive
                        ? "bg-slate-950 text-white"
                        : t.alert
                        ? "bg-rose-500 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product, SKU, barcode..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Loading state indicator */}
      {loading && !inventoryData && (
        <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs">Loading live inventory metrics from database...</span>
        </div>
      )}

      {/* TAB 1: Stock Levels & Status */}
      {activeTab === "HEALTH" && (
        <div className="space-y-3">
          {/* Sub-filters for health */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-slate-400 font-medium">Filter view:</span>
            {[
              { id: "ALL", label: "All Items" },
              { id: "LOW", label: "Low Stock Only" },
              { id: "OUT", label: "Out of Stock Only" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setHealthFilter(f.id)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  healthFilter === f.id
                    ? "bg-slate-800 text-emerald-400 font-semibold border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">Product / Barcode</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-center">Current Stock</th>
                    <th className="p-3.5 text-center">Safety Reorder Point</th>
                    <th className="p-3.5 text-right">Selling Price</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No products match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((prod) => {
                      const stock = prod.current_stock ?? prod.stock ?? 0;
                      const minStock = prod.min_stock_level ?? prod.minStockLevel ?? 10;
                      const isOut = stock <= 0;
                      const isLow = stock > 0 && stock <= minStock;

                      return (
                        <tr key={prod.id || prod.barcode} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5">
                            <p className="font-bold text-white">{prod.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              SKU/Barcode: {prod.barcode || `SKU-${prod.id}`}
                            </p>
                          </td>
                          <td className="p-3.5 text-slate-300">
                            {prod.category?.name || prod.category_name || prod.category || "General"}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold">
                            <span className={isOut ? "text-rose-400" : isLow ? "text-amber-400" : "text-emerald-400"}>
                              {stock} {prod.unit || "pcs"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center text-slate-400 font-mono">
                            {minStock} {prod.unit || "pcs"}
                          </td>
                          <td className="p-3.5 text-right text-slate-200 font-mono font-bold">
                            ₹{Number(prod.selling_price || prod.mrp || 0).toFixed(2)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                isOut
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                  : isLow
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {isOut ? "OUT OF STOCK" : isLow ? "LOW STOCK" : "OPTIMAL"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isOut || isLow ? (
                                <button
                                  onClick={() => openInwardForProduct(prod)}
                                  className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold text-[11px] transition-colors"
                                >
                                  Reorder
                                </button>
                              ) : null}
                              <button
                                onClick={() => openAdjustForProduct(prod)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] border border-slate-700 transition-colors"
                                title="Adjust on-hand inventory"
                              >
                                Adjust
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Replenishment Radar */}
      {activeTab === "REPLENISHMENT" && (
        <div className="space-y-4">
          <div className="glass-card p-4 border border-indigo-500/20 bg-indigo-950/10">
            <div className="flex items-start gap-3">
              <ShoppingCart className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">Automated Replenishment Suggestions</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  The system scans sales velocity and safety thresholds to recommend replenishment purchase batches before stockouts occur.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-center">Current Stock</th>
                    <th className="p-3.5 text-center">Safety Level</th>
                    <th className="p-3.5 text-center">Suggested Reorder Qty</th>
                    <th className="p-3.5 text-right">Est. Purchase Cost</th>
                    <th className="p-3.5 text-center">Urgency</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(!inventoryData?.replenishment_needed || inventoryData.replenishment_needed.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                        <p className="font-semibold text-white">All stock levels are optimal</p>
                        <p className="text-[11px] text-slate-500 mt-1">No products require immediate replenishment.</p>
                      </td>
                    </tr>
                  ) : (
                    inventoryData.replenishment_needed.map((item) => {
                      const isCritical = item.urgency === "CRITICAL";
                      const isHigh = item.urgency === "HIGH";

                      return (
                        <tr key={item.product_id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5">
                            <p className="font-bold text-white">{item.product_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Barcode: {item.barcode}</p>
                          </td>
                          <td className="p-3.5 text-slate-300">
                            {item.category_name || "General"}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-rose-400">
                            {item.current_stock}
                          </td>
                          <td className="p-3.5 text-center font-mono text-slate-400">
                            {item.min_stock_level}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-emerald-400">
                            +{item.suggested_reorder_qty}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-white">
                            ₹{Number(item.estimated_cost || 0).toFixed(2)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block ${
                                isCritical
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                                  : isHigh
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                              }`}
                            >
                              {item.urgency}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => openInwardForProduct(item)}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-colors"
                            >
                              Create GRN
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Stock Movement Audit Log */}
      {activeTab === "MOVEMENTS" && (
        <div className="space-y-4">
          <div className="glass-card p-4 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="text-xs font-bold text-white">Stock Movement Audit Trail</h4>
                <p className="text-[11px] text-slate-400">
                  Immutable record of inventory decrements (sales), increments (purchase GRNs), and manual adjustments.
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400">
              {inventoryData?.recent_stock_movements?.length || 0} Recent Events
            </span>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5 text-center">Movement Type</th>
                    <th className="p-3.5 text-center">Quantity Delta</th>
                    <th className="p-3.5">Reference ID</th>
                    <th className="p-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(!inventoryData?.recent_stock_movements || inventoryData.recent_stock_movements.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No stock movement records found in database.
                      </td>
                    </tr>
                  ) : (
                    inventoryData.recent_stock_movements.map((m) => {
                      const isReduction = m.quantity < 0 || m.movement_type === "SALE" || m.movement_type === "DAMAGE";
                      return (
                        <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 text-slate-400 font-mono whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="p-3.5">
                            <p className="font-bold text-white">{m.product_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Barcode: {m.barcode}</p>
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                m.movement_type === "SALE"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : m.movement_type === "PURCHASE_RECEIPT"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              }`}
                            >
                              {m.movement_type}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold">
                            <span className={isReduction ? "text-rose-400" : "text-emerald-400"}>
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-300">
                            {m.reference_id || "N/A"}
                          </td>
                          <td className="p-3.5 text-slate-400 italic">
                            {m.notes || "System movement"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FEFO Batch Expiry Radar */}
      {activeTab === "FEFO" && (
        <div className="space-y-4">
          <div className="glass-card p-4 border border-blue-500/20 bg-blue-950/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400" />
              <div>
                <h4 className="text-xs font-bold text-white">Live FEFO (First-Expired-First-Out) Batch Management</h4>
                <p className="text-[11px] text-slate-400">
                  Batches are automatically prioritized by earliest expiry date. Point-of-sale automatically consumes earliest lots and blocks expired goods.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {filteredBatches.length} Lots Active
            </span>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-4">Product / SKU</th>
                    <th className="p-4">Batch Number</th>
                    <th className="p-4">Expiry Date</th>
                    <th className="p-4 text-center">Days Remaining</th>
                    <th className="p-4 text-center">Batch Stock</th>
                    <th className="p-4 text-center">Total Stock</th>
                    <th className="p-4 text-center">Shelf Health</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No active product batches recorded in database.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b, idx) => {
                      const isExpired = b.daysLeft <= 0 || b.fefoStatus === "EXPIRED";
                      const isCritical = !isExpired && (b.daysLeft <= 7 || b.fefoStatus === "CRITICAL");
                      const isWarning = !isExpired && !isCritical && (b.daysLeft <= 15 || b.fefoStatus === "WARNING");

                      return (
                        <tr key={b.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <p className="font-bold text-white">{b.productName}</p>
                            <p className="text-[10px] text-slate-400">
                              {b.category} {b.mrp ? `• MRP: ₹${Number(b.mrp).toFixed(2)}` : (b.costPrice ? `• Cost: ₹${Number(b.costPrice).toFixed(2)}` : "")}
                            </p>
                          </td>

                          <td className="p-4 font-mono font-bold text-slate-200">
                            <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                              {b.batchNo}
                            </span>
                          </td>

                          <td className="p-4 font-mono text-slate-300">
                            {b.expiryDate}
                          </td>

                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                                isExpired
                                  ? "bg-rose-950/60 text-rose-400 border border-rose-600/60"
                                  : isCritical
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                                  : isWarning
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{isExpired ? "EXPIRED" : `${b.daysLeft} Days`}</span>
                            </span>
                          </td>

                          <td className="p-4 text-center font-bold text-white font-mono">
                            {b.qty} {b.unit || "units"}
                          </td>

                          <td className="p-4 text-center text-slate-300 font-mono">
                            {b.totalProductStock} {b.unit || "units"}
                          </td>

                          <td className="p-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                isExpired
                                  ? "bg-rose-950 text-rose-400 border border-rose-800"
                                  : isCritical
                                  ? "bg-rose-500/30 text-rose-200"
                                  : isWarning
                                  ? "bg-amber-500/30 text-amber-200"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {isExpired ? "BLOCKED FROM POS" : isCritical ? "CRITICAL RISK" : isWarning ? "NEAR EXPIRY" : "OPTIMAL"}
                            </span>
                          </td>

                          <td className="p-4 text-center">
                            {isExpired ? (
                              <button
                                onClick={() => openAdjustForProduct({ id: b.productId, name: b.productName })}
                                className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-[11px] transition-colors"
                              >
                                Write Off (Damage)
                              </button>
                            ) : isCritical || isWarning ? (
                              <button
                                onClick={() => alert(`Dynamic clearance markdown applied to Batch ${b.batchNo}. Price discounted for rapid sell-through.`)}
                                className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-semibold text-[11px] transition-colors"
                              >
                                Markdown 25%
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500">FEFO Optimal</span>
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
        </div>
      )}

      {/* Inward New Batch Modal */}
      <Modal
        isOpen={isInwardModalOpen}
        onClose={() => setIsInwardModalOpen(false)}
        title="Inward Goods Receipt Note (GRN)"
        subtitle="Registers incoming batch barcode, manufacture date, and expiry date"
      >
        <form onSubmit={handleInwardStock} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Select Product</label>
            <select
              value={inwardForm.productId}
              onChange={(e) => setInwardForm({ ...inwardForm, productId: parseInt(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {(productsList.length > 0 ? productsList : MOCK_PRODUCTS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.barcode || `SKU-${p.id}`})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Supplier Batch Number</label>
              <input
                type="text"
                required
                value={inwardForm.batchNo}
                onChange={(e) => setInwardForm({ ...inwardForm, batchNo: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Received Quantity</label>
              <input
                type="number"
                required
                min="1"
                value={inwardForm.quantity}
                onChange={(e) => setInwardForm({ ...inwardForm, quantity: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Manufacture Date</label>
              <input
                type="date"
                required
                value={inwardForm.mfgDate}
                onChange={(e) => setInwardForm({ ...inwardForm, mfgDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Batch Expiry Date</label>
              <input
                type="date"
                required
                value={inwardForm.expiryDate}
                onChange={(e) => setInwardForm({ ...inwardForm, expiryDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsInwardModalOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              Confirm Inward & Generate Lot
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Adjustment Reconciliation Modal */}
      {isAdjustModalOpen && (
        <Modal
          isOpen={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
          title="Manual Stock Adjustment & Audit Reconciliation"
          subtitle="Reconciles physical inventory discrepancies, write-offs, damages, or stock finding"
        >
          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Select Product to Reconcile</label>
              <select
                value={adjustForm.productId}
                onChange={(e) => setAdjustForm({ ...adjustForm, productId: parseInt(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {productsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current Stock: {p.current_stock ?? p.stock ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Stock Delta (± Units)</label>
                <input
                  type="number"
                  required
                  placeholder="-5 or +10"
                  value={adjustForm.quantityDelta}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantityDelta: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500">Use negative for loss/damage, positive for found stock</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Reason Category</label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="AUDIT_RECONCILIATION">Audit Reconciliation</option>
                  <option value="DAMAGE_EXPIRY">Damaged / Expired Write-Off</option>
                  <option value="THEFT_LOSS">Theft / Shrinkage Loss</option>
                  <option value="FOUND_STOCK">Unrecorded Stock Found</option>
                  <option value="RETURN_TO_VENDOR">Return to Vendor (RTV)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Audit / Reference Ticket ID</label>
              <input
                type="text"
                placeholder="AUDIT-2026-001"
                value={adjustForm.referenceId}
                onChange={(e) => setAdjustForm({ ...adjustForm, referenceId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs bg-amber-600 hover:bg-amber-500 text-white">
                Apply Stock Adjustment & Log Audit
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
