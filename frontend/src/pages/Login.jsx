import React, { useState } from 'react';
import { Store, ShieldCheck, Lock, User, ArrowRight, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Server } from 'lucide-react';
import { MOCK_USERS, STORE_INFO } from '../data/mockData';
import { authApi } from '../services/authApi';
import { API_BASE } from '../services/apiConfig';

export const Login = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [backendConnected, setBackendConnected] = useState(true);

  const roleCredentials = {
    ADMIN: { username: "admin", password: "admin123", desc: "Full Access & Staff Admin" },
    MANAGER: { username: "manager", password: "manager123", desc: "Inventory, Batches & POs" },
    CASHIER: { username: "cashier", password: "cashier123", desc: "POS Billing Terminal" },
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    const creds = roleCredentials[role];
    if (creds) {
      setUsername(creds.username);
      setPassword(creds.password);
    }
    setErrorMessage("");
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      // 1. Attempt live FastAPI backend login
      const response = await authApi.login(username, password);
      // Construct user payload with permissions
      const authenticatedUser = {
        id: response.user.id,
        name: response.user.full_name,
        username: response.user.username,
        email: response.user.email,
        role: response.user.role,
        status: response.user.is_active ? "Active" : "Inactive",
        token: response.access_token,
        avatar:
          response.user.role === "ADMIN"
            ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
            : response.user.role === "MANAGER"
            ? "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80"
            : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      };

      onLoginSuccess(authenticatedUser);
    } catch (err) {
      console.error("Login attempt failed:", err);
      // Check if it was a network error (backend offline) or bad credentials
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setErrorMessage(`Could not connect to backend. Operating in offline demo fallback mode.`);
        setBackendConnected(false);
        // Fallback to demo user if backend is offline
        setTimeout(() => {
          const fallbackUser = MOCK_USERS.find((u) => u.role === selectedRole) || MOCK_USERS[0];
          onLoginSuccess(fallbackUser);
        }, 1200);
      } else {
        setErrorMessage(err.message || "Invalid username or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl shadow-emerald-950/50 mb-2">
            <Store className="w-7 h-7 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">SMARTRETAIL</h1>
            <span className="text-xs font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-md">
              AI
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Enterprise Retail Decision Support & Sub-Second POS Billing System
          </p>
        </div>

        {/* Login Box */}
        <div className="glass-card p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                FastAPI JWT Authentication
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              STAGE 4 ACTIVE
            </span>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-bold">Authentication Notice</p>
                <p className="text-[11px] mt-0.5 text-rose-200">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Role Quick Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Quick Role Credentials
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { role: "ADMIN", title: "Admin", desc: "Full Control" },
                { role: "MANAGER", title: "Manager", desc: "Stock & POs" },
                { role: "CASHIER", title: "Cashier", desc: "POS Terminal" },
              ].map((tab) => (
                <button
                  key={tab.role}
                  type="button"
                  onClick={() => handleRoleSelect(tab.role)}
                  className={`p-2.5 rounded-xl text-center border transition-all ${
                    selectedRole === tab.role
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <p className="text-xs font-bold leading-tight">{tab.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{tab.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Staff Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <span className="text-[10px] text-slate-500">Bcrypt Salted & Hashed</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-xs font-bold mt-2 shadow-lg shadow-emerald-950/40"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying Credentials & Generating Token...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Sign In with JWT</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* Backend Connection Indicator */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>FastAPI Backend:</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold" style={{fontSize:'9px'}}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{API_BASE.replace('/api/v1','')}</span>
            </span>
          </div>
        </div>

        {/* Security Assurance Footer */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-[11px] text-slate-400 space-y-1">
          <p className="text-slate-300 font-semibold flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Role-Based Access Control (RBAC) Enforced</span>
          </p>
          <p className="text-[10px] text-slate-500">
            Tokens expire in 480 minutes • Securely signed with HS256 secret key
          </p>
        </div>
      </div>
    </div>
  );
};
