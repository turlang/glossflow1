import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { request } from '../../services/api.js';
import { SecurityAdmin } from './AdminPlatformModules.jsx';

vi.mock('../../services/api.js', () => ({ request: vi.fn() }));

const clients = [{ id: 'c1', name: 'Cliente Teste', phone: '11999990000' }];

function baseResponse(url) {
  if (url === '/admin/security/overview') return { score: 96, restoreEnabled: false, controls: [{ name: 'LGPD', status: 'Pronto', description: 'Controle de privacidade.' }] };
  if (url === '/admin/security/audit-logs') return [];
  if (url === '/admin/security/sessions') return [{ id: 's1', ip: '127.0.0.1', revokedAt: null, user: { name: 'Admin' } }];
  if (url === '/admin/security/retention/preview') return { candidates: { sessionsToDelete: 1, whatsappEventsToRedact: 2, auditLogsToDelete: 0, backupMetadataToDelete: 0 } };
  return null;
}

describe('SecurityAdmin', () => {
  beforeEach(() => {
    request.mockImplementation(async (url, options = {}) => {
      const base = baseResponse(url);
      if (base !== null) return base;
      if (url === '/admin/security/sessions/revoke-all') return { count: 2 };
      if (url === '/admin/security/lgpd/erase/c1') return { appointmentsAnonymized: 1, auditEventsRedacted: 2 };
      if (url === '/admin/security/lgpd/export/c1') return { subject: { id: 'c1', name: 'Cliente Teste' } };
      if (url === '/admin/security/retention/run') return { sessionsDeleted: 1, whatsappEventsRedacted: 2, auditLogsDeleted: 0 };
      if (url === '/admin/security/backups') return { summary: 'Snapshot assinado', snapshot: { schema: 'v1' } };
      return { options };
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exibe direitos do titular, retenção e estado de restore', async () => {
    render(<SecurityAdmin clients={clients} />);
    expect(screen.getByRole('heading', { name: 'Direitos do titular — LGPD' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Prévia da política de dados' })).toBeTruthy();
    expect(screen.getByText('bloqueado por padrão')).toBeTruthy();
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/security/retention/preview'));
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('eliminação exige seleção, motivo e frase explícita antes de chamar a API', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue('EXCLUIR DADOS');
    render(<SecurityAdmin clients={clients} />);

    const lgpdHeading = screen.getByRole('heading', { name: 'Direitos do titular — LGPD' });
    const section = lgpdHeading.closest('section');
    await user.selectOptions(section.querySelector('select'), 'c1');
    await user.type(screen.getByLabelText('Motivo da eliminação'), 'Solicitação formal do titular.');
    await user.click(screen.getByRole('button', { name: 'Eliminar dados pessoais' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/security/lgpd/erase/c1', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'EXCLUIR DADOS', reason: 'Solicitação formal do titular.' })
    }));
  });

  it('resposta de incidente encerra outras sessões sem revogar a sessão atual', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SecurityAdmin clients={clients} />);
    await user.click(screen.getByRole('button', { name: 'Encerrar outras sessões' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/security/sessions/revoke-all', {
      method: 'POST',
      body: JSON.stringify({ includeCurrent: false })
    }));
  });
});
