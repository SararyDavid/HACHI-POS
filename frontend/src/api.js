import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatic JWT Authorization Header Interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hachi_pos_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// ==========================================================
// Authentication & Cashier Session API
// ==========================================================
export const loginWithPin = async (pin) => {
  const response = await api.post('/auth/login', { pin });
  if (response.data?.data?.token) {
    localStorage.setItem('hachi_pos_token', response.data.data.token);
    localStorage.setItem('hachi_pos_user', JSON.stringify(response.data.data.user));
  }
  return response.data;
};

export const fetchCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const logoutUser = () => {
  localStorage.removeItem('hachi_pos_token');
  localStorage.removeItem('hachi_pos_user');
};

export const fetchHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const fetchProducts = async (params = {}) => {
  const response = await api.get('/products', { params });
  return response.data;
};

export const fetchProductByBarcode = async (barcode) => {
  const response = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
  return response.data;
};

export const createProduct = async (productData) => {
  const response = await api.post('/products', productData);
  return response.data;
};

export const updateProduct = async (id, productData) => {
  const response = await api.put(`/products/${id}`, productData);
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};

export const processCheckout = async (orderPayload) => {
  const response = await api.post('/checkout', orderPayload);
  return response.data;
};

export const fetchSalesHistory = async () => {
  const response = await api.get('/sales');
  return response.data;
};

export const triggerEscPosPrint = async (saleData, printerConfig = {}) => {
  const response = await api.post('/print', {
    sale: saleData,
    ...printerConfig
  });
  return response.data;
};

// Shift Management & End-of-Day Z-Report API
export const fetchCurrentShift = async () => {
  const response = await api.get('/shifts/current');
  return response.data;
};

export const startShift = async (shiftData) => {
  const response = await api.post('/shifts/start', shiftData);
  return response.data;
};

export const closeShift = async (closeData) => {
  const response = await api.post('/shifts/close', closeData);
  return response.data;
};

export const fetchShiftHistory = async () => {
  const response = await api.get('/shifts/history');
  return response.data;
};

export const triggerZReportPrint = async (shift) => {
  const response = await api.post('/print/z-report', { shift });
  return response.data;
};

// Bakong KHQR & ABA Real-Time Payment API
export const fetchStaticKhqr = async () => {
  const response = await api.get('/khqr/static');
  return response.data;
};

export const createKhqrPaymentSession = async (payload) => {
  const response = await api.post('/khqr/create', payload);
  return response.data;
};

export const checkKhqrStatus = async (md5) => {
  const response = await api.post(`/khqr/check/${encodeURIComponent(md5)}`);
  return response.data;
};

export const simulateKhqrPayment = async (payload = {}) => {
  const response = await api.post('/khqr/simulate', payload);
  return response.data;
};

// ==========================================================
// RMA Refund & Void API
// ==========================================================
export const refundSale = async (invoiceNo, reason = 'Customer Return / RMA') => {
  const response = await api.post(`/sales/${encodeURIComponent(invoiceNo)}/refund`, { reason });
  return response.data;
};

export default api;
