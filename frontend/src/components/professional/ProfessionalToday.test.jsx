import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfessionalToday } from './ProfessionalToday.jsx';

describe('ProfessionalToday', () => {
  it('mostra somente os atendimentos do dia em ordem cronológica', () => {
    const appointments = [
      { id: '2', startAt: '2026-10-04T14:00:00', client: { name: 'Carla' }, service: { name: 'Escova' } },
      { id: '3', startAt: '2026-10-05T09:00:00', client: { name: 'Outro dia' }, service: { name: 'Corte' } },
      { id: '1', startAt: '2026-10-04T09:00:00', client: { name: 'Maria' }, service: { name: 'Corte' } }
    ];
    render(<ProfessionalToday appointments={appointments} setPage={vi.fn()} now={new Date('2026-10-04T08:00:00')} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('Outro dia')).not.toBeInTheDocument();
    const names = screen.getAllByRole('article').map((node) => node.textContent);
    expect(names[0]).toContain('Maria');
    expect(names[1]).toContain('Carla');
  });

  it('leva para a agenda completa a partir da ação de outros dias', () => {
    const setPage = vi.fn();
    render(<ProfessionalToday appointments={[]} setPage={setPage} now={new Date('2026-10-04T08:00:00')} />);
    screen.getByRole('button', { name: 'Ver outros dias' }).click();
    expect(setPage).toHaveBeenCalledWith('operational-agenda');
  });
});
