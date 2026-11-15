import React, { useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  Sparkles,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown
} from 'lucide-react';
import { DemoBadge } from '../common/DemoBadge';

export const Topbar = ({
  activePage,
  setActivePage,
  currentUser,
  setMobileOpen,
  onOpenAICopilot,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    {
      id: 1,
      type: "EXPIRY",
      title: "Critical Expiry Alert",
      desc: "Amul Milk Batch AML-2026-B1 expires in 5 days (10 packs remain).",
      time: "10 mins ago",
      urgent: true,
    },
    {
      id: 2,
      type: "STOCK",
      title: "Low Stock Warning",
      desc: "Britannia Good Day Cookies is down to 8 packs (Min threshold: 30).",
      time: "25 mins ago",
      urgent: true,
    },
    {
      id: 3,
      type: "AI",
      title: "AI Restock Generated",
      desc: "Smart replenishment draft ready for Gujarat Co-op (Amul).",
      time: "1 hour ago",
      urgent: false,
    },
  ];

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              SmartRetail System
            </span>
            <span className="text-slate-600">/</span>
            <h1 className="text-sm font-bold text-white capitalize">
              {activePage.replace('-', ' ')}
            </h1>
          </div>
        </div>

        {/* Global Demo Tag */}
        <div className="hidden md:block ml-2">
          <DemoBadge text="DEMO DATA ACTIVE" size="xs" />
        </div>
      </div>

      {/* Center: Quick Search Bar */}
      <div className="hidden lg:flex items-center max-w-md w-full mx-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products, barcodes, bills, customers... (Ctrl + K)"
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            readOnly
            onClick={() => alert("Search Bar Demo: In Stage 3, this triggers global index search across PostgreSQL tables.")}
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Launch POS Button */}
        {activePage !== 'pos' && (
          <button
            onClick={() => setActivePage('pos')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all active:scale-95"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Launch POS</span>
          </button>
        )}

        {/* AI Copilot Trigger */}
        <button
          onClick={onOpenAICopilot}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border border-purple-500/40 hover:border-purple-400 text-purple-200 text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95"
          title="Open AI Retail Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span className="hidden md:inline">AI Copilot</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Alerts & Intelligence</h4>
                  <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-bold">
                    3 New
                  </span>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Dismiss
                </button>
              </div>

              <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setShowNotifications(false);
                      if (n.type === 'EXPIRY' || n.type === 'STOCK') setActivePage('inventory');
                      if (n.type === 'AI') setActivePage('ai-insights');
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      {n.urgent ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-white">{n.title}</p>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{n.desc}</p>
                        <span className="text-[10px] text-slate-500 mt-1 block">{n.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-slate-800 bg-slate-950/50 text-center">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    setActivePage('ai-insights');
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  View All Actionable Intelligence →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <img
            src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"}
            alt={currentUser?.name}
            className="w-7 h-7 rounded-lg object-cover border border-slate-700"
          />
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-white leading-tight">{currentUser?.name}</p>
            <p className="text-[10px] text-emerald-400 font-bold">{currentUser?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
