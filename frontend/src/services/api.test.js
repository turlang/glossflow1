import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAuthExpiredError, onAuthExpired, request } from './api.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function requestUrl(input) {
  return typeof input === 'string' ? input : input.url;
}

describe('HTTP client authentication lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('classifica 401 definitivo como sessão expirada, limpa tokens e notifica a UI', async () => {
    localStorage.setItem('glossflow.token', 'access-antigo');
    localStorage.setItem('glossflow.refreshToken', 'refresh-antigo');

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'Refresh token inválido' }, 401));

    const expiredHandler = vi.fn();
    const unsubscribe = onAuthExpired(expiredHandler);

    let caughtError;
    try {
      await request('/admin/salon-info');
    } catch (error) {
      caughtError = error;
    } finally {
      unsubscribe();
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isAuthExpiredError(caughtError)).toBe(true);
    expect(caughtError?.message).toBe('Sua sessão expirou. Entre novamente para continuar.');
    expect(localStorage.getItem('glossflow.token')).toBeNull();
    expect(localStorage.getItem('glossflow.refreshToken')).toBeNull();
    expect(expiredHandler).toHaveBeenCalledTimes(1);
  });

  it('persiste access e refresh rotacionados antes de repetir a chamada protegida', async () => {
    localStorage.setItem('glossflow.token', 'access-antigo');
    localStorage.setItem('glossflow.refreshToken', 'refresh-antigo');

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ token: 'access-novo', refreshToken: 'refresh-novo' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await request('/admin/salon-info');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('glossflow.token')).toBe('access-novo');
    expect(localStorage.getItem('glossflow.refreshToken')).toBe('refresh-novo');

    const retryHeaders = fetchMock.mock.calls[2][1]?.headers;
    expect(retryHeaders?.Authorization).toBe('Bearer access-novo');
  });

  it('compartilha uma única rotação quando chamadas protegidas recebem 401 em paralelo', async () => {
    localStorage.setItem('glossflow.token', 'access-antigo');
    localStorage.setItem('glossflow.refreshToken', 'refresh-antigo');

    let refreshCalls = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options = {}) => {
      const url = requestUrl(input);
      const authorization = options.headers?.Authorization;

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse({ token: 'access-novo', refreshToken: 'refresh-novo' });
      }

      if (authorization === 'Bearer access-antigo') {
        return jsonResponse({ message: 'Unauthorized' }, 401);
      }

      if (authorization === 'Bearer access-novo') {
        return jsonResponse({ ok: true, path: new URL(url).pathname });
      }

      return jsonResponse({ message: 'Token ausente' }, 401);
    });

    const results = await Promise.all([
      request('/platform-admin/overview'),
      request('/platform-admin/salons'),
      request('/platform-admin/plans')
    ]);

    expect(results).toHaveLength(3);
    expect(results.every((item) => item.ok)).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(fetchMock.mock.calls.filter(([input]) => requestUrl(input).endsWith('/auth/refresh'))).toHaveLength(1);
    expect(localStorage.getItem('glossflow.token')).toBe('access-novo');
    expect(localStorage.getItem('glossflow.refreshToken')).toBe('refresh-novo');
  });

  it('não apaga uma sessão nova quando um refresh antigo termina com 401', async () => {
    localStorage.setItem('glossflow.token', 'access-antigo');
    localStorage.setItem('glossflow.refreshToken', 'refresh-antigo');

    let releaseRefresh;
    const refreshBarrier = new Promise((resolve) => { releaseRefresh = resolve; });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options = {}) => {
      const url = requestUrl(input);
      const authorization = options.headers?.Authorization;

      if (url.endsWith('/auth/refresh')) {
        await refreshBarrier;
        return jsonResponse({ message: 'Refresh antigo inválido' }, 401);
      }

      if (authorization === 'Bearer access-antigo') {
        return jsonResponse({ message: 'Unauthorized' }, 401);
      }

      if (authorization === 'Bearer access-login-novo') {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ message: 'Unauthorized' }, 401);
    });

    const pending = request('/platform-admin/overview');
    await Promise.resolve();
    await Promise.resolve();

    localStorage.setItem('glossflow.token', 'access-login-novo');
    localStorage.setItem('glossflow.refreshToken', 'refresh-login-novo');
    releaseRefresh();

    await expect(pending).resolves.toEqual({ ok: true });
    expect(localStorage.getItem('glossflow.token')).toBe('access-login-novo');
    expect(localStorage.getItem('glossflow.refreshToken')).toBe('refresh-login-novo');
    expect(fetchMock.mock.calls.some(([, options]) => options?.headers?.Authorization === 'Bearer access-login-novo')).toBe(true);
  });
});
