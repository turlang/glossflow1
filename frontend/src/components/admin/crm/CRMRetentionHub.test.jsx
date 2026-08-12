import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { request } from '../../../services/api.js';
import { CRMRetentionHub } from './CRMRetentionHub.jsx';

vi.mock('../../../services/api.js', () => ({ request: vi.fn() }));

const clients = [
  { id: 'c1', name: 'Carla', phone: '11999999999', email: 'carla@example.com', birthDate: null, preferences: '', notes: '' },
  { id: 'c2', name: 'Bianca', phone: '11888888888', email: '', birthDate: null, preferences: '', notes: '' }
];

const overview = {
  summary: {
    totalClients: 2,
    eligibleClients: 1,
    optedOut: 1,
    birthdays14d: 1,
    inactive60d: 1,
    inactive120d: 1,
    frequent90d: 1,
    followUpsInitiated180d: 1,
    reactivated30d: 1,
    reactivationRate: 100
  },
  clients: [
    {
      id: 'c1', name: 'Carla', phone: '11999999999', email: 'carla@example.com',
      primarySegment: 'BIRTHDAY', tags: ['BIRTHDAY', 'FREQUENT'], reason: 'Aniversário em 2 dia(s).',
      reasons: ['Aniversário em 2 dia(s).', '3 atendimentos nos últimos 90 dias.'], marketingAllowed: true,
      daysSinceLastVisit: 10, visits90d: 3, visits180d: 4, nextBirthdayInDays: 2
    },
    {
      id: 'c2', name: 'Bianca', phone: '11888888888', email: null,
      primarySegment: 'INACTIVE_120', tags: ['INACTIVE_120'], reason: 'Sem atendimento há 130 dias.',
      reasons: ['Sem atendimento há 130 dias.'], marketingAllowed: false,
      daysSinceLastVisit: 130, visits90d: 0, visits180d: 1, nextBirthdayInDays: null
    }
  ]
};

describe('CRMRetentionHub', () => {
  beforeEach(() => {
    request.mockImplementation(async (url, options = {}) => {
      if (url === '/admin/clients/retention') return overview;
      if (url === '/admin/clients/c1/history') {
        return {
          id: 'c1', name: 'Carla', phone: '11999999999',
          appointments: [{ id: 'a1', startTime: '2026-08-01T12:00:00.000Z', status: 'COMPLETED', service: { name: 'Corte' }, professional: { name: 'Ana' } }]
        };
      }
      if (url === '/admin/clients/c1/follow-up' && options.method === 'POST') {
        return { ok: true, message: 'Olá, Carla! Podemos ajudar com seu próximo horário.', whatsappUrl: 'https://wa.me/5511999999999?text=teste' };
      }
      if (url === '/admin/clients/c1/follow-up/contacted' && options.method === 'POST') return { ok: true };
      if (url.includes('/marketing-consent') && options.method === 'POST') return { id: 'consent-1' };
      return {};
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('exibe indicadores e explica a segmentação', async () => {
    render(<CRMRetentionHub clients={clients} reload={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Quem precisa de atenção agora' })).toBeTruthy();
    expect(screen.getByText('Aniversário em 2 dia(s).')).toBeTruthy();
    expect(screen.getByText(/3 atendimentos nos últimos 90 dias/i)).toBeTruthy();
    expect(screen.getByText('Reativação')).toBeTruthy();
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/clients/retention'));
  });

  it('filtra a fila por opt-out', async () => {
    const user = userEvent.setup();
    render(<CRMRetentionHub clients={clients} reload={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Carla' });
    await user.selectOptions(screen.getByLabelText('Segmento'), 'OPT_OUT');
    expect(screen.getByRole('heading', { name: 'Bianca' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Carla' })).toBeNull();
  });

  it('bloqueia follow-up para cliente com opt-out', async () => {
    render(<CRMRetentionHub clients={clients} reload={vi.fn()} />);
    const heading = await screen.findByRole('heading', { name: 'Bianca' });
    const card = heading.closest('article');
    expect(within(card).getByRole('button', { name: 'Preparar follow-up' }).disabled).toBe(true);
    expect(within(card).getByText('Opt-out ativo')).toBeTruthy();
  });

  it('prepara follow-up e só registra quando o WhatsApp é aberto', async () => {
    const user = userEvent.setup();
    render(<CRMRetentionHub clients={clients} reload={vi.fn()} />);
    const heading = await screen.findByRole('heading', { name: 'Carla' });
    const card = heading.closest('article');
    await user.click(within(card).getByRole('button', { name: 'Preparar follow-up' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/clients/c1/follow-up', { method: 'POST' }));
    expect(request).not.toHaveBeenCalledWith('/admin/clients/c1/follow-up/contacted', { method: 'POST' });

    const link = await screen.findByRole('link', { name: 'Abrir WhatsApp' });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    link.addEventListener('click', (event) => event.preventDefault(), { once: true });
    await user.click(link);
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/clients/c1/follow-up/contacted', { method: 'POST' }));
    expect(screen.getByText(/Podemos ajudar com seu próximo horário/i)).toBeTruthy();
  });

  it('carrega histórico somente quando solicitado', async () => {
    const user = userEvent.setup();
    render(<CRMRetentionHub clients={clients} reload={vi.fn()} />);
    const heading = await screen.findByRole('heading', { name: 'Carla' });
    await user.click(within(heading.closest('article')).getByRole('button', { name: 'Histórico' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/clients/c1/history'));
    expect(await screen.findByText('Corte')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
  });
});
