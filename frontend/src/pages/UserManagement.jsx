import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Plus,
  Search,
  UserCheck,
  Key,
  Lock,
  Mail,
  User,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { storeApi } from '../services/storeApi';

export const UserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [newUser, setNewUser] = useState({
    fullName: "",
    username: "",
    email: "",
    role: "CASHIER",
    password: "",
  });

  const isAdmin = currentUser?.role === "ADMIN";

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await storeApi.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.warn("Failed to fetch staff accounts:", err);
      setError(err.message || "Failed to load staff accounts.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    const s = searchTerm.toLowerCase();
    return (
      (u.full_name || u.name || "").toLowerCase().includes(s) ||
      (u.username || "").toLowerCase().includes(s) ||
      (u.role || "").toLowerCase().includes(s) ||
      (u.email || "").toLowerCase().includes(s)
    );
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        full_name: newUser.fullName.trim(),
        username: newUser.username.trim().toLowerCase(),
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password,
        role: newUser.role,
        is_active: true
      };
      await storeApi.createUser(payload);
      setIsAddModalOpen(false);
      setNewUser({ fullName: "", username: "", email: "", role: "CASHIER", password: "" });
      alert(`Staff account provisioned successfully for ${payload.full_name}!`);
      fetchUsers();
    } catch (err) {
      alert(`Failed to create staff account: ${err.message}`);
    }
  };

  const handleToggleStatus = async (userId) => {
    setActionLoadingId(userId);
    try {
      await storeApi.toggleUserStatus(userId);
      fetchUsers();
    } catch (err) {
      alert(`Failed to toggle account status: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="glass-card p-12 text-center text-slate-300 space-y-4 max-w-lg mx-auto mt-12 border border-rose-500/30">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Administrator Access Required</h3>
        <p className="text-xs text-slate-400">
          Staff administration and credential management is strictly restricted to users with the <strong className="text-emerald-400">ADMIN</strong> role.
        </p>
        <p className="text-[11px] text-slate-500">
          Your current session is logged in as <strong className="text-white">{currentUser?.name}</strong> ({currentUser?.role}).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <span>Staff Credentials & Role Administration</span>
            </h2>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              ADMIN ACCESS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Provision cashier terminal operators, inventory managers, and executive administrative privileges in PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Provision Staff Account</span>
          </button>
        </div>
      </div>

      {/* RBAC Role Capabilities Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-400 uppercase">ADMIN ROLE</h4>
            <span className="text-[10px] text-slate-400">Tier 1</span>
          </div>
          <p className="text-xs text-slate-300">
            Full privileges: User provisioning, financial audit reports, category and tax rate modifications, and system configurations.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-400 uppercase">MANAGER ROLE</h4>
            <span className="text-[10px] text-slate-400">Tier 2</span>
          </div>
          <p className="text-xs text-slate-300">
            Operational floor control: Inventory stock reconciliations, purchase order approvals, dynamic markdown discounts, and AI restocking forecasts.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-purple-400 uppercase">CASHIER ROLE</h4>
            <span className="text-[10px] text-slate-400">Tier 3</span>
          </div>
          <p className="text-xs text-slate-300">
            Register frontline: Barcode scanning, cart building, customer phone loyalty lookup, and invoice checkout generation.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search staff accounts by name, username, or role..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      {loading && users.length === 0 && (
        <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs">Loading staff accounts directory...</span>
        </div>
      )}

      {/* Staff Directory Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4">Staff Member</th>
                <th className="p-4">Username</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4 text-center">Account Status</th>
                <th className="p-4 text-center">Registered Date</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No staff accounts match your search filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const isActive = u.is_active ?? (u.status === "Active");

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                            {(u.full_name || u.name || "U")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white flex items-center gap-1.5">
                              <span>{u.full_name || u.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                  YOU
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-mono font-bold text-slate-200">
                        @{u.username}
                      </td>

                      <td className="p-4">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border inline-block ${
                            u.role === 'ADMIN'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : u.role === 'MANAGER'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <span>{isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      <td className="p-4 text-center text-slate-400 font-mono">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "Active Staff"}
                      </td>

                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          disabled={isCurrent || actionLoadingId === u.id}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            isCurrent
                              ? 'text-slate-600 cursor-not-allowed'
                              : isActive
                              ? 'bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {actionLoadingId === u.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                          ) : isActive ? (
                            'Deactivate'
                          ) : (
                            'Activate'
                          )}
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

      {/* Provision Staff Account Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Provision Supermarket Staff Account"
        subtitle="Issues hashed credentials and assigns role-based permissions"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Staff Full Name</label>
            <input
              type="text"
              required
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              placeholder="e.g. Suresh Verma"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Username (Login ID)</label>
              <input
                type="text"
                required
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="cashier_suresh"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Role Authority</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
              >
                <option value="CASHIER">CASHIER (Terminal POS Only)</option>
                <option value="MANAGER">MANAGER (Inventory, Restock & Reports)</option>
                <option value="ADMIN">ADMIN (Full System Privileges)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <input
              type="email"
              required
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="suresh.v@smartretail.in"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Initial Secure Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="Minimum 6 characters"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
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
              Provision Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
