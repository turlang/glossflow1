/**
 * Cliente HTTP central do frontend.
 *
 * Responsabilidades:
 * - montar contexto público do tenant (slug/host);
 * - anexar JWT administrativo quando existir;
 * - renovar access token uma única vez em 401;
 * - compartilhar um único refresh entre chamadas concorrentes;
 * - encerrar a sessão local/remota sem permitir reidratação por refresh antigo;
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

function storageValue(key) {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(key) || '';
}

/**
 * Um refresh token é de uso único no backend. Requisições protegidas podem
 * receber 401 simultaneamente, então todas precisam compartilhar a mesma
 * rotação em vez de tentar consumir o mesmo refresh token em paralelo.
 */
let refreshInFlight = null;
let authGeneration = 0;
let lastAccessToken = storageValue('glossflow.token');
let lastRefreshToken = storageValue('glossflow.refreshToken');

function rememberSession(accessToken, refreshToken) {
  if (accessToken) lastAccessToken = accessToken;
  if (refreshToken) lastRefreshToken = refreshToken;
}

function invalidateRefreshGeneration() {
  authGeneration += 1;
  refreshInFlight = null;
}

/**
 * Registra uma autenticação recém-concluída. Além de manter uma cópia efêmera
 * das credenciais atuais, invalida qualquer refresh iniciado pela sessão
 * anterior para impedir que uma resposta atrasada sobrescreva o novo login.
 */
export function markAuthenticatedSession() {
  invalidateRefreshGeneration();
  lastAccessToken = storageValue('glossflow.token');
  lastRefreshToken = storageValue('glossflow.refreshToken');
}

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
  const hadSession = Boolean(
    storageValue('glossflow.token') || storageValue('glossflow.refreshToken') || lastAccessToken || lastRefreshToken
  );

  invalidateRefreshGeneration();

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('glossflow.token');
    localStorage.removeItem('glossflow.refreshToken');
  }

  lastAccessToken = '';
  lastRefreshToken = '';

  if (notify && hadSession && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

/** Executa uma rotação específica sem permitir que chamadas concorrentes disputem o token. */
async function performRefresh(refreshToken, generation) {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...publicTenantHeaders() },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) return null;

  const data = await response.json();

  // Logout ou um novo login aconteceu enquanto a rotação estava em voo.
  if (generation !== authGeneration) return null;

  // Só a sessão que ainda possui o refresh que originou a chamada pode aceitar
  // a rotação. Se o token sumiu (logout) ou mudou (novo login), descartamos a
  // resposta para que ela nunca reidrate credenciais antigas no navegador.
  if (storageValue('glossflow.refreshToken') !== refreshToken) {
    return storageValue('glossflow.token') || null;
  }

  if (data.token) localStorage.setItem('glossflow.token', data.token);
  if (data.refreshToken) localStorage.setItem('glossflow.refreshToken', data.refreshToken);
  rememberSession(data.token, data.refreshToken);
  return data.token || null;
}

/**
 * Renova o access token usando refresh token com single-flight.
 * Retorna `null` sem lançar quando a renovação não é mais possível.
 */
async function refreshAccessToken() {
  const refreshToken = storageValue('glossflow.refreshToken');
  if (!refreshToken) return null;

  const generation = authGeneration;
  if (refreshInFlight?.refreshToken === refreshToken && refreshInFlight?.generation === generation) {
    return refreshInFlight.promise;
  }

  const promise = performRefresh(refreshToken, generation);
  refreshInFlight = { refreshToken, generation, promise };

  try {
    return await promise;
  } finally {
    if (refreshInFlight?.promise === promise) refreshInFlight = null;
  }
}

function isAuthBootstrapPath(path) {
  return path === '/auth/login' || path === '/auth/refresh';
}

/**
 * Encerra a sessão do navegador imediatamente e tenta revogar a mesma sessão no
 * servidor. A falha de rede não impede o logout local. O access token também é
 * enviado porque ele identifica a UserSession mesmo quando o refresh acabou de
 * ser rotacionado por uma chamada concorrente.
 */
export async function logoutSession({ accessToken = '', refreshToken = '' } = {}) {
  const tokenForServer = accessToken || storageValue('glossflow.token') || lastAccessToken;
  const refreshForServer = refreshToken || storageValue('glossflow.refreshToken') || lastRefreshToken;

  clearSession({ notify: false });

  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...publicTenantHeaders(),
        ...(tokenForServer ? { Authorization: `Bearer ${tokenForServer}` } : {})
      },
      body: JSON.stringify(refreshForServer ? { refreshToken: refreshForServer } : {})
    });
    return response.ok;
  } catch {
    return false;
  }
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

/** Retenta com uma credencial mais nova quando a sessão mudou durante uma chamada antiga. */
function hasNewerAccessToken(tokenUsed) {
  const currentToken = storageValue('glossflow.token');
  return Boolean(currentToken && currentToken !== tokenUsed);
}

/**
 * Executa uma chamada HTTP e tenta no máximo uma renovação de token.
 * `retry=false` impede loop infinito se o endpoint continuar retornando 401.
 */
export async function request(path, options = {}, retry = true) {
  let token = storageValue('glossflow.token');
  rememberSession(token, storageValue('glossflow.refreshToken'));

  if (!token && retry && !isAuthBootstrapPath(path) && storageValue('glossflow.refreshToken')) {
    const refreshTokenBefore = storageValue('glossflow.refreshToken');
    token = await refreshAccessToken();

    if (!token) {
      const currentToken = storageValue('glossflow.token');
      const currentRefresh = storageValue('glossflow.refreshToken');

      // Uma nova autenticação pode ter sido concluída enquanto o refresh antigo
      // ainda estava em voo. Nunca apagamos credenciais mais novas nesse caso.
      if (currentToken || (currentRefresh && currentRefresh !== refreshTokenBefore)) {
        return request(path, options, false);
      }

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
    // Se outra chamada já rotacionou a sessão (ou um novo login terminou),
    // repetimos com a credencial atual sem iniciar outro refresh.
    if (hasNewerAccessToken(token)) {
      return request(path, options, false);
    }

    if (retry) {
      const refreshTokenBefore = storageValue('glossflow.refreshToken');
      const newToken = await refreshAccessToken();
      if (newToken) return request(path, options, false);

      if (hasNewerAccessToken(token)) {
        return request(path, options, false);
      }

      const currentRefresh = storageValue('glossflow.refreshToken');
      if (currentRefresh && currentRefresh !== refreshTokenBefore) {
        return request(path, options, false);
      }
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
