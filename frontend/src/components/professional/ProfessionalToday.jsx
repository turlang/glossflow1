import React, { useMemo } from 'react';

function localDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function appointmentDate(appointment) {
  return appointment?.startTime || appointment?.startAt || appointment?.startsAt || appointment?.scheduledAt || appointment?.date || appointment?.start || '';
}

function appointmentTime(appointment) {
  const date = new Date(appointmentDate(appointment));
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function nameOf(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.name || value.fullName || fallback;
}

export function ProfessionalToday({ appointments = [], setPage, now = new Date() }) {
  const todayKey = localDayKey(now);
  const today = useMemo(() => appointments
    .filter((appointment) => localDayKey(appointmentDate(appointment)) === todayKey)
    .sort((a, b) => new Date(appointmentDate(a)).getTime() - new Date(appointmentDate(b)).getTime()), [appointments, todayKey]);

  const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(now);
  const next = today.find(a => a.status === 'CONFIRMED' && new Date(appointmentDate(a)) >= now);

  return (
    <main className="professional-today" aria-label="Minha agenda de hoje">
      <header className="professional-today__header">
        <div><span className="professional-today__eyebrow">Minha agenda</span><h1>Hoje</h1><p>{dateLabel}</p></div>
        <button type="button" className="professional-today__secondary" onClick={() => setPage('login')}>Sair</button>
      </header>

      <section className="professional-today__summary" aria-label="Resumo do dia">
        <strong>{today.length}</strong><span>{today.length === 1 ? 'atendimento hoje' : 'atendimentos hoje'}</span>
      </section>

      {next && <section className="professional-today__summary" aria-label="Próximo atendimento"><div><span>Próximo atendimento</span><strong>{appointmentTime(next)}</strong><p>{next.clientName || nameOf(next.client, 'Cliente')}</p></div></section>}

      <section className="professional-today__list" aria-label="Atendimentos de hoje">
        {today.length === 0 && <div className="professional-today__empty"><strong>Agenda livre hoje</strong><span>Não há atendimentos marcados para este dia.</span></div>}
        {today.map((appointment) => (
          <article className="professional-today__appointment" key={appointment.id || `${appointmentDate(appointment)}-${nameOf(appointment.client, 'cliente')}`}>
            <time dateTime={appointmentDate(appointment)}>{appointmentTime(appointment)}</time>
            <div className="professional-today__details">
              <strong>{nameOf(appointment.client || appointment.clientName, 'Cliente')}</strong>
              <span>{nameOf(appointment.service || appointment.serviceName, 'Serviço')}</span>
              {appointment.service?.durationMin && <span>{appointment.service.durationMin} min</span>}
            </div>
            <span className="professional-today__status">{{ CONFIRMED: 'Confirmado', COMPLETED: 'Concluído', CANCELED: 'Cancelado' }[appointment.status] || 'Agendado'}</span>
          </article>
        ))}
      </section>

      <div className="professional-today__actions">
        <p>Para criar ou alterar um atendimento, fale com a recepção.</p>
        <button type="button" className="professional-today__secondary" onClick={() => setPage('professional-agenda')}>Ver outros dias</button>
      </div>
    </main>
  );
}
