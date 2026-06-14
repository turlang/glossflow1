const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/+$/, '');

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('glossflow.refreshToken');
  if (!refreshToken) return null;

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) return null;
  const data = await response.json();
  if (data.token) localStorage.setItem('glossflow.token', data.token);
  return data.token || null;
}

/**
 * Cliente HTTP centralizado com refresh token.
 * Se o access token expirar, tenta renovar a sessão automaticamente uma vez.
 */
export async function request(path, options = {}, retry = true) {
  const token = localStorage.getItem('glossflow.token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
