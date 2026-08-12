import React from 'react';
import { AgendaAppointmentCard } from './AgendaAppointmentCard.jsx';

export function AgendaMonthView({ monthDays, appointments, onOpenDay, onDragStart, onDragEnd, onReschedule }) {
  return (
    <div className="enterprise-month-board full-span" role="tabpanel" aria-label="Agenda mensal">
      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <strong className="month-weekday" key={day}>{day}</strong>)}
      {monthDays.map((day) => {
        const allItems = appointments.filter((appointment) => appointment.dateIso === day.iso);
        const items = allItems.slice(0, 4);
        return (
          <article className={`month-cell ${day.inMonth ? '' : 'muted'}`} key={day.iso}>
            <header>
              <time dateTime={day.iso}>{day.label}</time>
              <button type="button" className="month-open-day" onClick={() => onOpenDay(day.iso)} aria-label={`Abrir agenda de ${day.iso}`}>Abrir</button>
            </header>
            {items.map((appointment) => (
              <AgendaAppointmentCard key={appointment.id} appointment={appointment} compact onDragStart={onDragStart} onDragEnd={onDragEnd} onReschedule={onReschedule} />
            ))}
            {allItems.length > 4 && <small>+ {allItems.length - 4} atendimento(s)</small>}
          </article>
        );
      })}
    </div>
  );
}
