import React from 'react';
import { businessToday } from '../../utils/today.js';
import { currency } from '../../utils/format.js';
import { hasModule } from '../../utils/modules.js';
import { directBookingLink } from '../../config/booking-link.js';
import './business-today.css';

export function BusinessToday({
  appointments = [],
  financialEntries = [],
  professionals = [],
  inventory = [],
  salon,
  setPage,
  now = new Date()
}) {
  const data = businessToday(appointments, financialEntries, now);
  const financial = hasModule(salon, 'FINANCEIRO');
  const agenda = hasModule(salon, 'AGENDA');
  const lowStock = inventory.filter(
    (p) => p.active !== false && Number(p.quantity) <= Number(p.minimumQuantity || 0)
  );
  return (
    <main className="business-today">
      <header>
        <div>
          <span className="eyebrow">{salon?.name}</span>
          <h1>Meu negócio hoje</h1>
          <p>
            {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
          </p>
        </div>
        <div>
          <button className="primary" onClick={() => setPage('admin')}>
            Ver gestão completa
          </button>
          <button className="ghost-button" onClick={() => setPage('login')}>
            Sair
          </button>
        </div>
      </header>
      <section className="business-today__metrics" aria-label="Resumo de hoje">
        <article>
          <span>Atendimentos do dia</span>
          <strong>{agenda ? data.today.length : 'Indisponível'}</strong>
        </article>
        <article>
          <span>Concluídos</span>
          <strong>{agenda ? data.completed : 'Indisponível'}</strong>
        </article>
        <article>
          <span>Faturamento previsto</span>
          <strong>{agenda ? currency(data.expected) : 'Indisponível'}</strong>
          <small>Serviços do dia, sem cancelamentos e faltas</small>
        </article>
        <article>
          <span>Recebido no dia</span>
          <strong>{financial ? currency(data.received) : 'Indisponível'}</strong>
          <small>
            {financial ? 'Receitas pagas com referência de hoje' : 'Módulo Financeiro não habilitado'}
          </small>
        </article>
      </section>
      <div className="business-today__columns">
        <section className="panel-card">
          <h2>Seu link de agendamento</h2>
          <p>Use na bio do Instagram, no WhatsApp ou no QR Code.</p>
          <a href={directBookingLink(window.location.href, salon?.slug)}>
            {directBookingLink(window.location.href, salon?.slug)}
          </a>
        </section>
        <section className="panel-card">
          <h2>Próximos atendimentos</h2>
          {!data.next.length && (
            <p>{agenda ? 'Nenhum atendimento pendente hoje.' : 'Agenda não habilitada.'}</p>
          )}
          {data.next.slice(0, 8).map((a) => (
            <article className="business-today__row" key={a.id}>
              <time dateTime={a.startTime}>
                {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
                  new Date(a.startTime)
                )}
              </time>
              <div>
                <strong>{a.clientName}</strong>
                <p>
                  {a.service?.name} · {a.professional?.name}
                </p>
              </div>
            </article>
          ))}
          {agenda && (
            <button className="ghost-button" onClick={() => setPage('operational-agenda')}>
              Abrir agenda do dia
            </button>
          )}
        </section>
        <section className="panel-card">
          <h2>Equipe hoje</h2>
          {professionals
            .filter((p) => p.active !== false)
            .map((p) => (
              <p key={p.id}>
                {p.name}:{' '}
                {
                  data.today.filter(
                    (a) => a.professionalId === p.id && !['CANCELED', 'NO_SHOW'].includes(a.status)
                  ).length
                }{' '}
                atendimento(s)
              </p>
            ))}
        </section>
        <section className="panel-card">
          <h2>Atenção hoje</h2>
          <p>{data.today.filter((a) => a.status === 'CANCELED').length} cancelamento(s) no dia.</p>
          <p>
            {lowStock.length
              ? `${lowStock.length} produto(s) precisam de reposição.`
              : 'Sem alertas de estoque nos dados disponíveis.'}
          </p>
        </section>
      </div>
    </main>
  );
}
