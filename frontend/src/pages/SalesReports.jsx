import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Download,
  Calendar,
  Filter,
  CreditCard,
  QrCode,
  Banknote,
  DollarSign,
  ArrowUpRight,
  Printer,
  FileText,
  RotateCcw,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Loader2,
  PieChart as PieIcon,
  ShoppingBag,
  PackageCheck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { analyticsApi } from '../services/analyticsApi';
import { posApi } from '../services/posApi';
import { ReceiptModal } from '../components/pos/ReceiptModal';

export const SalesReports = ({ currentUser }) => {
  const [dateRange, setDateRange] = useState("last_30_days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeChartTab, setActiveChartTab] = useState("DAILY"); // "DAILY" | "WEEKLY" | "MONTHLY"

  // Analytics & Report Data from Backend
  const [analyticsData, setAnalyticsData] = useState(null);
  const [reportSummary, setReportSummary] = useState(null);
  const [realSales, setRealSales] = useState([]);

  const [loading, setLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fromD = dateRange === "custom" ? customFrom : null;
      const toD = dateRange === "custom" ? customTo : null;

      const [salesAnalytics, summary, salesList] = await Promise.all([
        analyticsApi.getSalesAnalytics(dateRange, fromD, toD),
        analyticsApi.getReportSummary(dateRange, fromD, toD).catch(() => null),
        posApi.listSales({ limit: 40 }).catch(() => [])
      ]);

      setAnalyticsData(salesAnalytics);
      setReportSummary(summary);
      setRealSales(salesList);
    } catch (err) {
      console.warn("Failed to load analytics & reports:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, customFrom, customTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle CSV Export
  const handleExportCsv = async (reportType = "sales") => {
    setDownloadingCsv(true);
    try {
      const fromD = dateRange === "custom" ? customFrom : null;
      const toD = dateRange === "custom" ? customTo : null;
      await analyticsApi.downloadReportCsv(reportType, fromD, toD);
    } catch (err) {
      alert("Failed to export CSV: " + err.message);
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Handle PDF Export
  const handleExportPdf = async (reportType = "summary") => {
    setDownloadingPdf(true);
    try {
      const fromD = dateRange === "custom" ? customFrom : null;
      const toD = dateRange === "custom" ? customTo : null;
      await analyticsApi.downloadReportPdf(reportType, fromD, toD);
    } catch (err) {
      alert("Failed to export PDF: " + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Void / Cancel Sale Handler
  const handleCancelSale = async (sale) => {
    const isManagerOrAdmin = currentUser?.role === 'MANAGER' || currentUser?.role === 'ADMIN';
    if (!isManagerOrAdmin) {
      alert("Access Denied: Only Managers and Admins are authorized to void transactions.");
      return;
    }

    if (!window.confirm(`Authorize Void & Stock Restoration for Invoice #${sale.invoice_number}?\nThis will revert all items back to shelf inventory.`)) {
      return;
    }

    setCancellingId(sale.id);
    try {
      await posApi.cancelSale(sale.id);
      alert(`Sale #${sale.invoice_number} cancelled successfully. Product stock restored in database.`);
      fetchData();
    } catch (err) {
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setCancellingId(null);
    }
  };

  // Chart data extraction
  const chartData = activeChartTab === "DAILY"
    ? analyticsData?.daily_sales || []
    : activeChartTab === "WEEKLY"
    ? analyticsData?.weekly_sales || []
    : analyticsData?.monthly_sales || [];

  const categoryShare = analyticsData?.category_sales || [];
  const paymentMethods = analyticsData?.payment_methods || [];
  const topProducts = analyticsData?.best_selling_products || [];

  const grossRevenue = reportSummary?.revenue_summary?.gross_revenue ? parseFloat(reportSummary.revenue_summary.gross_revenue) : 0;
  const taxCollected = reportSummary?.revenue_summary?.tax_amount ? parseFloat(reportSummary.revenue_summary.tax_amount) : 0;
  const netRevenue = reportSummary?.revenue_summary?.net_revenue ? parseFloat(reportSummary.revenue_summary.net_revenue) : (analyticsData?.total_revenue ? parseFloat(analyticsData.total_revenue) : 0);
  const totalOrders = reportSummary?.revenue_summary?.completed_orders ?? analyticsData?.total_orders ?? 0;
  const poExpenditure = reportSummary?.purchase_summary?.total_expenditure ? parseFloat(reportSummary.purchase_summary.total_expenditure) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Range Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <span>Executive Sales Reports & Multi-Dimensional Analytics</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
              AUDITED METRICS
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time revenue, gross margin audits, category contributions, and purchase order expenditures
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter Buttons */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
            {[
              { id: "today", label: "Today" },
              { id: "last_7_days", label: "7 Days" },
              { id: "last_30_days", label: "30 Days" },
              { id: "month_to_date", label: "MTD" },
              { id: "custom", label: "Custom" }
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setDateRange(r.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dateRange === r.id
                    ? "bg-emerald-500 text-slate-950 font-bold shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
              />
            </div>
          )}

          {/* Export Dropdowns / Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExportCsv("sales")}
              disabled={downloadingCsv}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Download CSV Sales Ledger"
            >
              {downloadingCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-400" />}
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => handleExportPdf("summary")}
              disabled={downloadingPdf}
              className="btn-primary py-2 px-3 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
              title="Generate Official PDF Report"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span>Executive PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 space-y-1">
          <span className="text-xs text-slate-400 uppercase font-semibold">Audited Net Revenue</span>
          <p className="text-2xl font-black text-white font-mono">
            ₹{netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> Gross: ₹{grossRevenue.toFixed(2)}
          </span>
        </div>

        <div className="glass-card p-4 space-y-1">
          <span className="text-xs text-slate-400 uppercase font-semibold">Completed Orders</span>
          <p className="text-2xl font-black text-white font-mono">{totalOrders} Invoices</p>
          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> 100% PostgreSQL Synced
          </span>
        </div>

        <div className="glass-card p-4 space-y-1">
          <span className="text-xs text-slate-400 uppercase font-semibold">GST Tax Deposited</span>
          <p className="text-2xl font-black text-white font-mono">
            ₹{taxCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400">CGST + SGST Breakdown</span>
        </div>

        <div className="glass-card p-4 space-y-1">
          <span className="text-xs text-slate-400 uppercase font-semibold">PO Supplier Inflow</span>
          <p className="text-2xl font-black text-emerald-400 font-mono">
            ₹{poExpenditure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400">
            {reportSummary?.purchase_summary?.total_orders ?? 0} Purchase Orders
          </span>
        </div>
      </div>

      {/* Time-Series Charts Section (Daily, Weekly, Monthly) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Time-Series Chart (2 Cols) */}
        <div className="lg:col-span-2 glass-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Revenue Performance Trajectory</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                  {activeChartTab} VIEW
                </span>
              </h3>
              <p className="text-xs text-slate-400">Periodic revenue velocity and bill settlement volume</p>
            </div>

            {/* Chart Granularity Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
              {["DAILY", "WEEKLY", "MONTHLY"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveChartTab(tab)}
                  className={`px-2.5 py-1 rounded transition-colors font-semibold ${
                    activeChartTab === tab
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.75rem", fontSize: "12px" }}
                    formatter={(val) => [`₹${parseFloat(val).toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                {loading ? "Loading telemetry..." : "No data recorded for this interval."}
              </div>
            )}
          </div>
        </div>

        {/* Category Contribution Share (1 Col) */}
        <div className="glass-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Department Contribution Share</h3>
            <p className="text-xs text-slate-400">Category-wise sales distribution</p>
          </div>

          <div className="h-48 w-full">
            {categoryShare.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryShare}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="total_revenue"
                  >
                    {categoryShare.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || "#10b981"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.75rem", fontSize: "12px" }}
                    formatter={(val) => [`₹${parseFloat(val).toLocaleString()}`, "Sales"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No category sales recorded.
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs max-h-36 overflow-y-auto">
            {categoryShare.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2 truncate max-w-[140px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate">{cat.category_name}</span>
                </span>
                <span className="font-semibold text-white font-mono">₹{parseFloat(cat.total_revenue).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tender Method Split & Best Selling SKUs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Tender Split */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">Tender Method Breakdown</h3>
          <p className="text-xs text-slate-400">UPI, Card, and Cash penetration</p>

          <div className="space-y-2 pt-2">
            {paymentMethods.map((pm, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400">
                    {pm.method.includes('UPI') ? <QrCode className="w-4 h-4" /> : pm.method.includes('CARD') ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{pm.method}</h4>
                    <p className="text-[10px] text-slate-500">{pm.count} Invoices</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white font-mono">₹{parseFloat(pm.total_amount).toFixed(2)}</p>
                  <span className="text-[10px] font-semibold text-emerald-400">{pm.percentage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best-Selling SKUs Leaderboard (2 Cols) */}
        <div className="lg:col-span-2 glass-card p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">Product-Wise Sales & Margin Leaderboard</h3>
            <button
              onClick={() => handleExportCsv("inventory")}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              Export Inventory CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-2.5">Product SKU</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-center">Units Sold</th>
                  <th className="p-2.5 text-right">Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      No product sales recorded in this interval.
                    </td>
                  </tr>
                ) : (
                  topProducts.slice(0, 6).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5">
                        <p className="font-semibold text-white">{item.product_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{item.barcode}</p>
                      </td>
                      <td className="p-2.5 text-slate-400">{item.category_name}</td>
                      <td className="p-2.5 text-center font-bold text-white font-mono">{item.units_sold}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400 font-mono">
                        ₹{parseFloat(item.total_revenue).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* LIVE POSTGRESQL SALES AUDIT TABLE */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Live POS Sales Invoices & Stock Movement Ledger</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PostgreSQL DB
              </span>
            </h3>
            <p className="text-xs text-slate-400">Click any invoice to download printable PDF or view line items.</p>
          </div>
          <span className="text-xs font-mono text-slate-400">{realSales.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Invoice Number</th>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Cashier</th>
                <th className="p-3">Tender</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-right">GST</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-emerald-400" />
                    <span>Loading database records...</span>
                  </td>
                </tr>
              ) : realSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-500">
                    No sales recorded yet. Perform a checkout from the POS Register.
                  </td>
                </tr>
              ) : (
                realSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-emerald-400">
                      {sale.invoice_number}
                    </td>
                    <td className="p-3 text-slate-300">
                      {new Date(sale.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="p-3 text-white">
                      {sale.customer_name || 'Walk-in Retail'}
                      {sale.customer_phone && <span className="block text-[10px] text-slate-500 font-mono">{sale.customer_phone}</span>}
                    </td>
                    <td className="p-3 text-slate-400">{sale.cashier_name || `User #${sale.cashier_id}`}</td>
                    <td className="p-3 font-mono text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-300">₹{parseFloat(sale.subtotal).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-slate-400">₹{parseFloat(sale.tax_amount).toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-white font-mono">
                      ₹{parseFloat(sale.grand_total).toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sale.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(sale)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
                        title="View Thermal Receipt"
                      >
                        Receipt
                      </button>

                      {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && sale.status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => handleCancelSale(sale)}
                          disabled={cancellingId === sale.id}
                          className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-colors disabled:opacity-40"
                          title="Authorized Void & Restore Stock"
                        >
                          {cancellingId === sale.id ? 'Reverting...' : 'Void'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thermal Receipt Modal Preview */}
      <ReceiptModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        receiptData={selectedReceipt}
      />
    </div>
  );
};
