import { useCallback, useState } from 'react';
import { request } from '../../../services/api.js';
import { buildRescheduleStart } from './agenda-enterprise.utils.js';

/** Único caminho de persistência para drag-and-drop e formulário acessível. */
export function useAgendaReschedule({ appointments, reload }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const reschedule = useCallback(async ({ appointmentId, dateIso, time, professionalId }) => {
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) throw new Error('Agendamento não encontrado.');

    const start = buildRescheduleStart(dateIso, time);
    if (!start) throw new Error('Data ou horário inválido para reagendamento.');

    const nextProfessionalId = professionalId || appointment.professionalId || appointment.professional?.id;
    if (!nextProfessionalId) throw new Error('Selecione um profissional para reagendar.');

    setBusy(true);
    setMessage('Reagendando horário...');
    try {
      await request(`/admin/appointments/${appointment.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          startTime: start.toISOString(),
          professionalId: nextProfessionalId,
          status: appointment.status || 'CONFIRMED'
        })
      });
      setMessage('Agendamento atualizado com sucesso.');
      await reload();
      return true;
    } catch (error) {
      setMessage(error?.message || 'Não foi possível reagendar.');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [appointments, reload]);

  return { reschedule, message, setMessage, busy };
}
