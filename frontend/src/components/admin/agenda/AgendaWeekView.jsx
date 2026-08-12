import React from 'react';
import { AGENDA_HOURS, appointmentsForSlot } from './agenda-enterprise.utils.js';
import { AgendaAppointmentCard } from './AgendaAppointmentCard.jsx';

export function AgendaWeekView({ weekDays, appointments, professionals, draggingId, onDragStart, onDragEnd, onDrop, onReschedule }) {
  const dragged = appointments.find((appointment) => appointment.id === draggingId);

  return (
    <div className="enterprise-week-board full-span" role="tabpanel" aria-label="Agenda semanal">
      {weekDays.map((day) => (
        <article className="enterprise-week-column" key={day.iso}>
          <header><strong>{day.label}</strong><span>{day.day}</span></header>
          {AGENDA_HOURS.map((hour) => {
            const items = appointmentsForSlot(appointments, { dateIso: day.iso, hour });
            const fallbackProfessional = dragged?.professional || professionals[0];
            return (
              <div
                className={`enterprise-week-slot ${draggingId ? 'drop-enabled' : ''}`}
                key={`${day.iso}-${hour}`}
                aria-label={`${day.iso}, ${hour}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, { dateIso: day.iso, hour, professional: fallbackProfessional })}
              >
                <time>{hour}</time>
                <div>
                  {items.length ? items.map((appointment) => (
                    <AgendaAppointmentCard key={appointment.id} appointment={appointment} compact onDragStart={onDragStart} onDragEnd={onDragEnd} onReschedule={onReschedule} />
                  )) : <span>Livre</span>}
                </div>
              </div>
            );
          })}
        </article>
      ))}
    </div>
  );
}
