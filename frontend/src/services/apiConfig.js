// Centralized API configuration for SmartRetail AI
// Supports VITE_API_URL for production deployment (e.g. Render/Vercel)
// Defaults to local backend during development
export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api/v1`
  : "http://127.0.0.1:8000/api/v1";

