// SmartRetail AI - Core Store Operations API Client
import { authApi } from './authApi';
import { API_BASE } from './apiConfig';

const getHeaders = () => {
  const token = authApi.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export const storeApi = {
  // ==========================================
  // 1. PRODUCTS
  // ==========================================
  getProducts: async (search = "", categoryId = null, limit = 100) => {
    const params = new URLSearchParams();
    if (search && search.trim()) params.append("search", search.trim());
    if (categoryId && categoryId !== "ALL") params.append("category_id", categoryId);
    params.append("limit", limit);

    const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch products: ${res.statusText}`);
    }
    return await res.json();
  },

  createProduct: async (productData) => {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(productData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create product.");
    }
    return await res.json();
  },

  updateProduct: async (productId, updateData) => {
    const res = await fetch(`${API_BASE}/products/${productId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(updateData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to update product.");
    }
    return await res.json();
  },

  deleteProduct: async (productId) => {
    const res = await fetch(`${API_BASE}/products/${productId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to delete product.");
    }
    return await res.json();
  },

  // ==========================================
  // 2. CATEGORIES
  // ==========================================
  getCategories: async () => {
    const res = await fetch(`${API_BASE}/categories`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  },

  createCategory: async (categoryData) => {
    const res = await fetch(`${API_BASE}/categories`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(categoryData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create category.");
    }
    return await res.json();
  },

  updateCategory: async (categoryId, categoryData) => {
    const res = await fetch(`${API_BASE}/categories/${categoryId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(categoryData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to update category.");
    }
    return await res.json();
  },

  deleteCategory: async (categoryId) => {
    const res = await fetch(`${API_BASE}/categories/${categoryId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to delete category.");
    }
    return await res.json();
  },

  // ==========================================
  // 3. CUSTOMERS
  // ==========================================
  getCustomers: async (search = "", limit = 50) => {
    const params = new URLSearchParams();
    if (search && search.trim()) params.append("search", search.trim());
    params.append("limit", limit);

    const res = await fetch(`${API_BASE}/customers?${params.toString()}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  },

  createCustomer: async (customerData) => {
    const res = await fetch(`${API_BASE}/customers`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(customerData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to register customer.");
    }
    return await res.json();
  },

  updateCustomer: async (customerId, customerData) => {
    const res = await fetch(`${API_BASE}/customers/${customerId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(customerData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to update customer.");
    }
    return await res.json();
  },

  getCustomerSales: async (customerId) => {
    const res = await fetch(`${API_BASE}/customers/${customerId}/sales`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  },

  // ==========================================
  // 4. SUPPLIERS
  // ==========================================
  getSuppliers: async (search = "") => {
    const params = new URLSearchParams();
    if (search && search.trim()) params.append("search", search.trim());

    const res = await fetch(`${API_BASE}/suppliers?${params.toString()}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  },

  createSupplier: async (supplierData) => {
    const res = await fetch(`${API_BASE}/suppliers`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(supplierData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create supplier.");
    }
    return await res.json();
  },

  updateSupplier: async (supplierId, supplierData) => {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(supplierData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to update supplier.");
    }
    return await res.json();
  },

  deleteSupplier: async (supplierId) => {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to delete supplier.");
    }
    return await res.json();
  },

  // ==========================================
  // 5. PURCHASES & INWARDING
  // ==========================================
  getPurchases: async (statusFilter = null) => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "ALL") params.append("status_filter", statusFilter);

    const res = await fetch(`${API_BASE}/purchases?${params.toString()}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  },

  createPurchase: async (purchaseData, receiveImmediately = false) => {
    const res = await fetch(`${API_BASE}/purchases?receive_immediately=${receiveImmediately}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(purchaseData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to issue Purchase Order.");
    }
    return await res.json();
  },

  receivePurchase: async (purchaseId) => {
    const res = await fetch(`${API_BASE}/purchases/${purchaseId}/receive`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to inward purchase order.");
    }
    return await res.json();
  },

  // ==========================================
  // 6. USERS & STAFF ADMINISTRATION (Admin Only)
  // ==========================================
  getUsers: async () => {
    const res = await fetch(`${API_BASE}/users`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to fetch staff accounts.");
    }
    return await res.json();
  },

  createUser: async (userData) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to provision staff account.");
    }
    return await res.json();
  },

  toggleUserStatus: async (userId) => {
    const res = await fetch(`${API_BASE}/users/${userId}/toggle-status`, {
      method: "PATCH",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to toggle user status.");
    }
    return await res.json();
  },

  // ==========================================
  // 7. INVENTORY, BATCHES & ADJUSTMENTS
  // ==========================================
  adjustStock: async (productId, adjustmentData) => {
    const res = await fetch(`${API_BASE}/products/${productId}/adjust-stock`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(adjustmentData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to adjust stock.");
    }
    return await res.json();
  },

  getBatches: async (productId = null) => {
    const url = productId ? `${API_BASE}/products/batches?product_id=${productId}` : `${API_BASE}/products/batches`;
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  },

  inwardBatch: async (productId, batchData) => {
    const res = await fetch(`${API_BASE}/products/${productId}/batches`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(batchData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to inward product batch.");
    }
    return await res.json();
  }
};

