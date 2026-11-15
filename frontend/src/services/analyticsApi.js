// SmartRetail AI - Analytics & Reports API Service
import { authApi } from './authApi';
import { API_BASE } from './apiConfig';

const getHeaders = () => {
  const token = authApi.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export const analyticsApi = {
  // 1. Dashboard Executive Stats
  getDashboardStats: async () => {
    const res = await fetch(`${API_BASE}/analytics/dashboard`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dashboard metrics: ${res.statusText}`);
    }
    return await res.json();
  },

  // 2. Sales Analytics Series & Breakdowns
  getSalesAnalytics: async (period = "last_30_days", fromDate = null, toDate = null) => {
    const params = new URLSearchParams();
    params.append("period", period);
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);

    const res = await fetch(`${API_BASE}/analytics/sales?${params.toString()}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch sales analytics: ${res.statusText}`);
    }
    return await res.json();
  },

  // 3. Inventory Analytics & Replenishment
  getInventoryAnalytics: async () => {
    const res = await fetch(`${API_BASE}/analytics/inventory`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch inventory analytics: ${res.statusText}`);
    }
    return await res.json();
  },

  // 4. Executive Report Summary
  getReportSummary: async (dateRange = "last_30_days", fromDate = null, toDate = null) => {
    const params = new URLSearchParams();
    params.append("date_range", dateRange);
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);

    const res = await fetch(`${API_BASE}/reports/summary?${params.toString()}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to fetch report summary.");
    }
    return await res.json();
  },

  // 5. Download CSV Report
  downloadReportCsv: async (reportType = "sales", fromDate = null, toDate = null) => {
    const params = new URLSearchParams();
    params.append("report_type", reportType);
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);

    const token = authApi.getToken();
    const res = await fetch(`${API_BASE}/reports/export/csv?${params.toString()}`, {
      method: "GET",
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to download CSV report.");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SmartRetail_${reportType.toUpperCase()}_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // 6. Download PDF Report
  downloadReportPdf: async (reportType = "summary", fromDate = null, toDate = null) => {
    const params = new URLSearchParams();
    params.append("report_type", reportType);
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);

    const token = authApi.getToken();
    const res = await fetch(`${API_BASE}/reports/export/pdf?${params.toString()}`, {
      method: "GET",
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to download PDF report.");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SmartRetail_${reportType.toUpperCase()}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
};

