// SmartRetail AI - Authentication API Service
import { API_BASE } from './apiConfig';

export const authApi = {
  getToken: () => localStorage.getItem("smartretail_token"),

  setToken: (token) => {
    if (token) {
      localStorage.setItem("smartretail_token", token);
    } else {
      localStorage.removeItem("smartretail_token");
    }
  },

  clearToken: () => {
    localStorage.removeItem("smartretail_token");
    localStorage.removeItem("smartretail_user");
  },

  // Real backend login request
  login: async (username, password) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.detail || "Authentication failed.";
      throw new Error(errorMsg);
    }

    // Persist JWT token
    if (data.access_token) {
      authApi.setToken(data.access_token);
      localStorage.setItem("smartretail_user", JSON.stringify(data.user));
    }

    return data;
  },

  // Fetch current user profile with token
  getMe: async () => {
    const token = authApi.getToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE}/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      authApi.clearToken();
      throw new Error("Session has expired. Please log in again.");
    }

    if (!response.ok) {
      throw new Error("Failed to verify user session.");
    }

    return await response.json();
  },

  // Logout
  logout: async () => {
    const token = authApi.getToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.warn("Backend logout notification failed, clearing local state:", err);
      }
    }
    authApi.clearToken();
  },
};
