import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaCommercialHub } from './AgendaCommercialHub.jsx';
import { ROLES } from '../../utils/auth.js';

const professionals = [{ id: 'p1', name: 'Ana', specialty: 'Cabelo' }];
const services = [{ id: 's1', name: 'Corte', price: 120 }];
const appointments = [{
  id: 'a1',
  clientName: 'Carla',
  professionalId: 'p1',
  professional: professionals[0],
  service: services[0],
  startTime: '2026-08-11T09:00:00.000Z',
  endTime: '2026-08-11T10:00:00.000Z',
  status: 'CONFIRMED'
}];

function renderHub(role, setPage = vi.fn()) {
  render(
    <AgendaCommercialHub
      role={role}
      appointments={appointments}
      professionals={professionals}
      services={services}
      reload={vi.fn()}
      setPage={setPage}
    />
  );
  return setPage;
}

describe('AgendaCommercialHub', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-11T12:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('oferece a central operacional completa para ADMIN', () => {
    renderHub(ROLES.ADMIN);
    expect(screen.getByRole('button', { name: /Operação do dia/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Encaixe inteligente/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Lista de espera/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Jornada da equipe/i })).toBeTruthy();
  });

  it('leva a recepção diretamente para a operação diária', async () => {
    const setPage = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderHub(ROLES.RECEPTION, setPage);
    await user.click(screen.getByRole('button', { name: /Operação do dia/i }));
    expect(setPage).toHaveBeenCalledWith('operational-agenda');
  });

  it('mantém PROFESSIONAL em Agenda somente leitura sem ações gerenciais', () => {
    renderHub(ROLES.PROFESSIONAL);
    expect(screen.getByText('Sua agenda de trabalho')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Operação do dia/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Lista de espera/i })).toBeNull();
    expect(screen.getByText('Visualização somente leitura para o perfil Profissional.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reagendar/i })).toBeNull();
  });
});
