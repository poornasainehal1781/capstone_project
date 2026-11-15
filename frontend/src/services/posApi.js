// SmartRetail AI - POS Billing & Catalog API Service
import { authApi } from './authApi';
import { API_BASE } from './apiConfig';

const getHeaders = () => {
  const token = authApi.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export const posApi = {
  // 1. Product Search (by name, barcode, or SKU)
  searchProducts: async (query = "", categoryId = null, limit = 50) => {
    try {
      const params = new URLSearchParams();
      if (query && query.trim()) params.append("search", query.trim());
      if (categoryId) params.append("category_id", categoryId);
      params.append("limit", limit);

      const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch products: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      console.warn("searchProducts API error, falling back:", err.message);
      return [];
    }
  },

  // 2. High-speed Barcode lookup
  lookupBarcode: async (barcode) => {
    const cleanBarcode = barcode.trim();
    const res = await fetch(`${API_BASE}/products/barcode/${encodeURIComponent(cleanBarcode)}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Barcode lookup failed.");
    }

    return await res.json();
  },

  // 3. Category Catalog
  listCategories: async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn("listCategories API error:", err.message);
      return [];
    }
  },

  // 4. Customer Lookup by Mobile Phone
  lookupCustomerByPhone: async (phone) => {
    const cleanPhone = phone.trim();
    const res = await fetch(`${API_BASE}/customers/phone/${encodeURIComponent(cleanPhone)}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Customer lookup failed.");
    }
    return await res.json();
  },

  // 5. Register Customer Profile
  createCustomer: async (customerData) => {
    const res = await fetch(`${API_BASE}/customers`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(customerData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Customer creation failed.");
    }
    return await res.json();
  },

  // 6. POS Checkout (Atomic Transaction)
  checkoutSale: async (salePayload) => {
    const res = await fetch(`${API_BASE}/sales`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(salePayload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "POS checkout transaction failed.");
    }
    return data;
  },

  // 7. List Sales Records
  listSales: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.status) query.append("status", params.status);
    if (params.payment_method) query.append("payment_method", params.payment_method);
    if (params.limit) query.append("limit", params.limit);

    const res = await fetch(`${API_BASE}/sales?${query.toString()}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to fetch sales records.");
    }
    return await res.json();
  },

  // 8. Download PDF Tax Invoice Blob
  downloadInvoicePdf: async (saleId) => {
    const token = authApi.getToken();
    const res = await fetch(`${API_BASE}/sales/${saleId}/pdf`, {
      method: "GET",
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
    });

    if (!res.ok) {
      throw new Error("Failed to generate PDF Tax Invoice.");
    }

    return await res.blob();
  },

  // 9. Void / Cancel Sale (Manager/Admin only)
  cancelSale: async (saleId) => {
    const res = await fetch(`${API_BASE}/sales/${saleId}/cancel`, {
      method: "POST",
      headers: getHeaders(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Failed to cancel sale.");
    }
    return data;
  }
};
