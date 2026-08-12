import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAuthExpiredError, onAuthExpired, request } from './api.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
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
});
