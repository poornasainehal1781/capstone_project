import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Layers,
  Users,
  Truck,
  ClipboardList,
  TrendingUp,
  BrainCircuit,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Store,
  Sparkles,
  X
} from 'lucide-react';
import { STORE_INFO } from '../../data/mockData';

export const NAV_ITEMS = [
  { section: "Main Operations", items: [
    { id: "pos", label: "POS Billing", icon: ShoppingCart, badge: "Live POS", highlight: true },
    { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  ]},
  { section: "Catalog & Stock", items: [
    { id: "products", label: "Products Catalog", icon: Package },
    { id: "categories", label: "Categories", icon: Tags },
    { id: "inventory", label: "Inventory & Batches", icon: Layers, alertCount: 3 },
  ]},
  { section: "Commerce & Relations", items: [
    { id: "customers", label: "Customers CRM", icon: Users },
    { id: "suppliers", label: "Suppliers Hub", icon: Truck },
    { id: "purchases", label: "Purchase Orders", icon: ClipboardList },
  ]},
  { section: "Intelligence & Analytics", items: [
    { id: "ai-insights", label: "AI Decision Support", icon: BrainCircuit, badge: "AI Active", isAi: true },
    { id: "reports", label: "Sales & Analytics", icon: TrendingUp },
  ]},
  { section: "Administration", items: [
    { id: "users", label: "User Management", icon: ShieldCheck, roleRequired: "ADMIN" },
  ]},
];

export const Sidebar = ({
  activePage,
  setActivePage,
  currentUser,
  onLogout,
  onSwitchUser,
  mobileOpen,
  setMobileOpen,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">SMARTRETAIL</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{STORE_INFO.branch}</p>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_ITEMS.map((group, gIdx) => {
            // Filter items based on current user role
            const visibleItems = group.items.filter((item) => {
              if (item.roleRequired && currentUser?.role !== item.roleRequired) {
                return false;
              }
              // For Cashiers, hide backend management sections
              if (currentUser?.role === "CASHIER") {
                if (["inventory", "suppliers", "purchases", "reports", "users"].includes(item.id)) {
                  return false;
                }
              }
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {group.section}
                </p>

                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActivePage(item.id);
                        setMobileOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                        isActive
                          ? item.isAi
                            ? "bg-gradient-to-r from-purple-900/60 to-indigo-900/40 text-purple-200 border border-purple-500/40 shadow-sm"
                            : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive
                              ? item.isAi
                                ? "text-purple-400"
                                : "text-emerald-400"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              item.highlight
                                ? "bg-emerald-500 text-slate-950 font-extrabold"
                                : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.alertCount && (
                          <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold flex items-center justify-center border border-rose-500/30">
                            {item.alertCount}
                          </span>
                        )}
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Profile & Demo Switcher */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"}
                alt={currentUser?.name}
                className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
              />
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{currentUser?.name}</p>
                <span className="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {currentUser?.role}
                </span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Demo Switcher */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Demo Role:</span>
            <div className="flex items-center gap-1">
              {["ADMIN", "MANAGER", "CASHIER"].map((role) => (
                <button
                  key={role}
                  onClick={() => onSwitchUser(role)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    currentUser?.role === role
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  {role[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
