import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaEnterprise } from './AgendaEnterprise.jsx';

const professionals = [
  { id: 'p1', name: 'Ana', specialty: 'Cabelo' },
  { id: 'p2', name: 'Bia', specialty: 'Unhas' }
];

const appointments = [
  {
    id: 'a1',
    clientName: 'Carla',
    professionalId: 'p1',
    professional: professionals[0],
    service: { id: 's1', name: 'Corte', price: 120 },
    startTime: '2026-08-11T09:00:00.000Z',
    endTime: '2026-08-11T10:00:00.000Z',
    status: 'CONFIRMED'
  },
  {
    id: 'a2',
    clientName: 'Dani',
    professionalId: 'p2',
    professional: professionals[1],
    service: { id: 's2', name: 'Manicure', price: 90 },
    startTime: '2026-08-12T10:00:00.000Z',
    endTime: '2026-08-12T11:00:00.000Z',
    status: 'CONFIRMED'
  }
];

describe('AgendaEnterprise', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-11T12:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('abre por padrão na visualização semanal', () => {
    render(<AgendaEnterprise appointments={appointments} professionals={professionals} reload={vi.fn()} />);
    expect(screen.getByRole('tabpanel', { name: 'Agenda semanal' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Semana' }).getAttribute('aria-selected')).toBe('true');
  });

  it('troca para a visualização diária por clique', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AgendaEnterprise appointments={appointments} professionals={professionals} reload={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Dia' }));
    expect(screen.getByRole('tabpanel', { name: 'Agenda do dia' })).toBeTruthy();
  });

  it('navega entre tabs com teclado', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AgendaEnterprise appointments={appointments} professionals={professionals} reload={vi.fn()} />);
    const weekTab = screen.getByRole('tab', { name: 'Semana' });
    weekTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Mês' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Agenda mensal' })).toBeTruthy();
  });

  it('abre um dia específico a partir da visão mensal', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AgendaEnterprise appointments={appointments} professionals={professionals} reload={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Mês' }));
    await user.click(screen.getByRole('button', { name: 'Abrir agenda de 2026-08-12' }));
    expect(screen.getByRole('tabpanel', { name: 'Agenda do dia' })).toBeTruthy();
    expect(screen.getByLabelText('Data').value).toBe('2026-08-12');
  });

  it('filtra a agenda pelo profissional selecionado', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AgendaEnterprise appointments={appointments} professionals={professionals} reload={vi.fn()} />);
    expect(screen.getByText('Carla')).toBeTruthy();
    expect(screen.getByText('Dani')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Profissional'), 'p2');
    expect(screen.queryByText('Carla')).toBeNull();
    expect(screen.getByText('Dani')).toBeTruthy();
  });

  it('remove drag e reagendamento quando a Agenda está em modo somente leitura', () => {
    render(<AgendaEnterprise appointments={appointments} professionals={professionals} reload={vi.fn()} readOnly />);
    expect(screen.getByText('Visualização somente leitura para o perfil Profissional.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reagendar/i })).toBeNull();
    expect(screen.getByText('Carla').closest('article').draggable).toBe(false);
  });
});
