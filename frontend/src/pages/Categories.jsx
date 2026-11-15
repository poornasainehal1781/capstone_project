import React, { useState, useEffect, useCallback } from 'react';
import {
  Tags,
  Plus,
  Search,
  Package,
  Layers,
  Edit2,
  Trash2,
  FolderTree,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { storeApi } from '../services/storeApi';

export const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    code: "",
    description: "",
  });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storeApi.getCategories();
      setCategories(data || []);
    } catch (err) {
      console.warn("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.code || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newCategory.name.trim(),
        code: (newCategory.code.trim() || `CAT-${newCategory.name.slice(0, 4)}`).toUpperCase(),
        description: newCategory.description.trim()
      };
      await storeApi.createCategory(payload);
      setIsAddModalOpen(false);
      setNewCategory({ name: "", code: "", description: "" });
      fetchCategories();
    } catch (err) {
      alert(`Category creation failed: ${err.message}`);
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      await storeApi.updateCategory(editingCategory.id, {
        name: editingCategory.name.trim(),
        code: editingCategory.code.trim().toUpperCase(),
        description: editingCategory.description ? editingCategory.description.trim() : null
      });
      setIsEditModalOpen(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (err) {
      alert(`Category update failed: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"?\nNote: Deletion will be rejected if products are assigned to this department.`)) return;
    try {
      await storeApi.deleteCategory(cat.id);
      fetchCategories();
    } catch (err) {
      alert(`Cannot delete category: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Tags className="w-6 h-6 text-emerald-400" />
            <span>Supermarket Department & Category Directory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {categories.length} Departments
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Structure aisles, categorize products, and configure departmental tax rules in PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCategories}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Categories"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Category</span>
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
            placeholder="Search categories or department codes..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {loading && categories.length === 0 && (
        <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs">Loading department catalog...</span>
        </div>
      )}

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className="glass-card p-5 space-y-4 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {cat.code}
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">
                Aisle Active
              </span>
            </div>

            <p className="text-xs text-slate-400 min-h-[36px] line-clamp-2">
              {cat.description || "Supermarket department classification for SKU organization."}
            </p>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-semibold text-[11px]">PostgreSQL Active</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory({ ...cat });
                    setIsEditModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Edit Category"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-800/40 transition-colors"
                  title="Delete Category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCategory(null);
        }}
        title="Edit Supermarket Department"
        subtitle={`Updating category #${editingCategory?.id} (${editingCategory?.code})`}
      >
        {editingCategory && (
          <form onSubmit={handleUpdateCategory} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Department Name</label>
              <input
                type="text"
                required
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Category Code</label>
              <input
                type="text"
                required
                value={editingCategory.code}
                onChange={(e) => setEditingCategory({ ...editingCategory, code: e.target.value.toUpperCase() })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <textarea
                rows={3}
                value={editingCategory.description || ""}
                onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCategory(null);
                }}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs">
                Update Category
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Supermarket Category"
        subtitle="Registers a new department classification for inventory mapping"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Department Name</label>
            <input
              type="text"
              required
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder="e.g. Frozen Foods & Ice Creams"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Category Code (Short)</label>
            <input
              type="text"
              required
              value={newCategory.code}
              onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value.toUpperCase() })}
              placeholder="e.g. CAT-FROZEN"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <textarea
              rows={3}
              value={newCategory.description}
              onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
              placeholder="Department notes, storage requirements, temperature zones..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
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
              Save Category to Database
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
