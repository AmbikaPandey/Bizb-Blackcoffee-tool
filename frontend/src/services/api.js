const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('bizb_token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${url}`, { headers, ...options });

  if (res.status === 401) {
    // Don't treat login/register 401 as session expiry
    const isAuthRoute = url === '/auth/login' || url === '/auth/register';
    if (!isAuthRoute) {
      localStorage.removeItem('bizb_token');
      localStorage.removeItem('bizb_user');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  logoutAll: () => request('/auth/logout-all', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  // Sessions
  getSessions: () => request('/auth/sessions'),
  revokeSession: (id) => request(`/auth/sessions/${id}`, { method: 'DELETE' }),

  // Users
  getUsers: () => request('/users'),
  getUser: (id) => request(`/users/${id}`),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateUserPassword: (id, password) => request(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Clients
  getClients: () => request('/clients'),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: () => request('/products'),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  // Invoices
  getInvoices: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/invoices${qs ? `?${qs}` : ''}`);
  },
  getInvoice: (id) => request(`/invoices/${id}`),
  getNextInvoiceNumber: (type = 'tax') => request(`/invoices/next-number?type=${type}`),
  downloadInvoicePdf: async (id) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/invoices/${id}/pdf`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Failed to download PDF');
    }
    return res.blob();
  },
  printInvoicePdf: async (id) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/invoices/${id}/pdf?mode=print`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Failed to generate print PDF');
    }
    return res.blob();
  },
  createInvoice: (data) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateInvoiceStatus: (id, status) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),

  // Payments
  getPayments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/payments${qs ? `?${qs}` : ''}`);
  },
  createPayment: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
  deletePayment: (id) => request(`/payments/${id}`, { method: 'DELETE' }),

  // Projects
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // Vendors
  getVendors: () => request('/vendors'),
  getVendor: (id) => request(`/vendors/${id}`),
  createVendor: (data) => request('/vendors', { method: 'POST', body: JSON.stringify(data) }),
  updateVendor: (id, data) => request(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVendor: (id) => request(`/vendors/${id}`, { method: 'DELETE' }),

  // Expenses
  getExpenses: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/expenses${qs ? `?${qs}` : ''}`);
  },
  getExpenseStats: () => request('/expenses/stats'),
  getUserExpenses: (userId) => request(`/expenses/user/${userId}`),
  createExpense: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id, data) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request('/settings'),
  saveSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // States
  getStates: () => request('/states'),

  // Dashboard
  getDashboardStats: () => request('/dashboard/stats'),
  getClientMapData: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/dashboard/client-map${qs ? `?${qs}` : ''}`);
  },

  // Reports
  getReportSummary: () => request('/reports/summary'),
  getMonthlyReport: (year) => request(`/reports/monthly${year ? `?year=${year}` : ''}`),
  getAgeingReport: () => request('/reports/ageing'),
  getGstSummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/gst-summary${qs ? `?${qs}` : ''}`);
  },
  getClientLedger: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/client-ledger?${qs}`);
  },
  getReimbursements: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/reimbursements${qs ? `?${qs}` : ''}`);
  },

  // HSN Codes
  searchHSN: (q, page = 1, limit = 20) => request(`/hsn/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
  getHSN: (code) => request(`/hsn/${encodeURIComponent(code)}`),

  // BUSY Export
  exportToBusy: (invoiceId) => request(`/busy/export/${invoiceId}`, { method: 'POST' }),
  exportToBusyBulk: (invoiceIds) => request('/busy/export-bulk', { method: 'POST', body: JSON.stringify({ invoiceIds }) }),
  getBusyHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/busy/history${qs ? `?${qs}` : ''}`);
  },
  downloadBusyXml: async (invoiceId) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/busy/download/${invoiceId}`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Failed to download XML');
    }
    return res.blob();
  },
};
