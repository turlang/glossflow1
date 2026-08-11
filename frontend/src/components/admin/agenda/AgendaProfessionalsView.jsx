import React from 'react';
import { AGENDA_HOURS } from './agenda-enterprise.utils.js';
import { AgendaAppointmentCard } from './AgendaAppointmentCard.jsx';

export function AgendaProfessionalsView({ selectedDate, appointments, professionals, draggingId, onDragStart, onDragEnd, onDrop, onReschedule }) {
  return (
    <div className="enterprise-timeline full-span" role="tabpanel" aria-label="Agenda por profissionais">
      {professionals.map((professional) => {
        const items = appointments.filter((appointment) => appointment.professionalId === professional.id || appointment.professional?.id === professional.id);
        return (
          <article className="timeline-lane" key={professional.id}>
            <header><strong>{professional.name}</strong><small>{professional.specialty}</small></header>
            <div className="timeline-track">
              {AGENDA_HOURS.map((hour) => (
                <div
                  className={`timeline-slot ${draggingId ? 'drop-enabled' : ''}`}
                  key={hour}
                  aria-label={`${professional.name}, ${selectedDate}, ${hour}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDrop(event, { dateIso: selectedDate, hour, professional })}
                >
                  <time>{hour}</time>
                  {items.filter((appointment) => appointment.hourKey === hour).map((appointment) => (
                    <AgendaAppointmentCard key={appointment.id} appointment={appointment} compact onDragStart={onDragStart} onDragEnd={onDragEnd} onReschedule={onReschedule} />
                  ))}
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
