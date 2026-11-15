// Centralized API configuration for SmartRetail AI
// Uses VITE_API_URL for production deployment (set via .env.production or Vercel env vars)
const PRODUCTION_BACKEND = "https://smartretail-backend-0ftv.onrender.com";
const DEV_BACKEND = "http://127.0.0.1:8000";

const rawBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? DEV_BACKEND : PRODUCTION_BACKEND);
export const API_BASE = `${rawBase.replace(/\/+$/, '')}/api/v1`;
