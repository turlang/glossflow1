import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import { currency } from '../../utils/format';
import { Input, Textarea } from '../ui/Forms.jsx';

function tenantStyle(salon) {
  if (!salon) return undefined;
  return {
    '--gold': salon.primaryColor || '#C49A6C',
    '--gold-2': salon.accentColor || '#F7F1EA',
    '--primary': salon.primaryColor || '#C49A6C',
    '--primary-2': salon.secondaryColor || '#171311'
  };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(value, amount) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthTitle(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function dateTitle(value) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${value}T12:00:00`));
}

function dayNumber(value) {
  return Number(value.slice(-2));
}

function firstWeekday(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).getDay();
}

function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} min`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}min`;
}

export function PublicBookingCalendar({ services, professionals, onCreated, salon }) {
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [monthData, setMonthData] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [dayData, setDayData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({ clientName: '', clientPhone: '', clientEmail: '', notes: '' });

  const selectedService = services.find((service) => service.id === serviceId) || null;
  const eligibleProfessionals = useMemo(() => {
    if (!serviceId) return professionals;
    return professionals.filter((professional) => {
      if (!professional.servicesConfigured) return true;
      return Array.isArray(professional.serviceIds) && professional.serviceIds.includes(serviceId);
    });
  }, [professionals, serviceId]);

  useEffect(() => {
    if (!serviceId) {
      setMonthData(null);
      return;
    }

    let cancelled = false;
    setLoadingMonth(true);
    setFeedback('');
    const params = new URLSearchParams({ serviceId, month });
    if (professionalId) params.set('professionalId', professionalId);

    request(`/appointments/availability?${params}`)
      .then((data) => { if (!cancelled) setMonthData(data); })
      .catch((error) => { if (!cancelled) setFeedback(error.message); })
      .finally(() => { if (!cancelled) setLoadingMonth(false); });

    return () => { cancelled = true; };
  }, [serviceId, professionalId, month]);

  useEffect(() => {
    setSelectedDate('');
    setDayData(null);
    setSelectedSlot(null);
    setSuccess(null);
  }, [serviceId, professionalId, month]);

  const calendarCells = useMemo(() => {
    if (!monthData?.days) return [];
    return [...Array(firstWeekday(month)).fill(null), ...monthData.days];
  }, [monthData, month]);

  async function chooseDate(day) {
    if (!day || day.totalCapacity <= 0 || !serviceId) return;
    setSelectedDate(day.date);
    setSelectedSlot(null);
    setFeedback('');
    setLoadingDay(true);
    const params = new URLSearchParams({ serviceId, date: day.date });
    if (professionalId) params.set('professionalId', professionalId);
    try {
      setDayData(await request(`/appointments/availability?${params}`));
    } catch (error) {
      setFeedback(error.message);
      setDayData(null);
    } finally {
      setLoadingDay(false);
    }
  }

  function chooseService(id) {
    setServiceId(id);
    setProfessionalId('');
    setFeedback('');
  }

  function chooseProfessional(id) {
    setProfessionalId(id);
    setFeedback('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setFeedback('');
    try {
      await request('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          serviceId: selectedService.id,
          professionalId: selectedSlot.professionalId,
          startTime: selectedSlot.startTime
        })
      });
      setSuccess({
        service: selectedService.name,
        professional: selectedSlot.professionalName,
        date: selectedDate,
        time: selectedSlot.label
      });
      setSelectedSlot(null);
      setDayData(null);
      setSelectedDate('');
      setForm({ clientName: '', clientPhone: '', clientEmail: '', notes: '' });
      onCreated();
      const params = new URLSearchParams({ serviceId, month });
      if (professionalId) params.set('professionalId', professionalId);
      setMonthData(await request(`/appointments/availability?${params}`));
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="booking-experience" style={tenantStyle(salon)}>
      <div className="booking-shell">
        <header className="booking-hero">
          <span className="eyebrow">Agendamento online</span>
          <h1>Escolha o melhor momento para você</h1>
          <p>Primeiro escolha o serviço. O calendário calcula a capacidade real de cada profissional considerando duração do atendimento e horários já ocupados.</p>
        </header>

        <section className="booking-step">
          <div className="booking-step-head">
            <span className="booking-step-number">1</span>
            <div><strong>Escolha o serviço</strong><small>A duração define quanto espaço precisa existir na agenda.</small></div>
          </div>
          <div className="booking-service-grid">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                className={`booking-service ${serviceId === service.id ? 'is-selected' : ''}`}
                onClick={() => chooseService(service.id)}
              >
                <span>{service.name}</span>
                <strong>{currency(service.price)}</strong>
                <small>⏱ {durationLabel(service.durationMin)}</small>
              </button>
            ))}
          </div>
        </section>

        {selectedService && (
          <section className="booking-step">
            <div className="booking-step-head">
              <span className="booking-step-number">2</span>
              <div><strong>Profissional</strong><small>Mostramos somente quem está habilitado para executar este serviço.</small></div>
            </div>
            {eligibleProfessionals.length > 0 ? (
              <div className="booking-professional-row">
                <button type="button" className={`booking-pro-chip ${!professionalId ? 'is-selected' : ''}`} onClick={() => chooseProfessional('')}>
                  <span className="booking-pro-avatar">★</span><span><strong>Qualquer profissional</strong><small>Mostrar maior disponibilidade</small></span>
                </button>
                {eligibleProfessionals.map((professional) => (
                  <button key={professional.id} type="button" className={`booking-pro-chip ${professionalId === professional.id ? 'is-selected' : ''}`} onClick={() => chooseProfessional(professional.id)}>
                    {professional.photoUrl
                      ? <img className="booking-pro-avatar" src={professional.photoUrl} alt="" />
                      : <span className="booking-pro-avatar">{professional.name.charAt(0)}</span>}
                    <span><strong>{professional.name}</strong><small>{professional.specialty}</small></span>
                  </button>
                ))}
              </div>
            ) : <p className="booking-empty-copy">Nenhum profissional está configurado para este serviço no momento.</p>}
          </section>
        )}

        {selectedService && eligibleProfessionals.length > 0 && (
          <section className="booking-step">
            <div className="booking-step-head booking-calendar-heading">
              <div className="booking-step-head-copy">
                <span className="booking-step-number">3</span>
                <div><strong>Escolha o dia</strong><small>“Vagas” = atendimentos completos que ainda cabem no dia.</small></div>
              </div>
              <div className="booking-month-nav">
                <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= currentMonth()} aria-label="Mês anterior">‹</button>
                <strong>{monthTitle(month)}</strong>
                <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês">›</button>
              </div>
            </div>

            <div className="booking-capacity-note">
              <strong>{selectedService.name}</strong> ocupa <strong>{durationLabel(selectedService.durationMin)}</strong>. Por isso um dia com vários horários de início pode ter apenas 1 ou 2 vagas reais.
            </div>

            {loadingMonth ? <div className="booking-loading">Calculando disponibilidade real…</div> : (
              <div className="booking-calendar">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label) => <div key={label} className="booking-weekday">{label}</div>)}
                {calendarCells.map((day, index) => day ? (
                  <button
                    type="button"
                    key={day.date}
                    className={`booking-day ${selectedDate === day.date ? 'is-selected' : ''} ${day.totalCapacity <= 0 ? 'is-unavailable' : ''}`}
                    onClick={() => chooseDate(day)}
                    disabled={day.totalCapacity <= 0}
                  >
                    <span className="booking-day-number">{dayNumber(day.date)}</span>
                    <strong>{day.totalCapacity > 0 ? `${day.totalCapacity} ${day.totalCapacity === 1 ? 'vaga' : 'vagas'}` : 'Lotado'}</strong>
                    <span className="booking-day-professionals">
                      {day.professionals.filter((item) => item.capacity > 0).slice(0, 3).map((item) => (
                        <small key={item.professionalId}>{item.professionalName.split(' ')[0]} · {item.capacity}</small>
                      ))}
                    </span>
                  </button>
                ) : <div className="booking-day is-empty" key={`blank-${index}`} />)}
              </div>
            )}
          </section>
        )}

        {selectedDate && (
          <section className="booking-step booking-slots-section">
            <div className="booking-step-head">
              <span className="booking-step-number">4</span>
              <div><strong>Horários em {dateTitle(selectedDate)}</strong><small>Escolha o profissional e o horário que preferir.</small></div>
            </div>
            {loadingDay ? <div className="booking-loading">Abrindo horários…</div> : (
              <div className="booking-day-detail">
                {(dayData?.professionals || []).map((professional) => (
                  <article className="booking-pro-availability" key={professional.id}>
                    <div className="booking-pro-summary">
                      <div>
                        <strong>{professional.name}</strong>
                        <small>{professional.specialty}</small>
                      </div>
                      <span>{professional.capacity} {professional.capacity === 1 ? 'vaga real' : 'vagas reais'}</span>
                    </div>
                    {professional.slots.length ? (
                      <div className="booking-slot-grid">
                        {professional.slots.map((slot) => {
                          const active = selectedSlot?.professionalId === professional.id && selectedSlot?.startTime === slot.startTime;
                          return (
                            <button
                              type="button"
                              key={`${professional.id}-${slot.startTime}`}
                              className={`booking-slot ${active ? 'is-selected' : ''}`}
                              onClick={() => setSelectedSlot({ ...slot, professionalId: professional.id, professionalName: professional.name })}
                            >{slot.label}</button>
                          );
                        })}
                      </div>
                    ) : <p className="booking-empty-copy">Sem horários que comportem este serviço nesse dia.</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedSlot && (
          <section className="booking-checkout">
            <div className="booking-summary-card">
              <span className="eyebrow">Seu horário</span>
              <h2>{selectedService.name}</h2>
              <p>{dateTitle(selectedDate)} · <strong>{selectedSlot.label}</strong></p>
              <p>{selectedSlot.professionalName} · {durationLabel(selectedService.durationMin)}</p>
              <strong className="booking-summary-price">{currency(selectedService.price)}</strong>
            </div>
            <form className="booking-client-form" onSubmit={submit}>
              <h2>Seus dados</h2>
              <div className="booking-contact-grid">
                <Input label="Nome" value={form.clientName} onChange={(clientName) => setForm({ ...form, clientName })} required />
                <Input label="WhatsApp" value={form.clientPhone} onChange={(clientPhone) => setForm({ ...form, clientPhone })} required />
                <Input label="E-mail opcional" type="email" value={form.clientEmail} onChange={(clientEmail) => setForm({ ...form, clientEmail })} />
              </div>
              <Textarea label="Observações" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
              <button className="primary full" type="submit" disabled={submitting}>{submitting ? 'Reservando…' : 'Confirmar este horário'}</button>
            </form>
          </section>
        )}

        {success && (
          <section className="booking-success" aria-live="polite">
            <span>✓</span>
            <div><strong>Horário reservado!</strong><p>{success.service} · {success.time} com {success.professional}. O agendamento já está na agenda do {salon?.name || 'salão'}.</p></div>
          </section>
        )}
        {feedback && <p className="feedback booking-feedback">{feedback}</p>}
      </div>

      <style>{`
        .booking-experience{min-height:70vh;padding:48px 20px 80px;background:radial-gradient(circle at 10% 0%,color-mix(in srgb,var(--primary) 13%,transparent),transparent 32%)}
        .booking-shell{max-width:1180px;margin:0 auto;display:grid;gap:22px}.booking-hero{max-width:760px;padding:12px 0 8px}.booking-hero h1{font-size:clamp(2rem,4vw,3.6rem);margin:8px 0 10px;letter-spacing:-.04em}.booking-hero p{max-width:700px;color:var(--muted);font-size:1.04rem}
        .booking-step,.booking-checkout{border:1px solid var(--border);background:var(--surface);border-radius:24px;padding:24px}.booking-step-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}.booking-step-head>div{display:grid;gap:3px}.booking-step-head strong{font-size:1.05rem}.booking-step-head small{color:var(--muted)}.booking-step-number{display:grid;place-items:center;min-width:34px;height:34px;border-radius:12px;background:var(--primary);color:#111;font-weight:900}
        .booking-service-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.booking-service{display:grid;text-align:left;gap:7px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:18px;padding:16px;cursor:pointer}.booking-service>span{font-weight:800}.booking-service>strong{font-size:1.05rem}.booking-service small{color:var(--muted)}.booking-service.is-selected,.booking-pro-chip.is-selected,.booking-slot.is-selected{border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 22%,transparent);background:color-mix(in srgb,var(--primary) 8%,var(--card))}
        .booking-professional-row{display:flex;gap:10px;overflow-x:auto;padding-bottom:5px}.booking-pro-chip{min-width:220px;display:flex;align-items:center;gap:11px;text-align:left;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:18px;padding:11px 14px;cursor:pointer}.booking-pro-chip>span:last-child{display:grid;gap:2px}.booking-pro-chip small{color:var(--muted)}.booking-pro-avatar{width:42px;height:42px;min-width:42px;border-radius:50%;object-fit:cover;display:grid;place-items:center;background:color-mix(in srgb,var(--primary) 18%,var(--card));font-weight:900}
        .booking-calendar-heading{justify-content:space-between;align-items:center}.booking-step-head-copy{display:flex!important;align-items:center;gap:12px}.booking-month-nav{display:flex!important;align-items:center;gap:10px}.booking-month-nav strong{text-transform:capitalize;min-width:160px;text-align:center}.booking-month-nav button{width:38px;height:38px;border-radius:12px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:1.4rem;cursor:pointer}.booking-month-nav button:disabled{opacity:.3;cursor:not-allowed}.booking-capacity-note{margin:-4px 0 18px;padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--primary) 8%,var(--card));color:var(--muted)}
        .booking-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.booking-weekday{text-align:center;color:var(--muted);font-size:.78rem;font-weight:800;padding:5px}.booking-day{min-height:118px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:16px;padding:10px;display:flex;flex-direction:column;align-items:flex-start;gap:7px;cursor:pointer;text-align:left}.booking-day:hover:not(:disabled){transform:translateY(-1px);border-color:color-mix(in srgb,var(--primary) 55%,var(--border))}.booking-day.is-selected{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 8%,var(--card))}.booking-day.is-unavailable{opacity:.42;cursor:not-allowed}.booking-day.is-empty{border:0;background:transparent}.booking-day-number{font-weight:900;font-size:1.05rem}.booking-day>strong{font-size:.82rem}.booking-day-professionals{display:grid;gap:2px;color:var(--muted);font-size:.72rem}.booking-day-professionals small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
        .booking-loading,.booking-empty-copy{padding:20px;color:var(--muted);text-align:center}.booking-day-detail{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.booking-pro-availability{border:1px solid var(--border);background:var(--card);border-radius:18px;padding:16px}.booking-pro-summary{display:flex;justify-content:space-between;gap:10px;align-items:start;margin-bottom:13px}.booking-pro-summary>div{display:grid;gap:3px}.booking-pro-summary small{color:var(--muted)}.booking-pro-summary>span{font-size:.76rem;font-weight:900;padding:6px 9px;border-radius:999px;background:color-mix(in srgb,var(--primary) 12%,var(--surface))}.booking-slot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:8px}.booking-slot{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:12px;padding:10px 8px;font-weight:800;cursor:pointer}
        .booking-checkout{display:grid;grid-template-columns:minmax(260px,.75fr) minmax(0,1.5fr);gap:22px}.booking-summary-card{border-radius:18px;padding:20px;background:color-mix(in srgb,var(--primary) 10%,var(--card));align-self:start}.booking-summary-card h2{margin:8px 0}.booking-summary-card p{color:var(--muted);margin:8px 0}.booking-summary-price{display:block;font-size:1.45rem;margin-top:16px}.booking-client-form{display:grid;gap:14px}.booking-client-form h2{margin:0}.booking-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.booking-contact-grid>*:last-child{grid-column:1/-1}
        .booking-success{display:flex;gap:14px;align-items:center;padding:18px 20px;border-radius:18px;border:1px solid color-mix(in srgb,#3fb950 40%,var(--border));background:color-mix(in srgb,#3fb950 8%,var(--surface))}.booking-success>span{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#3fb950;color:#07150a;font-weight:1000;font-size:1.25rem}.booking-success p{margin:4px 0 0;color:var(--muted)}.booking-feedback{max-width:760px}
        @media(max-width:720px){.booking-experience{padding:28px 10px 70px}.booking-step,.booking-checkout{padding:15px;border-radius:18px}.booking-service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.booking-calendar-heading{align-items:flex-start;gap:16px;flex-direction:column}.booking-month-nav{width:100%;justify-content:space-between}.booking-month-nav strong{min-width:0}.booking-calendar{gap:4px}.booking-weekday{font-size:.67rem;padding:3px}.booking-day{min-height:72px;border-radius:10px;padding:7px 5px;gap:4px}.booking-day-number{font-size:.88rem}.booking-day>strong{font-size:.64rem;line-height:1.1}.booking-day-professionals{display:none}.booking-day-detail{grid-template-columns:1fr}.booking-checkout{grid-template-columns:1fr}.booking-contact-grid{grid-template-columns:1fr}.booking-contact-grid>*:last-child{grid-column:auto}.booking-pro-chip{min-width:190px}.booking-service{padding:13px}.booking-capacity-note{font-size:.86rem}}
      `}</style>
    </main>
  );
}
