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

      <style>{`
        .smart-fit-page{min-height:75vh;padding:40px 18px 80px;background:radial-gradient(circle at 8% 0%,color-mix(in srgb,var(--gold) 11%,transparent),transparent 30%)}.smart-fit-shell{max-width:1180px;margin:0 auto;display:grid;gap:20px}.smart-fit-header{display:flex;justify-content:space-between;align-items:flex-start;gap:22px}.smart-fit-header>div:first-child{max-width:780px}.smart-fit-header h1{margin:7px 0 8px;font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.04em}.smart-fit-header p{margin:0;color:var(--muted)}.smart-fit-actions{display:flex;gap:8px;flex-wrap:wrap}.smart-fit-callout{display:grid;gap:5px;padding:17px 19px;border:1px solid color-mix(in srgb,var(--gold) 42%,var(--border));border-radius:18px;background:color-mix(in srgb,var(--gold) 8%,var(--surface))}.smart-fit-callout span{color:var(--muted)}
        .smart-fit-form{display:grid;grid-template-columns:1.4fr .9fr 1.2fr auto;gap:10px;align-items:end;border:1px solid var(--border);background:var(--surface);border-radius:20px;padding:17px}.smart-fit-form label{display:grid;gap:5px;color:var(--muted);font-size:.78rem}.smart-fit-form select,.smart-fit-form input{height:44px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);padding:0 11px}.smart-fit-form button{height:44px}.smart-fit-service-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.smart-fit-service-summary span{display:grid;gap:3px;padding:13px 15px;border:1px solid var(--border);background:var(--surface);border-radius:16px}.smart-fit-service-summary small{color:var(--muted)}
        .smart-fit-results{display:grid;gap:15px}.smart-fit-results-head{display:flex;justify-content:space-between;gap:20px;align-items:start}.smart-fit-results-head h2{margin:5px 0}.smart-fit-results-head p{margin:0;color:var(--muted)}.smart-fit-badge{font-size:.72rem;font-weight:950;letter-spacing:.08em;padding:8px 11px;border-radius:999px;background:color-mix(in srgb,var(--gold) 18%,var(--surface));border:1px solid color-mix(in srgb,var(--gold) 42%,var(--border))}.smart-fit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.smart-fit-card{display:grid;gap:11px;padding:17px;border:1px solid var(--border);background:var(--surface);border-radius:20px}.smart-fit-card.is-recommended{border-color:color-mix(in srgb,var(--gold) 60%,var(--border));box-shadow:0 0 0 1px color-mix(in srgb,var(--gold) 20%,transparent)}.smart-fit-rank{display:flex;justify-content:space-between;align-items:center}.smart-fit-rank>strong{font-size:1.1rem}.smart-fit-rank>span{font-size:.74rem;font-weight:900;padding:5px 8px;border-radius:999px;background:var(--card)}.smart-fit-time{display:grid;gap:2px}.smart-fit-time>strong{font-size:1.45rem}.smart-fit-time>span{color:var(--muted)}.smart-fit-star{color:var(--gold);font-size:.78rem}.smart-fit-card p{margin:0;color:var(--muted);font-size:.86rem;min-height:42px}.smart-fit-space{display:grid;grid-template-columns:1fr 1fr;gap:7px}.smart-fit-space span{display:grid;gap:2px;padding:9px;border-radius:12px;background:var(--card)}.smart-fit-space small{color:var(--muted);font-size:.68rem}.smart-fit-empty{padding:24px;border:1px dashed var(--border);border-radius:18px;color:var(--muted);text-align:center}
        @media(max-width:900px){.smart-fit-header{display:grid}.smart-fit-form{grid-template-columns:1fr 1fr}.smart-fit-form button{grid-column:1/-1}.smart-fit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.smart-fit-service-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:560px){.smart-fit-page{padding:24px 9px 60px}.smart-fit-actions>*{flex:1}.smart-fit-form{grid-template-columns:1fr}.smart-fit-form button{grid-column:auto}.smart-fit-grid{grid-template-columns:1fr}.smart-fit-service-summary{grid-template-columns:1fr 1fr}.smart-fit-results-head{display:grid}}
      `}</style>
    </main>
  );
}
