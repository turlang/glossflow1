import React, { useMemo, useState } from 'react';
import { request } from '../../services/api';
import { currency } from '../../utils/format';

function pad(value) {
  return String(value).padStart(2, '0');
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shiftDate(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function durationLabel(minutes) {
  const value = Number(minutes || 0);
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date(`${value}T12:00:00`));
}

export function SmartFitAdmin({ services, professionals, setPage }) {
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(shiftDate(todayIso(), 1));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const service = useMemo(() => services.find((item) => item.id === serviceId) || null, [services, serviceId]);
  const eligibleProfessionals = useMemo(() => professionals.filter((professional) => {
    if (!serviceId || !professional.servicesConfigured) return true;
    return Array.isArray(professional.serviceIds) && professional.serviceIds.includes(serviceId);
  }), [professionals, serviceId]);

  async function calculate(event) {
    event?.preventDefault?.();
    if (!serviceId || !date) return;
    setLoading(true);
    setMessage('');
    setResult(null);
    try {
      const params = new URLSearchParams({ serviceId, date });
      if (professionalId) params.set('professionalId', professionalId);
      setResult(await request(`/admin/appointments/smart-fit?${params}`));
    } catch (error) {
      setMessage(error.message || 'Não foi possível calcular os melhores encaixes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="smart-fit-page">
      <div className="smart-fit-shell">
        <header className="smart-fit-header">
          <div>
            <span className="eyebrow">Agenda inteligente</span>
            <h1>Encaixe Inteligente</h1>
            <p>Priorize horários que aproveitam melhor os blocos livres e reduzem pequenos espaços ociosos entre atendimentos.</p>
          </div>
          <div className="smart-fit-actions">
            <button className="secondary" type="button" onClick={() => setPage('operational-agenda')}>Agenda Visual</button>
            <button className="secondary" type="button" onClick={() => setPage('waitlist')}>Lista de espera</button>
            <button className="secondary" type="button" onClick={() => setPage('professional-schedule')}>Jornada</button>
            <button className="secondary" type="button" onClick={() => setPage('admin')}>Painel</button>
          </div>
        </header>

        <section className="smart-fit-callout">
          <strong>Como o ranking funciona</strong>
          <span>O GlossFlow não escolhe apenas o primeiro horário livre. Ele prefere blocos que encostam no início/fim de uma janela disponível, evita dividir uma faixa grande em dois pedaços e penaliza intervalos menores do que o menor serviço ativo do salão.</span>
        </section>

        <form className="smart-fit-form" onSubmit={calculate}>
          <label>
            <span>Serviço</span>
            <select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setProfessionalId(''); setResult(null); }} required>
              <option value="">Selecione</option>
              {services.map((item) => <option key={item.id} value={item.id}>{item.name} · {durationLabel(item.durationMin)}</option>)}
            </select>
          </label>
          <label>
            <span>Data</span>
            <input type="date" min={todayIso()} value={date} onChange={(event) => { setDate(event.target.value); setResult(null); }} required />
          </label>
          <label>
            <span>Profissional</span>
            <select value={professionalId} onChange={(event) => { setProfessionalId(event.target.value); setResult(null); }}>
              <option value="">Qualquer profissional habilitado</option>
              {eligibleProfessionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button className="primary" type="submit" disabled={loading || !serviceId}>{loading ? 'Calculando…' : 'Encontrar melhores encaixes'}</button>
        </form>

        {service && (
          <section className="smart-fit-service-summary">
            <span><small>Serviço</small><strong>{service.name}</strong></span>
            <span><small>Duração</small><strong>{durationLabel(service.durationMin)}</strong></span>
            <span><small>Valor</small><strong>{currency(service.price)}</strong></span>
            <span><small>Dia analisado</small><strong>{dateLabel(date)}</strong></span>
          </section>
        )}

        {message && <p className="feedback error">{message}</p>}

        {result && (
          <section className="smart-fit-results">
            <div className="smart-fit-results-head">
              <div>
                <span className="eyebrow">Resultado</span>
                <h2>{result.totalCapacity} {result.totalCapacity === 1 ? 'vaga real disponível' : 'vagas reais disponíveis'}</h2>
                <p>As sugestões abaixo já respeitam especialidade, jornada, intervalos, férias, bloqueios, duração e agendamentos existentes.</p>
              </div>
              <span className="smart-fit-badge">BEST FIT</span>
            </div>

            {(result.suggestions || []).length ? (
              <div className="smart-fit-grid">
                {result.suggestions.map((slot, index) => (
                  <article className={`smart-fit-card ${slot.recommended ? 'is-recommended' : ''}`} key={`${slot.professionalId}-${slot.startTime}`}>
                    <div className="smart-fit-rank"><strong>#{index + 1}</strong><span>{slot.fitScore}/100</span></div>
                    <div className="smart-fit-time"><strong>{slot.label}</strong><span>{slot.professionalName}</span></div>
                    {slot.recommended && <b className="smart-fit-star">★ Melhor encaixe</b>}
                    <p>{slot.fitReason}</p>
                    <div className="smart-fit-space">
                      <span><small>Livre antes</small><strong>{durationLabel(slot.freeBeforeMin)}</strong></span>
                      <span><small>Livre depois</small><strong>{durationLabel(slot.freeAfterMin)}</strong></span>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="smart-fit-empty">Não existe bloco contínuo grande o suficiente para este serviço nesse dia.</p>}
          </section>
        )}
      </div>
    </main>
  );
}
