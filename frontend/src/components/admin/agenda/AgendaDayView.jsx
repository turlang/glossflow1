import React from 'react';
import { AGENDA_HOURS, appointmentsForSlot } from './agenda-enterprise.utils.js';
import { AgendaAppointmentCard } from './AgendaAppointmentCard.jsx';

export function AgendaDayView({ selectedDate, appointments, professionals, draggingId, onDragStart, onDragEnd, onDrop, onReschedule }) {
  return (
    <div className="calendar-day-grid full-span" role="tabpanel" aria-label="Agenda do dia">
      <div className="calendar-time-rail">
        <span>Hora</span>
        {AGENDA_HOURS.map((hour) => <b key={hour}>{hour}</b>)}
      </div>
      <div className="calendar-day-columns" style={{ gridTemplateColumns: `repeat(${Math.max(1, professionals.length)}, minmax(220px, 1fr))` }}>
        {professionals.map((professional) => (
          <div className="calendar-professional-column" key={professional.id}>
            <header><strong>{professional.name}</strong><small>{professional.specialty}</small></header>
            {AGENDA_HOURS.map((hour) => (
              <div
                className={`calendar-slot ${draggingId ? 'drop-enabled' : ''}`}
                key={hour}
                aria-label={`${professional.name}, ${selectedDate}, ${hour}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, { dateIso: selectedDate, hour, professional })}
              >
                {appointmentsForSlot(appointments, { dateIso: selectedDate, hour, professional }).map((appointment) => (
                  <AgendaAppointmentCard key={appointment.id} appointment={appointment} onDragStart={onDragStart} onDragEnd={onDragEnd} onReschedule={onReschedule} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
