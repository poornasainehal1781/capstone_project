import React, { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Package,
  Plus,
  ArrowRight,
  ShieldAlert,
  Layers,
  Calculator,
  Shuffle,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  Bot,
  User,
  Send,
  Zap,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { aiApi } from '../services/aiApi';

export const AIInsights = ({ setActivePage, onOpenAICopilot }) => {
  const [activeTab, setActiveTab] = useState("RESTOCK"); // 'RESTOCK' | 'TRENDS' | 'EXPIRY' | 'CHAT'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);

  // Chat State inside page
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "ai",
      text: "Hello Store Manager! I am your SmartRetail Floor Operations & Decision Copilot. Ask me about stock levels, today's sales, best sellers, or near-expiry batches.",
      suggestions: [
        "Which products are low in stock?",
        "What were today's total sales?",
        "Which products sold the most this month?",
        "Which products need replenishment?",
        "How are sales performing?",
        "Which products are approaching expiry?"
      ]
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiApi.getFullInsights();
      setInsights(data);
    } catch (err) {
      console.warn("Failed to fetch full AI insights:", err);
      setError(err.message || "Failed to load AI insights from backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleSendChat = async (messageText) => {
    const q = messageText || chatInput;
    if (!q.trim()) return;

    const userMsg = { sender: "user", text: q };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const history = chatMessages.slice(-4).map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const res = await aiApi.sendChatMessage(q, history);
      const aiMsg = {
        sender: "ai",
        text: res.reply,
        engine: res.engine,
        model: res.model_used,
        isFallback: res.is_fallback,
        actions: res.suggested_actions
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        {
          sender: "ai",
          text: `⚠️ Query processing error: ${err.message}. Please check connection.`,
          isError: true
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const replenishment = insights?.replenishment;
  const salesTrends = insights?.sales_trends;
  const nearExpiry = insights?.near_expiry;
  const isFallbackEngine = insights?.is_fallback ?? true;
  const engineName = insights?.engine === "OPENAI_GPT" ? "OpenAI GPT-4o-mini" : "Rule-Based Deterministic Engine";

  return (
    <div className="space-y-6">
      {/* Top Header & Engine Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>AI Decision Support & Predictive Optimization</span>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                    !isFallbackEngine
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {!isFallbackEngine
                      ? `AI Powered (${engineName})`
                      : `Rule-Based Decision Engine (Deterministic Fallback)`}
                  </span>
                </span>
                {isFallbackEngine && insights?.fallback_reason && (
                  <span className="text-[10px] text-slate-400">
                    • Deterministic logic active (No OpenAI API key configured)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Insights"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          <button
            onClick={onOpenAICopilot}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 transition-all hover:scale-105"
          >
            <Bot className="w-4 h-4" />
            <span>Open Copilot Drawer</span>
          </button>
        </div>
      </div>

      {/* Master Executive Summary Banner */}
      {insights?.master_ai_summary && (
        <div className="glass-card p-4 border border-purple-500/30 bg-purple-950/15">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Store Executive AI Synthesis
              </h4>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                {insights.master_ai_summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          {
            id: "RESTOCK",
            label: "Demand Forecasting & Auto Restock (ROP)",
            count: replenishment?.items_needing_reorder ?? 0,
            icon: Package
          },
          {
            id: "TRENDS",
            label: "Sales Trends & Slow Movers",
            count: salesTrends?.slow_moving_products?.length ?? 0,
            icon: BarChart3
          },
          {
            id: "EXPIRY",
            label: "Dynamic Expiry Markdown Radar",
            count: (nearExpiry?.critical_count ?? 0) + (nearExpiry?.expired_count ?? 0),
            icon: AlertTriangle,
            alert: (nearExpiry?.critical_count ?? 0) > 0 || (nearExpiry?.expired_count ?? 0) > 0
          },
          {
            id: "CHAT",
            label: "Manager Assistant Chatbot",
            icon: Bot
          }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-purple-600 text-white shadow-md shadow-purple-950/40"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    tab.alert
                      ? "bg-rose-500 text-white"
                      : isActive
                      ? "bg-black/30 text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && !insights && (
        <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="text-xs">Computing AI demand forecasts and shelf-life telemetry...</span>
        </div>
      )}

      {/* TAB 1: RESTOCK */}
      {activeTab === 'RESTOCK' && (
        <div className="space-y-5">
          {/* Formula Callout Box */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>Deterministic Reorder Point (ROP) & Safety Stock Formula</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Service Level: 95%</span>
            </div>
            <p className="font-mono text-emerald-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              ROP = (Average Daily Velocity × Supplier Lead Time) + Safety Buffer
            </p>
            <p className="text-[11px] text-slate-400">
              {replenishment?.executive_summary || "Analyzing historical 30-day velocity from real sales records."}
            </p>
          </div>

          {/* Restock Recommendations List */}
          {(!replenishment?.recommendations || replenishment.recommendations.length === 0) ? (
            <div className="glass-card p-12 text-center text-slate-400">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-white">All Inventory Levels are Healthy</h3>
              <p className="text-xs text-slate-500 mt-1">
                All {replenishment?.total_items_analyzed || 12} SKUs are operating above their safety reorder thresholds.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {replenishment.recommendations.map((item) => (
                <div
                  key={item.product_id}
                  className={`glass-card p-5 border-l-4 transition-all space-y-4 ${
                    item.urgency === "CRITICAL"
                      ? "border-l-rose-500"
                      : item.urgency === "HIGH"
                      ? "border-l-amber-500"
                      : "border-l-blue-500"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{item.product_name}</h3>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            item.urgency === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : item.urgency === "HIGH"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {item.urgency} RESTOCK
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.barcode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Supplier: <strong className="text-white">{item.supplier_name}</strong> • Lead Time: <strong className="text-white">{item.lead_time_days} Days</strong> • Velocity: <strong className="text-emerald-400">{item.average_daily_sales} units/day</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <span className="text-slate-400 text-[10px] block">Current Stock</span>
                        <span className="font-black text-rose-400 text-sm">{item.current_stock} Units</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[10px] block">Calculated ROP</span>
                        <span className="font-black text-slate-200 text-sm">{item.reorder_point} Units</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Operational Reason & Coverage Model:</span>
                    </div>
                    <p className="leading-relaxed text-slate-200">{item.explanation}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
                    <span className="text-xs text-slate-400">
                      Recommended Batch Size: <strong className="text-emerald-400">+{item.suggested_order_qty} units</strong> • Est. Procurement Cost: <strong className="text-white font-mono">₹{Number(item.estimated_cost).toFixed(2)}</strong>
                    </span>

                    <button
                      onClick={() => setActivePage && setActivePage('purchases')}
                      className="btn-primary text-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Pre-filled PO (+{item.suggested_order_qty} Units)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SALES TRENDS & SLOW MOVERS */}
      {activeTab === 'TRENDS' && (
        <div className="space-y-5">
          {/* Period-over-Period Performance Box */}
          <div className="glass-card p-5 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Weekly Sales Comparison</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-2xl font-bold text-white font-mono">
                    ₹{Number(salesTrends?.recent_period_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      (salesTrends?.revenue_growth_pct || 0) >= 0
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {(salesTrends?.revenue_growth_pct || 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>{salesTrends?.revenue_growth_pct > 0 ? `+${salesTrends.revenue_growth_pct}%` : `${salesTrends?.revenue_growth_pct}%`}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Comparing {salesTrends?.recent_period_label || "Past 7 Days"} vs {salesTrends?.prior_period_label || "Prior 7 Days"} (₹{Number(salesTrends?.prior_period_revenue || 0).toFixed(2)})
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 max-w-md text-xs text-slate-300">
                <span className="font-bold text-purple-300 block mb-1">AI Trend Synthesis:</span>
                <p>{salesTrends?.executive_summary}</p>
              </div>
            </div>
          </div>

          {/* Slow-Moving Products Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Slow-Moving Products & Working Capital Lock</span>
              </h3>
              <span className="text-xs text-slate-400">
                {salesTrends?.slow_moving_products?.length || 0} Products Identified
              </span>
            </div>

            {(!salesTrends?.slow_moving_products || salesTrends.slow_moving_products.length === 0) ? (
              <div className="glass-card p-8 text-center text-slate-400">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold text-white">No Slow-Moving Lines Detected</p>
                <p className="text-[11px] text-slate-500 mt-0.5">All stocked SKUs show active weekly sales velocity.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {salesTrends.slow_moving_products.map((item) => (
                  <div key={item.product_id} className="glass-card p-4 border border-amber-500/20 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-xs">{item.product_name}</h4>
                        <span className="text-[10px] text-slate-400">{item.category_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Locked Capital</span>
                        <span className="text-xs font-bold text-amber-400 font-mono">
                          ₹{Number(item.locked_capital).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-slate-950/60 p-2 rounded-lg text-slate-300 font-mono">
                      <span>Stock: <strong>{item.current_stock} units</strong></span>
                      <span>Weekly Sales: <strong>{item.units_sold_30d} units</strong></span>
                      <span>Days Inactive: <strong>{item.days_without_sale}d</strong></span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
                      💡 {item.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DYNAMIC EXPIRY MARKDOWN RADAR */}
      {activeTab === 'EXPIRY' && (
        <div className="space-y-5">
          {/* Strict Food Safety Banner */}
          <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-xs text-slate-200 space-y-1.5">
            <div className="flex items-center gap-2 text-rose-300 font-bold">
              <ShieldAlert className="w-5 h-5" />
              <span>Strict Food Safety & Supermarket Compliance Standards</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {nearExpiry?.policy_note}
            </p>
            <div className="flex items-center gap-4 pt-1 text-[11px] font-mono text-slate-400">
              <span>Tracked Lots: <strong className="text-white">{nearExpiry?.total_batches_tracked || 0}</strong></span>
              <span>Expired Quarantined: <strong className="text-rose-400">{nearExpiry?.expired_count || 0}</strong></span>
              <span>Near-Expiry (<strong className="text-amber-400">&lt; 7 Days</strong>): <strong className="text-amber-400">{nearExpiry?.critical_count || 0}</strong></span>
              <span>Non-Perishables (No fabricated dates): <strong className="text-slate-200">{nearExpiry?.non_monitored_products_count || 0} SKUs</strong></span>
            </div>
          </div>

          {/* Batches Table / Cards */}
          <div className="space-y-4">
            {nearExpiry?.items?.map((lot) => {
              const isExpired = lot.status === "EXPIRED";
              const isCritical = lot.status === "CRITICAL";
              const isWarning = lot.status === "WARNING";

              return (
                <div
                  key={lot.batch_id}
                  className={`glass-card p-5 border-l-4 transition-all space-y-3 ${
                    isExpired
                      ? "border-l-rose-600 bg-rose-950/10"
                      : isCritical
                      ? "border-l-amber-500"
                      : isWarning
                      ? "border-l-yellow-500"
                      : "border-l-emerald-500"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{lot.product_name}</h4>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          Lot: {lot.batch_number}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            isExpired
                              ? "bg-rose-600 text-white animate-pulse"
                              : isCritical
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : isWarning
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {lot.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Expiry Date: <strong className="text-white font-mono">{lot.expiry_date}</strong> (
                        <span className={lot.days_to_expiry < 0 ? "text-rose-400 font-bold" : "text-amber-400"}>
                          {lot.days_to_expiry < 0 ? `Expired ${Math.abs(lot.days_to_expiry)} days ago` : `${lot.days_to_expiry} days remaining`}
                        </span>
                        ) • Remaining Lot Units: <strong className="text-white font-mono">{lot.current_quantity}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Policy Status</span>
                      <span className={`text-xs font-bold font-mono ${lot.is_sellable ? "text-emerald-400" : "text-rose-400"}`}>
                        {lot.is_sellable ? "ELIGIBLE FOR SALE" : "NOT FOR SALE (QUARANTINED)"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                    <p className="leading-relaxed">{lot.explanation}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
                    <span className="text-xs text-slate-300 font-semibold">
                      Required Action: <strong className={isExpired ? "text-rose-400" : "text-amber-300"}>{lot.recommended_action}</strong>
                    </span>

                    {isExpired ? (
                      <button
                        onClick={() => alert(`Batch ${lot.batch_number} written off and quarantined from sales inventory.`)}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs transition-colors"
                      >
                        Confirm Quarantine / Write-Off
                      </button>
                    ) : lot.suggested_discount_pct > 0 ? (
                      <button
                        onClick={() => alert(`Applied ${lot.suggested_discount_pct}% dynamic clearance markdown to Batch ${lot.batch_number} in POS registers.`)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors"
                      >
                        Apply {lot.suggested_discount_pct}% POS Markdown
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">FEFO Normal Placement</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: INTERACTIVE MANAGER CHATBOT */}
      {activeTab === 'CHAT' && (
        <div className="glass-card p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="font-bold text-sm text-white">SmartRetail Manager Operations Assistant</h3>
                <p className="text-[10px] text-slate-400">
                  Grounded in real database records • No raw SQL execution • Strict RBAC enforced
                </p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
              {engineName}
            </span>
          </div>

          {/* Message Stream */}
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
            {chatMessages.map((msg, idx) => {
              const isAi = msg.sender === "ai";
              return (
                <div
                  key={idx}
                  className={`flex gap-3 ${isAi ? "items-start" : "items-start justify-end"}`}
                >
                  {isAi && (
                    <div className="w-7 h-7 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl text-xs max-w-[85%] space-y-2 ${
                      isAi
                        ? "bg-slate-900 border border-slate-800 text-slate-200"
                        : "bg-purple-600 text-white font-medium"
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                    {/* Suggestions Chips */}
                    {msg.suggestions && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSendChat(sug)}
                            className="text-[10px] bg-slate-950 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-500/50 text-slate-300 px-2.5 py-1 rounded-lg transition-colors text-left"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Suggested Actions */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                        {msg.actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => setActivePage && setActivePage(act.target_page)}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-colors"
                          >
                            → {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isAi && (
                    <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {chatLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs pl-10">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>Consulting retail intelligence telemetry...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="flex items-center gap-2 pt-2 border-t border-slate-800"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about inventory, today's sales, expiry dates, or replenishment..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
