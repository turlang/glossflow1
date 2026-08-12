/**
 * Cliente HTTP central do frontend.
 *
 * Responsabilidades:
 * - montar contexto público do tenant (slug/host);
 * - anexar JWT administrativo quando existir;
 * - renovar access token uma única vez em 401;
 * - persistir o comprovante de agendamento público;
 * - normalizar mensagens de erro da API.
 *
 * Regra importante: este módulo não decide permissão de negócio. O backend é
 * a fonte de verdade para RBAC e isolamento multi-tenant.
 */

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/+$/, '');

const AUTH_EXPIRED_EVENT = 'glossflow:auth-expired';
const AUTH_EXPIRED_CODE = 'AUTH_EXPIRED';
const AUTH_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar.';
const BOOKING_CONFIRMED_EVENT = 'glossflow:booking-confirmed';

/**
 * Erro tipado de sessão expirada. A UI usa o `code` para distinguir expiração
 * real de indisponibilidade da API e não bloquear a tela de login com um
 * banner genérico de conexão.
 */
function authExpiredError() {
  const error = new Error(AUTH_EXPIRED_MESSAGE);
  error.code = AUTH_EXPIRED_CODE;
  return error;
}

export function isAuthExpiredError(error) {
  return error?.code === AUTH_EXPIRED_CODE;
}

/**
 * Identifica o tenant público sem confiar em dados administrativos.
 * Em domínios próprios enviamos `X-Salon-Host`; no host da plataforma usamos
 * slug explícito para permitir múltiplas vitrines na mesma aplicação Vercel.
 */
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

/** Converte erros Zod/API em uma mensagem curta para a interface. */
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

/** Limpa a sessão local e avisa o App quando a autenticação realmente expirou. */
function clearSession({ notify = true } = {}) {
  localStorage.removeItem('glossflow.token');
  localStorage.removeItem('glossflow.refreshToken');

  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

/**
 * Renova o access token usando refresh token.
 * Retorna `null` sem lançar quando a renovação não é mais possível.
 */
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
 * Salva o comprovante retornado pelo backend depois do POST /appointments.
 * A UI lê esse snapshot para exibir protocolo e política sem recalcular regra.
 */
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

/**
 * Executa uma chamada HTTP e tenta no máximo uma renovação de token.
 * `retry=false` impede loop infinito se o endpoint continuar retornando 401.
 */
export async function request(path, options = {}, retry = true) {
  let token = localStorage.getItem('glossflow.token');

  if (!token && retry && !isAuthBootstrapPath(path) && localStorage.getItem('glossflow.refreshToken')) {
    token = await refreshAccessToken();
    if (!token) {
      clearSession();
      throw authExpiredError();
    }
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

  if (response.status === 401 && !isAuthBootstrapPath(path)) {
    if (retry) {
      const newToken = await refreshAccessToken();
      if (newToken) return request(path, options, false);
    }

    clearSession();
    throw authExpiredError();
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(apiErrorMessage(data));
  }

  if (typeof window !== 'undefined') persistBookingConfirmation(path, options, data);
  return data;
}

/** Inscreve um listener no evento de expiração e devolve a função de cleanup. */
export function onAuthExpired(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}
