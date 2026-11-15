import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Barcode,
  Printer,
  Edit2,
  Trash2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Copy,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { storeApi } from '../services/storeApi';

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState(null);

  // Form State for Add Product
  const [newProduct, setNewProduct] = useState({
    name: "",
    barcode: "890" + Math.floor(1000000000 + Math.random() * 9000000000),
    sku: "",
    categoryId: 1,
    costPrice: "",
    mrp: "",
    taxRate: "5",
    unit: "Pack",
    initialStock: "25",
    minStockLevel: "20",
    isPerishable: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, cats] = await Promise.all([
        storeApi.getProducts(searchTerm, selectedCategory === "ALL" ? null : selectedCategory),
        storeApi.getCategories()
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
      if (cats && cats.length > 0 && !newProduct.categoryId) {
        setNewProduct(prev => ({ ...prev, categoryId: cats[0].id }));
      }
    } catch (err) {
      console.warn("Failed to fetch products/categories from backend:", err);
      setError(err.message || "Failed to load product catalog.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newProduct.name.trim(),
        barcode: newProduct.barcode.trim(),
        sku: newProduct.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        category_id: parseInt(newProduct.categoryId) || (categories[0]?.id || 1),
        cost_price: parseFloat(newProduct.costPrice) || 0,
        selling_price: parseFloat(newProduct.mrp) || 0,
        tax_rate: parseFloat(newProduct.taxRate) || 5,
        unit: newProduct.unit,
        current_stock: parseInt(newProduct.initialStock) || 0,
        min_stock_level: parseInt(newProduct.minStockLevel) || 15,
        is_perishable: newProduct.isPerishable,
      };

      await storeApi.createProduct(payload);
      setIsAddModalOpen(false);
      setNewProduct({
        name: "",
        barcode: "890" + Math.floor(1000000000 + Math.random() * 9000000000),
        sku: "",
        categoryId: categories[0]?.id || 1,
        costPrice: "",
        mrp: "",
        taxRate: "5",
        unit: "Pack",
        initialStock: "25",
        minStockLevel: "20",
        isPerishable: false,
      });
      fetchData();
    } catch (err) {
      alert(`Product creation failed: ${err.message}`);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await storeApi.updateProduct(editingProduct.id, {
        name: editingProduct.name,
        cost_price: parseFloat(editingProduct.cost_price),
        selling_price: parseFloat(editingProduct.selling_price),
        min_stock_level: parseInt(editingProduct.min_stock_level),
        tax_rate: parseFloat(editingProduct.tax_rate),
        unit: editingProduct.unit
      });
      setIsEditModalOpen(false);
      setEditingProduct(null);
      fetchData();
    } catch (err) {
      alert(`Product update failed: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (prod) => {
    if (!window.confirm(`Are you sure you want to delete SKU "${prod.name}"?`)) return;
    try {
      await storeApi.deleteProduct(prod.id);
      fetchData();
    } catch (err) {
      alert(`Cannot delete product: ${err.message}`);
    }
  };

  const openEdit = (p) => {
    setEditingProduct({ ...p });
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            <span>Product Master Catalog</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {products.length} Items Active
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage SKU barcodes, MRP pricing, GST classifications, and threshold safety levels in PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product name, barcode, or SKU..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === "ALL"
                ? "bg-emerald-500 text-slate-950 shadow-sm font-bold"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === c.id
                  ? "bg-emerald-500 text-slate-950 shadow-sm font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && products.length === 0 && (
        <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs">Loading live product master catalog...</span>
        </div>
      )}

      {/* Products Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4">Product / SKU</th>
                <th className="p-4">Barcode (EAN-13)</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-right">Cost (₹)</th>
                <th className="p-4 text-right">MRP (₹)</th>
                <th className="p-4 text-right">Margin</th>
                <th className="p-4 text-center">Tax</th>
                <th className="p-4 text-center">Current Stock</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {products.length === 0 && !loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const cost = Number(p.cost_price || p.costPrice || 0);
                  const mrp = Number(p.selling_price || p.mrp || 0);
                  const marginPct = mrp > 0 ? (((mrp - cost) / mrp) * 100).toFixed(1) : 0;
                  const isLow = (p.current_stock ?? p.currentStock ?? 0) <= (p.min_stock_level ?? p.minStockLevel ?? 10);

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-bold text-white">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              SKU: {p.sku || `SKU-${p.id}`} {p.is_perishable ? "• Perishable" : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span>{p.barcode}</span>
                          <button
                            onClick={() => setSelectedBarcodeProduct(p)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Generate Printable Barcode"
                          >
                            <Barcode className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                        </div>
                      </td>

                      <td className="p-4 text-slate-300">
                        {p.category_name || p.category?.name || "General"}
                      </td>

                      <td className="p-4 text-right text-slate-400 font-mono">
                        ₹{cost.toFixed(2)}
                      </td>

                      <td className="p-4 text-right font-bold text-white font-mono">
                        ₹{mrp.toFixed(2)}
                      </td>

                      <td className="p-4 text-right">
                        <span className="font-mono text-emerald-400 font-semibold">
                          {marginPct}%
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {p.tax_rate ?? p.taxRate}% GST
                        </span>
                      </td>

                      <td className="p-4 text-center font-mono">
                        <span
                          className={`font-bold px-2 py-0.5 rounded ${
                            isLow
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "text-slate-200"
                          }`}
                        >
                          {p.current_stock ?? p.currentStock ?? 0} {p.unit || "Pack"}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Retail Product"
        subtitle="Registers SKU in the Master Inventory & Barcode Table"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Product Title & Brand</label>
            <input
              type="text"
              required
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              placeholder="e.g. Amul Salted Butter 500g"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">EAN-13 Barcode</label>
              <input
                type="text"
                required
                value={newProduct.barcode}
                onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Category</label>
              <select
                value={newProduct.categoryId}
                onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Cost Price (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newProduct.costPrice}
                onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value })}
                placeholder="45.00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Selling MRP (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newProduct.mrp}
                onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })}
                placeholder="60.00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">GST Tax Rate (%)</label>
              <select
                value={newProduct.taxRate}
                onChange={(e) => setNewProduct({ ...newProduct, taxRate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="0">0% (Exempt)</option>
                <option value="5">5% (Essentials)</option>
                <option value="12">12% (Standard I)</option>
                <option value="18">18% (Standard II)</option>
                <option value="28">28% (Luxury)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Unit of Measure</label>
              <select
                value={newProduct.unit}
                onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Pack">Pack</option>
                <option value="Bottle">Bottle</option>
                <option value="Pouch">Pouch</option>
                <option value="Can">Can</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="L">Litre (L)</option>
                <option value="pcs">Pieces</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Initial Stock</label>
              <input
                type="number"
                min="0"
                value={newProduct.initialStock}
                onChange={(e) => setNewProduct({ ...newProduct, initialStock: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Min Safety ROP</label>
              <input
                type="number"
                min="1"
                value={newProduct.minStockLevel}
                onChange={(e) => setNewProduct({ ...newProduct, minStockLevel: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="perishable"
              checked={newProduct.isPerishable}
              onChange={(e) => setNewProduct({ ...newProduct, isPerishable: e.target.checked })}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <label htmlFor="perishable" className="text-xs text-slate-300 cursor-pointer">
              Perishable Item (Enables FEFO Batch Expiry Tracking)
            </label>
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
              Save Product to PostgreSQL
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      {isEditModalOpen && editingProduct && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Product: ${editingProduct.name}`}
          subtitle={`Update pricing, safety stock, and GST rate for SKU-${editingProduct.id}`}
        >
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Product Title</label>
              <input
                type="text"
                required
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Cost Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingProduct.cost_price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Selling Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingProduct.selling_price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, selling_price: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Min Stock Safety Threshold</label>
                <input
                  type="number"
                  required
                  value={editingProduct.min_stock_level}
                  onChange={(e) => setEditingProduct({ ...editingProduct, min_stock_level: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">GST Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingProduct.tax_rate}
                  onChange={(e) => setEditingProduct({ ...editingProduct, tax_rate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
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

      {/* Barcode Print Preview Modal */}
      {selectedBarcodeProduct && (
        <Modal
          isOpen={!!selectedBarcodeProduct}
          onClose={() => setSelectedBarcodeProduct(null)}
          title="Printable Shelf & Barcode Label"
          subtitle="Ready for thermal label printers (Zebra, TSC, Honeywell)"
        >
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-xl text-black border border-slate-300 max-w-sm mx-auto shadow-md">
              <div className="text-center space-y-1">
                <p className="font-extrabold text-sm truncate">{selectedBarcodeProduct.name}</p>
                <p className="text-[10px] text-gray-500">{selectedBarcodeProduct.category_name || "General"}</p>
              </div>

              <div className="my-3 py-2 bg-gray-50 flex flex-col items-center justify-center border border-dashed border-gray-300 rounded">
                {/* SVG Barcode Visualization */}
                <div className="flex items-center gap-[2px] h-12">
                  {selectedBarcodeProduct.barcode.split("").map((digit, i) => (
                    <div
                      key={i}
                      className="bg-black h-full"
                      style={{ width: `${(parseInt(digit) % 3) + 1.5}px` }}
                    />
                  ))}
                </div>
                <p className="font-mono text-xs tracking-widest mt-1 font-bold">{selectedBarcodeProduct.barcode}</p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200">
                <span className="font-bold">MRP (Incl. taxes):</span>
                <span className="text-lg font-black font-mono">₹{Number(selectedBarcodeProduct.selling_price).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedBarcodeProduct(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                  setSelectedBarcodeProduct(null);
                }}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Shelf Label</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
