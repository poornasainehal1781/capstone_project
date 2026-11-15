// SmartRetail AI - AI Decision Support & Assistant API Service
import { authApi } from './authApi';
import { API_BASE } from './apiConfig';

const getHeaders = () => {
  const token = authApi.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export const aiApi = {
  // 1. Comprehensive AI Insights Dashboard Payload
  getFullInsights: async () => {
    const res = await fetch(`${API_BASE}/ai/insights`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to load AI insights from backend.");
    }
    return await res.json();
  },

  // 2. Stock Replenishment Recommendations
  getReplenishment: async () => {
    const res = await fetch(`${API_BASE}/ai/replenishment`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to load replenishment recommendations.");
    }
    return await res.json();
  },

  // 3. Sales Trend Analysis & Slow-Movers
  getSalesTrends: async () => {
    const res = await fetch(`${API_BASE}/ai/sales-trends`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to load sales trend analysis.");
    }
    return await res.json();
  },

  // 4. Near-Expiry Shelf-Life Monitoring
  getNearExpiry: async () => {
    const res = await fetch(`${API_BASE}/ai/near-expiry`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to load near-expiry lot tracking.");
    }
    return await res.json();
  },

  // 5. Manager AI Chatbot
  sendChatMessage: async (message, conversationHistory = []) => {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Chatbot communication failed.");
    }
    return await res.json();
  }
};

