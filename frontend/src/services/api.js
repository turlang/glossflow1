const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/+$/, '');

const AUTH_EXPIRED_EVENT = 'glossflow:auth-expired';
const BOOKING_CONFIRMED_EVENT = 'glossflow:booking-confirmed';

function publicTenantHeaders() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const explicitSlug = (params.get('salon') || import.meta.env.VITE_SALON_SLUG || '').trim().toLowerCase();
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  const isPlatformHost = hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.endsWith('.vercel.app');

  return {
    ...(explicitSlug ? { 'X-Salon-Slug': explicitSlug } : {}),
    ...(!isPlatformHost && hostname ? { 'X-Salon-Host': hostname } : {})
  };
}

function apiErrorMessage(data) {
  const firstIssue = Array.isArray(data?.issues) ? data.issues[0] : null;
  if (firstIssue?.message) {
    const field = Array.isArray(firstIssue.path) && firstIssue.path.length
      ? `${firstIssue.path.join('.')}: `
      : '';
    return `${field}${firstIssue.message}`;
  }
  return data?.message || 'Não foi possível concluir a solicitação.';
}

function clearSession({ notify = true } = {}) {
  localStorage.removeItem('glossflow.token');
  localStorage.removeItem('glossflow.refreshToken');
  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('glossflow.refreshToken');
  if (!refreshToken) return null;

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...publicTenantHeaders() },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) return null;
  const data = await response.json();
  if (data.token) localStorage.setItem('glossflow.token', data.token);
  if (data.refreshToken) localStorage.setItem('glossflow.refreshToken', data.refreshToken);
  return data.token || null;
}

function isAuthBootstrapPath(path) {
  return path === '/auth/login' || path === '/auth/refresh';
}

function persistBookingConfirmation(path, options, data) {
  const method = String(options?.method || 'GET').toUpperCase();
  if (path !== '/appointments' || method !== 'POST' || !data?.confirmation?.confirmed) return;
  const receipt = {
    appointmentId: data.id,
    startTime: data.startTime,
    protocol: data.confirmation.protocol,
    cancellationMinHours: data.confirmation.cancellationMinHours,
    managementUrl: data.confirmation.managementUrl,
    managementToken: data.confirmation.managementToken,
    clientNotification: data.confirmation.clientNotification,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('glossflow.lastBooking', JSON.stringify(receipt));
  window.dispatchEvent(new CustomEvent(BOOKING_CONFIRMED_EVENT, { detail: receipt }));
}

/** Cliente HTTP centralizado com refresh token e contexto público multi-tenant. */
export async function request(path, options = {}, retry = true) {
  let token = localStorage.getItem('glossflow.token');

  if (!token && retry && !isAuthBootstrapPath(path) && localStorage.getItem('glossflow.refreshToken')) {
    token = await refreshAccessToken();
    if (!token) clearSession();
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...publicTenantHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (response.status === 401 && retry && !isAuthBootstrapPath(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) return request(path, options, false);
    clearSession();
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !isAuthBootstrapPath(path)) {
      throw new Error('Sua sessão expirou. Entre novamente para continuar.');
    }
    throw new Error(apiErrorMessage(data));
  }

  if (typeof window !== 'undefined') persistBookingConfirmation(path, options, data);
  return data;
}

export function onAuthExpired(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}
