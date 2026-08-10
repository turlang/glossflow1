const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/+$/, '');

const AUTH_EXPIRED_EVENT = 'glossflow:auth-expired';

function publicTenantHeaders() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const explicitSlug = (params.get('salon') || import.meta.env.VITE_SALON_SLUG || '').trim().toLowerCase();
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');

  /**
   * Em domínios técnicos da Vercel o backend deve usar o salão padrão (ou o
   * slug explícito). O hostname só precisa ser enviado quando ele representa
   * um domínio/subdomínio white-label real do cliente.
   *
   * Além de evitar preflight CORS desnecessário, isso mantém compatibilidade
   * com backends já publicados que ainda não reconhecem X-Salon-Host.
   */
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

/**
 * Cliente HTTP centralizado com refresh token e contexto público multi-tenant.
 * A mesma aplicação pode servir vários salões por ?salon=slug, subdomínio ou
 * domínio próprio sem duplicar o projeto.
 */
export async function request(path, options = {}, retry = true) {
  let token = localStorage.getItem('glossflow.token');

  // Se o access token sumiu, mas ainda existe refresh token, tenta restaurar a
  // sessão antes de disparar uma rota administrativa sem Authorization.
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

  return data;
}

export function onAuthExpired(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}
