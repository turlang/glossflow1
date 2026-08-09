const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/+$/, '');

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
  return data.token || null;
}

/**
 * Cliente HTTP centralizado com refresh token e contexto público multi-tenant.
 * A mesma aplicação pode servir vários salões por ?salon=slug, subdomínio ou
 * domínio próprio sem duplicar o projeto.
 */
export async function request(path, options = {}, retry = true) {
  const token = localStorage.getItem('glossflow.token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...publicTenantHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (response.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return request(path, options, false);
    localStorage.removeItem('glossflow.token');
    localStorage.removeItem('glossflow.refreshToken');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Não foi possível concluir a solicitação.');
  }

  return data;
}
