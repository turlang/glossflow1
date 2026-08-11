import React, { useEffect, useRef, useState } from 'react';
import { Input, Select } from '../../ui/Forms.jsx';
import { localDateFromTimestamp } from './agenda-enterprise.utils.js';

export function AgendaRescheduleForm({ appointment, professionals, busy, onCancel, onConfirm }) {
  const initialStart = new Date(appointment.startTime);
  const [dateIso, setDateIso] = useState(localDateFromTimestamp(appointment.startTime));
  const [time, setTime] = useState(Number.isNaN(initialStart.getTime()) ? '08:00' : `${String(initialStart.getHours()).padStart(2, '0')}:${String(initialStart.getMinutes()).padStart(2, '0')}`);
  const [professionalId, setProfessionalId] = useState(appointment.professionalId || appointment.professional?.id || '');
  const [error, setError] = useState('');
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await onConfirm({ appointmentId: appointment.id, dateIso, time, professionalId });
      onCancel();
    } catch (submitError) {
      setError(submitError?.message || 'Não foi possível reagendar.');
    }
  }

  return (
    <form className="agenda-reschedule-form" onSubmit={submit} aria-label="Reagendar atendimento" aria-busy={busy}>
      <div>
        <span className="eyebrow">Reagendamento</span>
        <h3>{appointment.clientName || appointment.client?.name || 'Cliente'}</h3>
        <p>{appointment.service?.name || 'Serviço'} • {appointment.professional?.name || 'Profissional'}</p>
      </div>
      <label>
        <span>Data</span>
        <input ref={firstField} type="date" value={dateIso} onChange={(event) => setDateIso(event.target.value)} required />
      </label>
      <Input label="Horário" type="time" value={time} onChange={setTime} required />
      <Select label="Profissional" value={professionalId} onChange={setProfessionalId} options={professionals.map((professional) => ({ value: professional.id, label: professional.name }))} required />
      {error && <p className="feedback danger" role="alert">{error}</p>}
      <div className="agenda-reschedule-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Salvando...' : 'Confirmar reagendamento'}</button>
      </div>
    </form>
  );
}
