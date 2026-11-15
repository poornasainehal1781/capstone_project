import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  Clock,
  Star,
  FileText,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Edit2,
  Trash2
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { storeApi } from '../services/storeApi';

export const Suppliers = ({ setActivePage }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    leadTimeDays: "3",
    terms: "Net 30",
  });

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storeApi.getSuppliers(searchTerm);
      setSuppliers(data || []);
    } catch (err) {
      console.warn("Failed to fetch suppliers:", err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newSupplier.name.trim(),
        contact_person: newSupplier.contact.trim(),
        phone: newSupplier.phone.trim(),
        email: newSupplier.email.trim(),
        lead_time_days: parseInt(newSupplier.leadTimeDays) || 3,
        credit_terms: newSupplier.terms,
        is_active: true
      };
      await storeApi.createSupplier(payload);
      setIsAddModalOpen(false);
      setNewSupplier({ name: "", contact: "", phone: "", email: "", leadTimeDays: "3", terms: "Net 30" });
      fetchSuppliers();
    } catch (err) {
      alert(`Supplier creation failed: ${err.message}`);
    }
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();
    if (!editingSupplier) return;
    try {
      await storeApi.updateSupplier(editingSupplier.id, {
        name: editingSupplier.name.trim(),
        contact_person: (editingSupplier.contact_person || editingSupplier.contact || "").trim(),
        phone: editingSupplier.phone.trim(),
        email: editingSupplier.email.trim(),
        lead_time_days: parseInt(editingSupplier.lead_time_days || editingSupplier.leadTimeDays || 3),
        credit_terms: editingSupplier.credit_terms || editingSupplier.terms || "Net 30"
      });
      setIsEditModalOpen(false);
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (err) {
      alert(`Supplier update failed: ${err.message}`);
    }
  };

  const handleDeleteSupplier = async (supp) => {
    if (!window.confirm(`Delete supplier "${supp.name}"?\nIf this vendor has linked purchase orders, the account will be safely deactivated.`)) return;
    try {
      await storeApi.deleteSupplier(supp.id);
      fetchSuppliers();
    } catch (err) {
      alert(`Supplier action failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-400" />
            <span>Supplier & Vendor Partner Hub</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {suppliers.length} Vendors Active
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            FMCG distributors, manufacturer delivery agreements, and lead times utilized by AI restocking formulas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSuppliers}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Suppliers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Supplier</span>
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
            placeholder="Search suppliers by name, contact, or email..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {loading && suppliers.length === 0 && (
        <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-xs">Loading supplier vendor profiles...</span>
        </div>
      )}

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers.length === 0 && !loading ? (
          <div className="col-span-full glass-card p-8 text-center text-slate-500">
            No suppliers found matching the search criteria.
          </div>
        ) : (
          suppliers.map((supp) => (
            <div
              key={supp.id}
              className="glass-card p-5 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-xs leading-tight line-clamp-1">{supp.name}</h3>
                      <p className="text-[10px] text-slate-400">Rep: {supp.contact_person || supp.contact}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Active Partner
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono">{supp.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{supp.email}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Lead Time:</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {supp.lead_time_days ?? supp.leadTimeDays ?? 3} Days
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Payment Terms:</span>
                    <span className="font-bold text-slate-200">{supp.credit_terms || supp.terms || "Net 30"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">ID: SUPP-0{supp.id}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingSupplier({
                        id: supp.id,
                        name: supp.name,
                        contact_person: supp.contact_person || supp.contact || "",
                        phone: supp.phone || "",
                        email: supp.email || "",
                        lead_time_days: supp.lead_time_days ?? supp.leadTimeDays ?? 3,
                        credit_terms: supp.credit_terms || supp.terms || "Net 30"
                      });
                      setIsEditModalOpen(true);
                    }}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Edit Supplier"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(supp)}
                    className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                    title="Delete Supplier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setActivePage && setActivePage('purchases')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors ml-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Issue PO</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register Supplier Partner"
        subtitle="Adds vendor details and delivery lead time for automated replenishment"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Supplier / Company Name</label>
            <input
              type="text"
              required
              value={newSupplier.name}
              onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
              placeholder="e.g. Hindustan Unilever Logistics"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Contact Representative</label>
              <input
                type="text"
                required
                value={newSupplier.contact}
                onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                placeholder="Rajesh Nair"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Phone Number</label>
              <input
                type="tel"
                required
                value={newSupplier.phone}
                onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                placeholder="+91 98450 11223"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <input
                type="email"
                required
                value={newSupplier.email}
                onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                placeholder="orders@hul-logistics.in"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                max="60"
                required
                value={newSupplier.leadTimeDays}
                onChange={(e) => setNewSupplier({ ...newSupplier, leadTimeDays: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Credit / Payment Terms</label>
            <select
              value={newSupplier.terms}
              onChange={(e) => setNewSupplier({ ...newSupplier, terms: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="Immediate">Immediate / Advance</option>
              <option value="Net 15">Net 15 Days</option>
              <option value="Net 30">Net 30 Days</option>
              <option value="Net 45">Net 45 Days</option>
            </select>
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
              Save Supplier to PostgreSQL
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Supplier Modal */}
      {isEditModalOpen && editingSupplier && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingSupplier(null);
          }}
          title={`Edit Supplier #${editingSupplier.id}`}
          subtitle="Update vendor delivery terms, representative contacts, and parameters"
        >
          <form onSubmit={handleUpdateSupplier} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Supplier Name</label>
              <input
                type="text"
                required
                value={editingSupplier.name}
                onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Contact Representative</label>
                <input
                  type="text"
                  required
                  value={editingSupplier.contact_person || ""}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_person: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={editingSupplier.phone}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={editingSupplier.email}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Lead Time (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  required
                  value={editingSupplier.lead_time_days}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, lead_time_days: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Credit / Payment Terms</label>
              <select
                value={editingSupplier.credit_terms || "Net 30"}
                onChange={(e) => setEditingSupplier({ ...editingSupplier, credit_terms: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Immediate">Immediate / Advance</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 45">Net 45 Days</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingSupplier(null);
                }}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs">
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
