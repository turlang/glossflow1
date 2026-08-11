import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaRescheduleForm } from './AgendaRescheduleForm.jsx';

const professionals = [
  { id: 'p1', name: 'Ana' },
  { id: 'p2', name: 'Bia' }
];

const appointment = {
  id: 'a1',
  clientName: 'Carla',
  professionalId: 'p1',
  professional: professionals[0],
  service: { id: 's1', name: 'Corte' },
  startTime: '2026-08-11T09:00:00.000Z'
};

describe('AgendaRescheduleForm', () => {
  it('permite reagendar só pelo teclado e envia data, hora e profissional', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();

    render(
      <AgendaRescheduleForm
        appointment={appointment}
        professionals={professionals}
        busy={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(document.activeElement).toBe(screen.getByLabelText('Data'));
    await user.clear(screen.getByLabelText('Data'));
    await user.type(screen.getByLabelText('Data'), '2026-08-15');
    await user.clear(screen.getByLabelText('Horário'));
    await user.type(screen.getByLabelText('Horário'), '14:30');
    await user.selectOptions(screen.getByLabelText('Profissional'), 'p2');
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onConfirm).toHaveBeenCalledWith({
      appointmentId: 'a1',
      dateIso: '2026-08-15',
      time: '14:30',
      professionalId: 'p2'
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('mantém o formulário aberto e anuncia conflito retornado pela API', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Este profissional já possui agendamento neste horário.'));
    const onCancel = vi.fn();

    render(
      <AgendaRescheduleForm
        appointment={appointment}
        professionals={professionals}
        busy={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Confirmar reagendamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este profissional já possui agendamento neste horário.');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('form', { name: 'Reagendar atendimento' })).toBeTruthy();
  });
});
