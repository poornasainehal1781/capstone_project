import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Award,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  Loader2,
  Edit2,
  History,
  FileText
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { storeApi } from '../services/storeApi';

export const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSales, setCustomerSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storeApi.getCustomers(searchTerm);
      setCustomers(data || []);
    } catch (err) {
      console.warn("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim() || `${newCustomer.phone.trim()}@smartretail.in`,
        loyalty_points: 50,
        tier: "Silver"
      };
      await storeApi.createCustomer(payload);
      setIsAddModalOpen(false);
      setNewCustomer({ name: "", phone: "", email: "" });
      fetchCustomers();
    } catch (err) {
      alert(`Customer registration failed: ${err.message}`);
    }
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      await storeApi.updateCustomer(editingCustomer.id, {
        name: editingCustomer.name.trim(),
        phone: editingCustomer.phone.trim(),
        email: editingCustomer.email ? editingCustomer.email.trim() : null,
        tier: editingCustomer.tier
      });
      setIsEditModalOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (err) {
      alert(`Customer update failed: ${err.message}`);
    }
  };

  const handleViewHistory = async (cust) => {
    setSelectedCustomer(cust);
    setIsHistoryModalOpen(true);
    setLoadingSales(true);
    try {
      const sales = await storeApi.getCustomerSales(cust.id);
      setCustomerSales(sales || []);
    } catch (err) {
      console.warn("Failed to fetch customer purchase history:", err);
      setCustomerSales([]);
    } finally {
      setLoadingSales(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Customer Loyalty & CRM Directory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {customers.length} Members
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track customer purchase history, tier upgrades, and POS phone lookup rewards in PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Customers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Register Customer</span>
          </button>
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
            placeholder="Search by 10-digit mobile number or customer name..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      {loading && customers.length === 0 && (
        <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs">Loading customer loyalty database...</span>
        </div>
      )}

      {/* Customers Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Phone Number</th>
                <th className="p-4">Email</th>
                <th className="p-4 text-center">Loyalty Tier</th>
                <th className="p-4 text-center">Reward Points</th>
                <th className="p-4 text-center">Joined Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {customers.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No customers found matching the search query.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-white">{c.name}</p>
                      <span className="text-[10px] text-slate-500 font-mono">CUST-00{c.id}</span>
                    </td>

                    <td className="p-4 font-mono text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{c.phone}</span>
                      </div>
                    </td>

                    <td className="p-4 text-slate-400 font-mono">{c.email || '—'}</td>

                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          c.tier === 'Platinum'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : c.tier === 'Gold'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        <Award className="w-3 h-3" />
                        <span>{c.tier}</span>
                      </span>
                    </td>

                    <td className="p-4 text-center font-bold text-emerald-400 font-mono">
                      {c.loyalty_points ?? c.loyaltyPoints ?? 0} Pts
                    </td>

                    <td className="p-4 text-center text-slate-400 font-mono">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : "Active Member"}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewHistory(c)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
                          title="View Invoices"
                        >
                          <History className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Purchases</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomer({ ...c });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Customer"
        subtitle="Adds customer phone number for loyalty point accumulation and SMS receipts"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Customer Full Name</label>
            <input
              type="text"
              required
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              placeholder="e.g. Ramesh Sharma"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">10-Digit Mobile Phone</label>
            <input
              type="tel"
              required
              maxLength={15}
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="9876543210"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Email Address (Optional)</label>
            <input
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              placeholder="r.sharma@gmail.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
              Save Member (+50 Bonus Pts)
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCustomer(null);
        }}
        title="Edit Customer Profile"
        subtitle={`Updating profile for customer #${editingCustomer?.id}`}
      >
        {editingCustomer && (
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Customer Full Name</label>
              <input
                type="text"
                required
                value={editingCustomer.name}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Mobile Phone</label>
              <input
                type="tel"
                required
                value={editingCustomer.phone}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <input
                type="email"
                value={editingCustomer.email || ""}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Loyalty Tier</label>
              <select
                value={editingCustomer.tier}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, tier: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCustomer(null);
                }}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs">
                Update Customer
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* View Customer Purchase History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedCustomer(null);
          setCustomerSales([]);
        }}
        title={`Purchase History: ${selectedCustomer?.name || 'Customer'}`}
        subtitle={`Registered Phone: ${selectedCustomer?.phone} • ${selectedCustomer?.tier} Tier (${selectedCustomer?.loyalty_points || 0} Points)`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {loadingSales ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="text-xs">Loading transaction records from database...</span>
            </div>
          ) : customerSales.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No previous purchase records found for this customer.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {customerSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{sale.invoice_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sale.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {sale.status}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ₹{parseFloat(sale.grand_total).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Date: {new Date(sale.created_at).toLocaleString()}</span>
                    <span>Paid via: <strong className="text-slate-300">{sale.payment_method}</strong></span>
                  </div>

                  {sale.items && sale.items.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Items Purchased:</span>
                      <div className="space-y-1">
                        {sale.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-300 text-[11px]">
                            <span>{it.quantity}x {it.product_name}</span>
                            <span className="font-mono text-slate-400">₹{parseFloat(it.line_total).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsHistoryModalOpen(false);
                setSelectedCustomer(null);
                setCustomerSales([]);
              }}
              className="btn-secondary text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
