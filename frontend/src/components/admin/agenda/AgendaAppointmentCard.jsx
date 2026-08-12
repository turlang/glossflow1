import React from 'react';

const NOTE_COLORS = ['yellow', 'blue', 'pink', 'green', 'orange', 'purple'];

function colorFor(appointment) {
  const source = String(appointment.service?.id || appointment.serviceId || appointment.id || '');
  const index = Math.abs([...source].reduce((sum, char) => sum + char.charCodeAt(0), 0));
  return NOTE_COLORS[index % NOTE_COLORS.length];
}

export function AgendaAppointmentCard({ appointment, compact = false, onDragStart, onDragEnd, onReschedule }) {
  const start = new Date(appointment.startTime);
  const end = appointment.endTime ? new Date(appointment.endTime) : null;
  const startLabel = Number.isNaN(start.getTime()) ? '--:--' : start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endLabel = end && !Number.isNaN(end.getTime()) ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const draggable = typeof onDragStart === 'function';
  const canReschedule = typeof onReschedule === 'function';

  return (
    <article
      className={`enterprise-event ${colorFor(appointment)} ${compact ? 'compact' : ''}`}
      draggable={draggable}
      onDragStart={draggable ? () => onDragStart(appointment.id) : undefined}
      onDragEnd={draggable ? () => onDragEnd?.() : undefined}
      title={draggable || canReschedule ? 'Arraste para outro horário ou use Reagendar' : 'Visualização somente leitura'}
    >
      <time>{startLabel}{endLabel ? ` - ${endLabel}` : ''}</time>
      <strong>{appointment.clientName || appointment.client?.name || 'Cliente'}</strong>
      <span>{appointment.service?.name || 'Serviço'}</span>
      {!compact && <small>{appointment.professional?.name || 'Profissional'} • {appointment.status || 'CONFIRMED'}</small>}
      {canReschedule && (
        <button type="button" className="agenda-reschedule-trigger" onClick={() => onReschedule(appointment)} aria-label={`Reagendar ${appointment.clientName || appointment.client?.name || 'cliente'}`}>
          Reagendar
        </button>
      )}
    </article>
  );
}
