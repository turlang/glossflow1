import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import { currency } from '../../utils/format';
import { Input, Textarea } from '../ui/Forms.jsx';
import { PublicWaitlistForm } from './PublicWaitlistForm.jsx';

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

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
  const selectedProfessional = eligibleProfessionals.find((professional) => professional.id === professionalId) || null;

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
    if (!day || !serviceId || day.date < todayIso()) return;
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
              <button key={service.id} type="button" className={`booking-service ${serviceId === service.id ? 'is-selected' : ''}`} onClick={() => chooseService(service.id)}>
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
                    {professional.photoUrl ? <img className="booking-pro-avatar" src={professional.photoUrl} alt="" /> : <span className="booking-pro-avatar">{professional.name.charAt(0)}</span>}
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
                <div><strong>Escolha o dia</strong><small>Dias lotados podem ser abertos para entrar na lista de espera.</small></div>
              </div>
              <div className="booking-month-nav">
                <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= currentMonth()} aria-label="Mês anterior">‹</button>
                <strong>{monthTitle(month)}</strong>
                <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês">›</button>
              </div>
            </div>

            <div className="booking-capacity-note">
              <strong>{selectedService.name}</strong> ocupa <strong>{durationLabel(selectedService.durationMin)}</strong>. “Vagas” representa atendimentos completos que realmente cabem no dia.
            </div>

            {loadingMonth ? <div className="booking-loading">Calculando disponibilidade real…</div> : (
              <div className="booking-calendar">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label) => <div key={label} className="booking-weekday">{label}</div>)}
                {calendarCells.map((day, index) => day ? (() => {
                  const past = day.date < todayIso();
                  return (
                    <button
                      type="button"
                      key={day.date}
                      className={`booking-day ${selectedDate === day.date ? 'is-selected' : ''} ${day.totalCapacity <= 0 ? 'is-full' : ''} ${past ? 'is-past' : ''}`}
                      onClick={() => chooseDate(day)}
                      disabled={past}
                    >
                      <span className="booking-day-number">{dayNumber(day.date)}</span>
                      <strong>{day.totalCapacity > 0 ? `${day.totalCapacity} ${day.totalCapacity === 1 ? 'vaga' : 'vagas'}` : 'Lista de espera'}</strong>
                      <span className="booking-day-professionals">
                        {day.professionals.filter((item) => item.capacity > 0).slice(0, 3).map((item) => <small key={item.professionalId}>{item.professionalName.split(' ')[0]} · {item.capacity}</small>)}
                      </span>
                    </button>
                  );
                })() : <div className="booking-day is-empty" key={`blank-${index}`} />)}
              </div>
            )}
          </section>
        )}

        {selectedDate && (
          <section className="booking-step booking-slots-section">
            <div className="booking-step-head">
              <span className="booking-step-number">4</span>
              <div><strong>Horários em {dateTitle(selectedDate)}</strong><small>Escolha um horário ou entre na fila se não houver encaixe compatível.</small></div>
            </div>
            {loadingDay ? <div className="booking-loading">Abrindo horários…</div> : (
              <div className="booking-day-detail">
                {(dayData?.professionals || []).map((professional) => (
                  <article className="booking-pro-availability" key={professional.id}>
                    <div className="booking-pro-summary">
                      <div><strong>{professional.name}</strong><small>{professional.specialty}</small></div>
                      <span>{professional.capacity} {professional.capacity === 1 ? 'vaga real' : 'vagas reais'}</span>
                    </div>
                    {professional.slots.length ? (
                      <div className="booking-slot-grid">
                        {professional.slots.map((slot) => {
                          const active = selectedSlot?.professionalId === professional.id && selectedSlot?.startTime === slot.startTime;
                          return (
                            <button type="button" key={`${professional.id}-${slot.startTime}`} className={`booking-slot ${active ? 'is-selected' : ''}`} onClick={() => setSelectedSlot({ ...slot, professionalId: professional.id, professionalName: professional.name })}>
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : <p className="booking-empty-copy">Sem horários que comportem este serviço nesse dia.</p>}
                  </article>
                ))}
                {dayData && dayData.totalCapacity <= 0 && (
                  <PublicWaitlistForm service={selectedService} date={selectedDate} professionalId={professionalId} professionalName={selectedProfessional?.name || ''} salon={salon} />
                )}
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
    </main>
  );
}
