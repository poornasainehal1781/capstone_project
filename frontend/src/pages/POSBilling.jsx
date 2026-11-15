import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Barcode,
  Plus,
  Minus,
  Trash2,
  UserCheck,
  CreditCard,
  Printer,
  RotateCcw,
  ShoppingCart,
  Tag,
  Camera,
  AlertCircle,
  RefreshCw,
  X,
  History
} from 'lucide-react';
import { posApi } from '../services/posApi';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { BarcodeScannerModal } from '../components/pos/BarcodeScannerModal';

export const POSBilling = ({ currentUser }) => {
  // Catalog State from Database
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // POS Cart State
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // Customer CRM State
  const [customerPhone, setCustomerPhone] = useState("9880123456");
  const [customer, setCustomer] = useState(null);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [customerLookupMessage, setCustomerLookupMessage] = useState(null);
  const [applyPoints, setApplyPoints] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null); // 'SAVE50'

  // Scanner Feedback & Modals
  const [scannerBeep, setScannerBeep] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastScanStatus, setLastScanStatus] = useState(null);
  const [stockWarning, setStockWarning] = useState(null);

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  // Recent Sales History Drawer
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const barcodeInputRef = useRef(null);

  // Customer Loyalty Lookup by Mobile
  const handleCustomerLookup = useCallback(async (phoneToLookup = null) => {
    const targetPhone = (phoneToLookup || customerPhone).trim();
    if (!targetPhone) return;

    setCustomerLookupLoading(true);
    setCustomerLookupMessage(null);

    try {
      const found = await posApi.lookupCustomerByPhone(targetPhone);
      if (found) {
        setCustomer(found);
        setCustomerLookupMessage({ type: 'success', text: `Verified: ${found.name} (${found.tier} Tier)` });
      } else {
        const guest = {
          id: 999,
          name: "Retail Guest Shopper",
          phone: targetPhone,
          loyalty_points: 0,
          tier: "Silver"
        };
        setCustomer(guest);
        setCustomerLookupMessage({ type: 'info', text: `Unregistered mobile. Created guest shopper profile.` });
      }
    } catch (err) {
      console.warn("Customer lookup failed:", err);
    } finally {
      setCustomerLookupLoading(false);
    }
  }, [customerPhone]);

  // Load Real Catalog from PostgreSQL on Mount
  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [prods, cats] = await Promise.all([
        posApi.searchProducts("", null, 100),
        posApi.listCategories()
      ]);
      setProducts(prods);
      setCategories(cats);

      if (prods.length > 0 && cart.length === 0) {
        const first = prods[0];
        setCart([
          {
            ...first,
            quantity: 1,
            batchAssigned: `BATCH-${first.id}`,
            selling_price: parseFloat(first.selling_price),
            tax_rate: parseFloat(first.tax_rate)
          }
        ]);
      }
    } catch (err) {
      console.error("Failed to load catalog from database:", err);
    } finally {
      setLoadingCatalog(false);
    }
  }, [cart.length]);

  useEffect(() => {
    fetchCatalog();
    handleCustomerLookup("9880123456");
  }, [fetchCatalog, handleCustomerLookup]);

  // Fetch Recent Sales
  const fetchSalesHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await posApi.listSales({ limit: 15 });
      setRecentSales(data);
    } catch (err) {
      console.warn("Failed to fetch sales history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Add Item to Cart with Stock Boundary Validation
  const addToCart = (product) => {
    setStockWarning(null);

    // Audio / visual flash
    setScannerBeep(true);
    setTimeout(() => setScannerBeep(false), 250);

    const price = parseFloat(product.selling_price || product.mrp || 0);
    const tax = parseFloat(product.tax_rate || product.taxRate || 5.0);
    const availableStock = product.current_stock ?? product.currentStock ?? 999;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > availableStock) {
          setStockWarning(`Stock Limit: Only ${availableStock} ${product.unit || 'units'} available for "${product.name}".`);
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      if (availableStock <= 0) {
        setStockWarning(`Out of Stock: "${product.name}" currently has 0 stock.`);
        return prev;
      }

      return [
        ...prev,
        {
          ...product,
          selling_price: price,
          tax_rate: tax,
          current_stock: availableStock,
          quantity: 1,
          batchAssigned: product.activeBatches?.[0]?.batchNo || `BATCH-${product.id}`,
        },
      ];
    });
  };

  // Handle Barcode Scan from Camera or Wedge
  const handleBarcodeDetection = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Check local catalog first for instant response
    const localMatch = products.find(
      (p) => p.barcode === cleanCode || (p.sku && p.sku.toLowerCase() === cleanCode.toLowerCase())
    );

    if (localMatch) {
      addToCart(localMatch);
      setLastScanStatus({
        type: 'success',
        message: `Added "${localMatch.name}" (₹${parseFloat(localMatch.selling_price).toFixed(2)})`,
        code: cleanCode
      });
      return;
    }

    // Query backend API for exact barcode
    try {
      const product = await posApi.lookupBarcode(cleanCode);
      if (product) {
        addToCart(product);
        setLastScanStatus({
          type: 'success',
          message: `Found SKU: "${product.name}" (₹${parseFloat(product.selling_price).toFixed(2)})`,
          code: cleanCode
        });
      } else {
        setLastScanStatus({
          type: 'error',
          message: `Barcode "${cleanCode}" not found in supermarket database.`,
          code: cleanCode
        });
      }
    } catch (err) {
      setLastScanStatus({
        type: 'error',
        message: `Lookup error: ${err.message}`,
        code: cleanCode
      });
    }
  };

  // Search Input Handler (Live autocomplete & Barcode submit)
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    handleBarcodeDetection(barcodeInput.trim());
    setBarcodeInput("");
    setSearchResults([]);
  };

  // Instant Search Autocomplete
  useEffect(() => {
    if (!barcodeInput.trim()) {
      setSearchResults([]);
      return;
    }

    const term = barcodeInput.toLowerCase().trim();
    const matches = products.filter(
      (p) =>
        p.barcode.includes(term) ||
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term))
    );
    setSearchResults(matches.slice(0, 5));
  }, [barcodeInput, products]);

  // Quantity Adjustments with Stock Boundary Checks
  const updateQty = (id, delta) => {
    setStockWarning(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            const availableStock = item.current_stock ?? 999;
            if (newQty > availableStock) {
              setStockWarning(`Cannot exceed stock: only ${availableStock} available for "${item.name}".`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeItem = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    if (cart.length > 0 && window.confirm("Clear all items from current POS cart?")) {
      setCart([]);
      setStockWarning(null);
    }
  };

  // Accurate Billing Calculations
  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.selling_price || item.mrp || 0) * item.quantity), 0);
  const tax = cart.reduce((sum, item) => {
    const rate = parseFloat(item.tax_rate || item.taxRate || 5.0);
    const lineGross = parseFloat(item.selling_price || item.mrp || 0) * item.quantity;
    return sum + (lineGross * rate) / 100;
  }, 0);

  const discountFromPromo = appliedPromo === 'SAVE50' ? Math.min(50, subtotal) : 0;
  const discountFromPoints = applyPoints && customer ? Math.min(customer.loyalty_points || customer.loyaltyPoints || 0, 100) : 0;
  const totalDiscount = discountFromPromo + discountFromPoints;
  const grandTotal = Math.max(0, subtotal + tax - totalDiscount);

  // Settlement Success Handler
  const handlePaymentSuccess = (saleData) => {
    setLastReceipt(saleData);
    setIsReceiptOpen(true);
    setCart([]);
    setStockWarning(null);
    fetchCatalog(); // Refresh catalog stock counts
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & POS Terminal Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Barcode className={`w-5 h-5 text-emerald-400 ${scannerBeep ? 'scale-125 text-emerald-300' : ''} transition-transform`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">POS Checkout Terminal #02</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                LIVE POSTGRESQL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cashier: <strong className="text-white">{currentUser?.name || currentUser?.username}</strong> ({currentUser?.role})
              • Auto FEFO Batch Tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Real Camera Scanner Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="btn-primary py-2 px-3 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
          >
            <Camera className="w-4 h-4" />
            <span>Launch Camera Scanner</span>
          </button>

          {/* Sales History Drawer Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsHistoryOpen(true);
              fetchSalesHistory();
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Recent Invoices</span>
          </button>

          <button
            type="button"
            onClick={() => setAppliedPromo(appliedPromo ? null : 'SAVE50')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              appliedPromo
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Tag className="w-3.5 h-3.5 inline mr-1 text-purple-400" />
            {appliedPromo ? 'Promo "SAVE50" (-₹50)' : 'Apply "SAVE50"'}
          </button>

          <button
            type="button"
            onClick={clearCart}
            disabled={cart.length === 0}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors disabled:opacity-40"
            title="Clear POS Cart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stock Warning Banner */}
      {stockWarning && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between animate-shake">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{stockWarning}</span>
          </div>
          <button onClick={() => setStockWarning(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Product Search, Scanner & Hotkeys (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Barcode Search Form & Autocomplete */}
          <div className="glass-card p-4 space-y-3 relative">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-emerald-400" />
                <span>Barcode Scanner & SKU Quick Search</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Laser Scanner / USB Wedge Active</span>
            </label>

            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan item barcode with laser gun or search by name (e.g. 8901030382718, Milk, Oil)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-10 py-3 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                {scannerBeep && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400 animate-ping">
                    BEEP!
                  </span>
                )}
              </div>
              <button type="submit" className="btn-primary px-5 text-xs font-bold">
                Add Item
              </button>
            </form>

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute left-4 right-4 top-20 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800">
                {searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => {
                      addToCart(prod);
                      setBarcodeInput("");
                      setSearchResults([]);
                    }}
                    className="p-2.5 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{prod.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Barcode: {prod.barcode} • Stock: <span className={prod.current_stock <= 10 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{prod.current_stock}</span>
                      </p>
                    </div>
                    <span className="text-emerald-400 font-bold">₹{parseFloat(prod.selling_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Laser Scanner Test Chips */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-semibold">
                <span>Quick-Scan Laser Simulation (Seeded Products):</span>
                <button
                  type="button"
                  onClick={fetchCatalog}
                  className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingCatalog ? 'animate-spin' : ''}`} />
                  <span>Sync Catalog</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {products.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-950/40 hover:text-emerald-300 border border-slate-700/80 text-slate-300 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3 text-emerald-400" />
                    <span className="truncate max-w-[130px]">{p.name.split(' ')[0]} {p.name.split(' ')[1]}</span>
                    <span className="text-emerald-400 font-bold">₹{parseFloat(p.selling_price).toFixed(0)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Tap Category Catalog for Non-Barcoded Items */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Department Fast-Tap Grid (Fresh / Bakery / Staples)
              </h3>
              {categories.length > 0 && (
                <div className="flex gap-1 overflow-x-auto max-w-[320px] pb-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      selectedCategory === null
                        ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                        selectedCategory === c.id
                          ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
              {products
                .filter((p) => (selectedCategory ? p.category_id === selectedCategory : true))
                .map((product) => {
                  const isOutOfStock = (product.current_stock ?? 0) <= 0;
                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={`p-3 rounded-xl bg-slate-950/70 border transition-all space-y-1.5 group select-none ${
                        isOutOfStock
                          ? 'opacity-40 border-slate-800 cursor-not-allowed'
                          : 'border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {product.category_name?.split(' ')[0] || 'Item'}
                        </span>
                        <span className="text-xs font-extrabold text-emerald-400">
                          ₹{parseFloat(product.selling_price).toFixed(2)}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white line-clamp-1 group-hover:text-emerald-300 transition-colors">
                        {product.name}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Barcode: {product.barcode.slice(-5)}</span>
                        <span className={product.current_stock <= 10 ? 'text-amber-400 font-bold' : ''}>
                          Stock: {product.current_stock}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Cart & Settlement (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-card p-4 flex flex-col justify-between space-y-4">
            {/* Customer CRM Header */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Customer Loyalty Profile</span>
                </span>
                {customer && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {customer.tier} Tier ({customer.loyalty_points || customer.loyaltyPoints || 0} Pts)
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter 10-digit mobile number"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleCustomerLookup()}
                  disabled={customerLookupLoading}
                  className="btn-secondary px-3 py-1.5 text-xs font-semibold"
                >
                  {customerLookupLoading ? "Checking..." : "Lookup"}
                </button>
              </div>

              {customerLookupMessage && (
                <p className={`text-[10px] font-medium ${
                  customerLookupMessage.type === 'success' ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {customerLookupMessage.text}
                </p>
              )}

              {customer && (customer.loyalty_points > 0 || customer.loyaltyPoints > 0) && (
                <label className="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyPoints}
                    onChange={(e) => setApplyPoints(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <span>
                    Redeem {Math.min(customer.loyalty_points || customer.loyaltyPoints, 100)} pts for instant ₹
                    {Math.min(customer.loyalty_points || customer.loyaltyPoints, 100)} discount
                  </span>
                </label>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
                <span>Items in Register ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
                <span>Line Total (₹)</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-10 space-y-2 text-slate-500">
                    <ShoppingCart className="w-10 h-10 mx-auto text-slate-600" />
                    <p className="text-xs">Register cart is empty. Scan an item barcode or tap quick chips to begin.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white truncate">{item.name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-mono text-emerald-400">₹{parseFloat(item.selling_price).toFixed(2)}</span>
                          <span>•</span>
                          <span>GST {item.tax_rate}%</span>
                          <span>•</span>
                          <span className="text-slate-500 font-mono">Stock: {item.current_stock}</span>
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-white">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-white">
                          ₹{(parseFloat(item.selling_price) * item.quantity).toFixed(2)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bill Summary Calculations */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Items Subtotal:</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Applicable GST (CGST + SGST):</span>
                <span className="font-mono">₹{tax.toFixed(2)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Promotions & Loyalty Discounts:</span>
                  <span className="font-mono">-₹{totalDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Grand Total</span>
                  <p className="text-[10px] text-slate-500">Atomic PostgreSQL Settlement</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400 tracking-tight font-mono">
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Primary Checkout Button */}
            <button
              type="button"
              onClick={() => setIsPaymentOpen(true)}
              disabled={cart.length === 0}
              className="w-full btn-primary py-3.5 text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 disabled:opacity-40"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proceed to Payment (₹{grandTotal.toFixed(2)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real HTML5 Camera Barcode & QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onBarcodeDetected={handleBarcodeDetection}
        lastScanStatus={lastScanStatus}
      />

      {/* Payment Settlement Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        cart={cart}
        subtotal={subtotal}
        taxAmount={tax}
        totalDiscount={totalDiscount}
        grandTotal={grandTotal}
        customer={customer}
        currentUser={currentUser}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Printable Thermal Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptData={lastReceipt}
      />

      {/* Recent Invoices Slide-out Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl h-full">
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Recent POS Tax Invoices</h3>
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingHistory ? (
                <div className="text-center py-12 text-slate-400 text-xs">Loading database invoices...</div>
              ) : recentSales.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">No recent invoices recorded.</div>
              ) : (
                <div className="space-y-2.5">
                  {recentSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-emerald-400">{sale.invoice_number}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          sale.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {sale.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Total: ₹{parseFloat(sale.grand_total).toFixed(2)}</span>
                        <span>{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px]">
                        <span className="text-slate-500">Method: {sale.payment_method}</span>
                        <button
                          onClick={() => {
                            setLastReceipt(sale);
                            setIsReceiptOpen(true);
                            setIsHistoryOpen(false);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>View Receipt</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setIsHistoryOpen(false)}
              className="w-full btn-secondary py-2 text-xs font-semibold mt-4"
            >
              Close Invoices Drawer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
