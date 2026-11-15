import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  ShoppingBag,
  AlertTriangle,
  PackageX,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle,
  Plus,
  ShoppingCart,
  Users,
  RefreshCw,
  Barcode,
  Layers,
  FileText
} from 'lucide-react';
import {
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
import { StatCard } from '../components/common/StatCard';

export const Dashboard = ({ setActivePage, onOpenAICopilot }) => {
  const [stats, setStats] = useState(null);
  const [salesTrends, setSalesTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, salesData] = await Promise.all([
        analyticsApi.getDashboardStats(),
        analyticsApi.getSalesAnalytics("last_30_days")
      ]);
      setStats(dashData);
      setSalesTrends(salesData.daily_sales || []);
    } catch (err) {
      console.warn("Failed to load live dashboard metrics:", err);
      setError("Unable to connect to live analytics engine. Please ensure backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const totalRevenue = stats?.total_sales_revenue ? parseFloat(stats.total_sales_revenue) : 0;
  const todayRevenue = stats?.today_revenue ? parseFloat(stats.today_revenue) : 0;
  const completedOrders = stats?.completed_orders_count ?? 0;
  const todayOrders = stats?.today_orders_count ?? 0;
  const totalProducts = stats?.total_products ?? 0;
  const lowStockCount = stats?.low_stock_count ?? 0;
  const outOfStockCount = stats?.out_of_stock_count ?? 0;
  const totalCustomers = stats?.total_customers ?? 0;
  const avgBasket = stats?.avg_order_value ? parseFloat(stats.avg_order_value) : 0;

  const categoryShare = stats?.category_revenue_share?.length
    ? stats.category_revenue_share.map((c) => ({
        name: c.category_name,
        value: parseFloat(c.total_revenue || 0),
        color: c.color || "#10b981",
        units: c.units_sold
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Store Executive Dashboard & Real-Time Performance
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                POSTGRESQL SYNCED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live supermarket operations • Financial telemetry & automated inventory radar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Refresh database totals"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Sync Metrics</span>
          </button>

          <button
            onClick={() => setActivePage('pos')}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main KPI Stats Row (8 Core Retail Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Sales Revenue */}
        <StatCard
          title="Total Audited Sales"
          value={`₹${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend="+18.4% vs last period"
          trendDirection="up"
          subtitle={`${completedOrders} Total Settled Orders`}
          icon={IndianRupee}
          colorScheme="emerald"
        />

        {/* Metric 2: Today's Revenue */}
        <StatCard
          title="Today's Revenue"
          value={`₹${todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={`${todayOrders} Invoices Cleared Today`}
          trendDirection="up"
          subtitle={`Avg Basket: ₹${avgBasket.toFixed(2)}`}
          icon={ShoppingBag}
          colorScheme="blue"
        />

        {/* Metric 3: Total Products & Catalog */}
        <StatCard
          title="Master SKU Catalog"
          value={`${totalProducts} Products`}
          trend="Active Barcode Index"
          trendDirection="neutral"
          subtitle={`${totalCustomers} Registered Customers`}
          icon={Layers}
          colorScheme="purple"
        />

        {/* Metric 4: Low Stock & Out of Stock */}
        <StatCard
          title="Stock Replenishment Alert"
          value={`${lowStockCount + outOfStockCount} SKUs`}
          trend={outOfStockCount > 0 ? `${outOfStockCount} Out of Stock` : "All SKUs in stock"}
          trendDirection={lowStockCount + outOfStockCount > 0 ? "down" : "up"}
          subtitle={`${lowStockCount} below minimum ROP`}
          icon={PackageX}
          colorScheme={outOfStockCount > 0 ? "rose" : "amber"}
          badge={lowStockCount + outOfStockCount > 0 ? "Urgent Reorder" : "Optimal"}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 30-Day Sales Velocity Area Chart */}
        <div className="lg:col-span-2 glass-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>30-Day Sales Revenue Trajectory</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                  Live PostgreSQL Feed
                </span>
              </h3>
              <p className="text-xs text-slate-400">Daily gross revenue and order frequency trends</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Revenue (₹)
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            {salesTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.75rem", fontSize: "12px" }}
                    formatter={(value) => [`₹${parseFloat(value).toLocaleString()}`, "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                <span>Loading sales trend curves from database...</span>
              </div>
            )}
          </div>
        </div>

        {/* Category Contribution Donut */}
        <div className="glass-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Department Revenue Share</h3>
            <p className="text-xs text-slate-400">Category-wise sales distribution</p>
          </div>

          <div className="h-56 w-full">
            {categoryShare.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryShare}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryShare.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.75rem", fontSize: "12px" }}
                    formatter={(val) => [`₹${parseFloat(val).toLocaleString()}`, "Revenue"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                <span>No category sales recorded yet.</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs max-h-36 overflow-y-auto">
            {categoryShare.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2 truncate max-w-[140px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate">{cat.name}</span>
                </span>
                <span className="font-semibold text-white font-mono">₹{cat.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top-Selling Products & Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top-Selling Products Leaderboard */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Top-Selling Supermarket SKUs</h3>
            </div>
            <span className="text-xs text-slate-400">By sales volume</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-center">Units</th>
                  <th className="p-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {!stats?.top_selling_products?.length ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      No sales data recorded yet.
                    </td>
                  </tr>
                ) : (
                  stats.top_selling_products.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5">
                        <p className="font-semibold text-white truncate max-w-[160px]">{item.product_name}</p>
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

        {/* Recent POS Sales Feed */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Recent POS Checkout Invoices</h3>
            </div>
            <button
              onClick={() => setActivePage('reports')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {!stats?.recent_sales?.length ? (
              <div className="p-6 text-center text-slate-500 text-xs">No recent sales found.</div>
            ) : (
              stats.recent_sales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{sale.invoice_number}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        sale.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {sale.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {sale.customer_name} • Paid via <code className="text-slate-300">{sale.payment_method}</code> • {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      ₹{parseFloat(sale.grand_total).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Launch Action Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-purple-950/40 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white">Supermarket Floor Management</h4>
          <p className="text-xs text-slate-400">Quickly jump to POS register, detailed sales audits, or stock replenishment radar.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActivePage('reports')}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Audit Reports</span>
          </button>
          <button
            onClick={() => setActivePage('pos')}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
          </button>
          <button
            onClick={onOpenAICopilot}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Copilot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
