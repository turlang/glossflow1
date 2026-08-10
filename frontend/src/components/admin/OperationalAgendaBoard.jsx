import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import { currency } from '../../utils/format';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 38;

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

function dateLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

function timeLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function localDateIso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function minutesOf(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function minutesFromTime(value, fallback = 0) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return fallback;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(value) {
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
}

function durationLabel(minutes) {
  const value = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function effectiveSchedule(professional, defaultSchedule) {
  if (professional?.workScheduleConfigured && professional?.weeklySchedule && typeof professional.weeklySchedule === 'object') {
    return professional.weeklySchedule;
  }
  return defaultSchedule || {};
}

function daySchedule(professional, defaultSchedule, dateIso) {
  const weekday = new Date(`${dateIso}T12:00:00`).getDay();
  const schedule = effectiveSchedule(professional, defaultSchedule);
  return schedule?.[DAY_KEYS[weekday]] || { enabled: false, start: '09:00', end: '19:00', breaks: [] };
}

function overlapsDay(block, dateIso) {
  const start = new Date(block.startTime);
  const end = new Date(block.endTime);
  const dayStart = new Date(`${dateIso}T00:00:00`);
  const dayEnd = new Date(`${shiftDate(dateIso, 1)}T00:00:00`);
  return start < dayEnd && end > dayStart;
}

function clippedBlock(block, dateIso) {
  const dayStart = new Date(`${dateIso}T00:00:00`);
  const dayEnd = new Date(`${shiftDate(dateIso, 1)}T00:00:00`);
  const start = new Date(Math.max(new Date(block.startTime).getTime(), dayStart.getTime()));
  const end = new Date(Math.min(new Date(block.endTime).getTime(), dayEnd.getTime()));
  return { ...block, start, end };
}

function statusLabel(status) {
  const labels = {
    CONFIRMED: 'Confirmado', COMPLETED: 'Concluído', CANCELED: 'Cancelado', NO_SHOW: 'Não compareceu'
  };
  return labels[status] || status;
}

function blockLabel(type) {
  return type === 'VACATION' ? 'Férias' : type === 'TIME_OFF' ? 'Ausência' : 'Bloqueio';
}

function appointmentMinutes(appointment) {
  const start = new Date(appointment.startTime);
  const end = appointment.endTime ? new Date(appointment.endTime) : new Date(start.getTime() + Number(appointment.service?.durationMin || 30) * 60000);
  return Math.max(0, Math.round((end - start) / 60000));
}

function dayAppointments(appointments, dateIso, professionalId = '') {
  return appointments.filter((appointment) => {
    const start = new Date(appointment.startTime);
    const sameDate = localDateIso(start) === dateIso;
    const sameProfessional = !professionalId || (appointment.professionalId || appointment.professional?.id) === professionalId;
    return sameDate && sameProfessional && appointment.status !== 'CANCELED';
  });
}

function availableMinutesForProfessional(professional, defaultSchedule, dateIso) {
  const schedule = daySchedule(professional, defaultSchedule, dateIso);
  if (!schedule.enabled) return 0;
  const start = minutesFromTime(schedule.start, 9 * 60);
  const end = minutesFromTime(schedule.end, 19 * 60);
  let total = Math.max(0, end - start);
  for (const item of schedule.breaks || []) {
    const breakStart = Math.max(start, minutesFromTime(item.start, start));
    const breakEnd = Math.min(end, minutesFromTime(item.end, end));
    total -= Math.max(0, breakEnd - breakStart);
  }
  for (const raw of professional.timeBlocks || []) {
    if (!overlapsDay(raw, dateIso)) continue;
    const item = clippedBlock(raw, dateIso);
    const blockStart = Math.max(start, minutesOf(item.start));
    const blockEnd = Math.min(end, minutesOf(item.end));
    total -= Math.max(0, blockEnd - blockStart);
  }
  return Math.max(0, total);
}

function EventCard({ appointment, top, height, onOpen, onDragStart }) {
  const start = new Date(appointment.startTime);
  const end = appointment.endTime ? new Date(appointment.endTime) : new Date(start.getTime() + appointmentMinutes(appointment) * 60000);
  return (
    <button
      type="button"
      className={`ops-event status-${String(appointment.status || 'CONFIRMED').toLowerCase()}`}
      style={{ top, height }}
      draggable={appointment.status === 'CONFIRMED'}
      onDragStart={(event) => onDragStart(event, appointment)}
      onClick={() => onOpen(appointment)}
      title="Abrir atendimento. No desktop, arraste para reagendar."
    >
      <span className="ops-event-time">{timeLabel(start)}–{timeLabel(end)}</span>
      <strong>{appointment.clientName}</strong>
      <span>{appointment.service?.name || 'Serviço'}</span>
      <small>{durationLabel(appointmentMinutes(appointment))} · {statusLabel(appointment.status)}</small>
    </button>
  );
}

export function OperationalAgendaBoard({ appointments, professionals, reload, setPage }) {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [scheduleData, setScheduleData] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [moveForm, setMoveForm] = useState({ date: selectedDate, time: '09:00', professionalId: '' });

  async function loadSchedule() {
    setLoadingSchedule(true);
    try {
      const data = await request('/admin/appointments/team-schedules');
      setScheduleData(data);
    } catch (error) {
      setMessage(error.message || 'Não foi possível carregar a jornada da equipe.');
    } finally {
      setLoadingSchedule(false);
    }
  }

  useEffect(() => { loadSchedule(); }, []);

  const scheduleProfessionals = scheduleData?.professionals || [];
  const mergedProfessionals = useMemo(() => {
    const byId = new Map(scheduleProfessionals.map((professional) => [professional.id, professional]));
    return professionals.map((professional) => ({ ...professional, ...(byId.get(professional.id) || {}) }));
  }, [professionals, scheduleProfessionals]);

  const professionalsInView = selectedProfessionalId
    ? mergedProfessionals.filter((professional) => professional.id === selectedProfessionalId)
    : mergedProfessionals;

  const range = useMemo(() => {
    const enabledDays = professionalsInView.flatMap((professional) => {
      const day = daySchedule(professional, scheduleData?.defaultSchedule, selectedDate);
      return day.enabled ? [day] : [];
    });
    const starts = enabledDays.map((item) => minutesFromTime(item.start, 9 * 60));
    const ends = enabledDays.map((item) => minutesFromTime(item.end, 19 * 60));
    let start = starts.length ? Math.min(...starts) : 9 * 60;
    let end = ends.length ? Math.max(...ends) : 19 * 60;
    start = Math.max(5 * 60, Math.floor(start / SLOT_MINUTES) * SLOT_MINUTES);
    end = Math.min(23 * 60, Math.ceil(end / SLOT_MINUTES) * SLOT_MINUTES);
    if (end <= start) end = start + 8 * 60;
    return { start, end };
  }, [professionalsInView, scheduleData, selectedDate]);

  const rows = useMemo(() => {
    const result = [];
    for (let minute = range.start; minute < range.end; minute += SLOT_MINUTES) result.push(minute);
    return result;
  }, [range]);

  const timelineHeight = rows.length * SLOT_HEIGHT;
  const selectedDayAppointments = useMemo(() => dayAppointments(appointments, selectedDate), [appointments, selectedDate]);
  const bookedMinutes = selectedDayAppointments.reduce((sum, appointment) => sum + appointmentMinutes(appointment), 0);
  const availableMinutes = mergedProfessionals.reduce((sum, professional) => sum + availableMinutesForProfessional(professional, scheduleData?.defaultSchedule, selectedDate), 0);
  const occupancy = availableMinutes ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100)) : 0;
  const revenuePotential = selectedDayAppointments.reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);

  function positionForMinutes(minutes) {
    return ((minutes - range.start) / SLOT_MINUTES) * SLOT_HEIGHT;
  }

  function eventPosition(appointment) {
    const start = new Date(appointment.startTime);
    const startMinutes = minutesOf(start);
    const duration = appointmentMinutes(appointment);
    return {
      top: Math.max(0, positionForMinutes(startMinutes)),
      height: Math.max(SLOT_HEIGHT - 4, (duration / SLOT_MINUTES) * SLOT_HEIGHT - 4)
    };
  }

  function openAppointment(appointment) {
    const start = new Date(appointment.startTime);
    setSelectedAppointment(appointment);
    setMoveForm({
      date: localDateIso(start),
      time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      professionalId: appointment.professionalId || appointment.professional?.id || ''
    });
    setMessage('');
  }

  function handleDragStart(event, appointment) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', appointment.id);
  }

  async function moveAppointment(appointment, dateIso, minute, professionalId) {
    if (!appointment || !professionalId) return;
    const start = new Date(`${dateIso}T00:00:00`);
    start.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    setSaving(true);
    setMessage('Validando a nova posição na agenda…');
    try {
      await request(`/admin/appointments/${appointment.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          startTime: start.toISOString(),
          professionalId,
          status: appointment.status || 'CONFIRMED'
        })
      });
      setMessage('Agendamento reagendado. Jornada, duração e conflitos foram validados.');
      setSelectedAppointment(null);
      await reload();
      await loadSchedule();
    } catch (error) {
      setMessage(error.message || 'Não foi possível mover este atendimento.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLaneDrop(event, professional) {
    event.preventDefault();
    const appointmentId = event.dataTransfer.getData('text/plain');
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const raw = range.start + (offset / SLOT_HEIGHT) * SLOT_MINUTES;
    const snapped = Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES;
    await moveAppointment(appointment, selectedDate, snapped, professional.id);
  }

  async function submitMove(event) {
    event.preventDefault();
    if (!selectedAppointment) return;
    await moveAppointment(
      selectedAppointment,
      moveForm.date,
      minutesFromTime(moveForm.time, 9 * 60),
      moveForm.professionalId
    );
  }

  async function updateStatus(status) {
    if (!selectedAppointment) return;
    setSaving(true);
    setMessage('Atualizando atendimento…');
    try {
      await request(`/admin/appointments/${selectedAppointment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      setMessage(`Atendimento marcado como ${statusLabel(status).toLowerCase()}.`);
      setSelectedAppointment(null);
      await reload();
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar o atendimento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="ops-agenda-page">
      <div className="ops-shell">
        <header className="ops-header">
          <div>
            <span className="eyebrow">Agenda operacional</span>
            <h1>O dia inteiro em uma única visão</h1>
            <p>Atendimentos, espaços livres, almoço, férias e bloqueios por profissional. No desktop, arraste um atendimento; no celular, toque nele para reagendar.</p>
          </div>
          <div className="ops-header-actions">
            <button className="secondary" type="button" onClick={() => setPage('professional-schedule')}>Jornada da equipe</button>
            <button className="secondary" type="button" onClick={() => setPage('admin')}>Painel</button>
          </div>
        </header>

        <section className="ops-toolbar">
          <div className="ops-date-nav">
            <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} aria-label="Dia anterior">‹</button>
            <label><span>Data</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            <button type="button" onClick={() => setSelectedDate(todayIso())}>Hoje</button>
            <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} aria-label="Próximo dia">›</button>
          </div>
          <div className="ops-date-title"><strong>{dateLabel(selectedDate)}</strong><small>{scheduleData?.openingHours || 'Horário geral do salão'}</small></div>
          <label className="ops-pro-filter"><span>Profissional</span><select value={selectedProfessionalId} onChange={(event) => setSelectedProfessionalId(event.target.value)}><option value="">Equipe inteira</option>{mergedProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
        </section>

        <section className="ops-kpis">
          <article><span>Atendimentos</span><strong>{selectedDayAppointments.length}</strong><small>ativos no dia</small></article>
          <article><span>Horas reservadas</span><strong>{durationLabel(bookedMinutes)}</strong><small>tempo ocupado</small></article>
          <article><span>Ocupação real</span><strong>{occupancy}%</strong><small>sobre a jornada líquida</small></article>
          <article><span>Potencial</span><strong>{currency(revenuePotential)}</strong><small>serviços do dia</small></article>
        </section>

        {message && <p className="feedback ops-feedback">{message}</p>}
        {loadingSchedule && <p className="feedback">Carregando jornada e bloqueios…</p>}

        {!loadingSchedule && (
          <section className="ops-board-wrap">
            <div className="ops-legend">
              <span><i className="legend-free" />Livre</span>
              <span><i className="legend-break" />Intervalo</span>
              <span><i className="legend-block" />Ausência/férias</span>
              <span><i className="legend-event" />Atendimento</span>
            </div>
            <div className="ops-board">
              <aside className="ops-time-rail">
                <div className="ops-time-head">Hora</div>
                <div className="ops-time-body" style={{ height: timelineHeight }}>
                  {rows.map((minute) => <span key={minute} style={{ top: positionForMinutes(minute) }}>{minute % 60 === 0 ? timeFromMinutes(minute) : '·'}</span>)}
                </div>
              </aside>

              <div className="ops-lanes" style={{ gridTemplateColumns: `repeat(${Math.max(1, professionalsInView.length)}, minmax(250px,1fr))` }}>
                {professionalsInView.map((professional) => {
                  const schedule = daySchedule(professional, scheduleData?.defaultSchedule, selectedDate);
                  const professionalAppointments = dayAppointments(appointments, selectedDate, professional.id);
                  const breaks = schedule.enabled ? (schedule.breaks || []) : [];
                  const blocks = (professional.timeBlocks || []).filter((item) => overlapsDay(item, selectedDate)).map((item) => clippedBlock(item, selectedDate));
                  const workStart = minutesFromTime(schedule.start, range.start);
                  const workEnd = minutesFromTime(schedule.end, range.end);

                  return (
                    <article className="ops-lane" key={professional.id}>
                      <header className="ops-lane-head">
                        {professional.photoUrl ? <img src={professional.photoUrl} alt="" /> : <span>{professional.name.charAt(0)}</span>}
                        <div><strong>{professional.name}</strong><small>{schedule.enabled ? `${schedule.start}–${schedule.end}` : 'Folga'}</small></div>
                      </header>
                      <div className={`ops-lane-body ${schedule.enabled ? '' : 'is-day-off'}`} style={{ height: timelineHeight }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleLaneDrop(event, professional)}>
                        {rows.map((minute) => <i className="ops-grid-line" key={minute} style={{ top: positionForMinutes(minute) }} />)}

                        {schedule.enabled && workStart > range.start && <div className="ops-closed-block" style={{ top: 0, height: positionForMinutes(workStart) }}><span>Fora da jornada</span></div>}
                        {schedule.enabled && workEnd < range.end && <div className="ops-closed-block" style={{ top: positionForMinutes(workEnd), height: timelineHeight - positionForMinutes(workEnd) }}><span>Fora da jornada</span></div>}
                        {!schedule.enabled && <div className="ops-closed-block full"><span>Folga</span></div>}

                        {breaks.map((item, index) => {
                          const start = minutesFromTime(item.start, workStart);
                          const end = minutesFromTime(item.end, start);
                          return <div className="ops-unavailable-block break" key={`${professional.id}-break-${index}`} style={{ top: positionForMinutes(start), height: Math.max(20, positionForMinutes(end) - positionForMinutes(start)) }}><span>Intervalo {item.start}–{item.end}</span></div>;
                        })}

                        {blocks.map((item) => {
                          const start = minutesOf(item.start);
                          const end = item.end.getDate() !== item.start.getDate() ? range.end : minutesOf(item.end);
                          return <div className="ops-unavailable-block exception" key={item.id} style={{ top: Math.max(0, positionForMinutes(start)), height: Math.max(24, positionForMinutes(Math.min(end, range.end)) - Math.max(0, positionForMinutes(start))) }}><strong>{blockLabel(item.type)}</strong><span>{item.reason || `${timeLabel(item.start)}–${timeLabel(item.end)}`}</span></div>;
                        })}

                        {professionalAppointments.map((appointment) => {
                          const position = eventPosition(appointment);
                          return <EventCard key={appointment.id} appointment={appointment} top={position.top} height={position.height} onOpen={openAppointment} onDragStart={handleDragStart} />;
                        })}
                      </div>
                    </article>
                  );
                })}
                {professionalsInView.length === 0 && <div className="ops-empty">Nenhum profissional ativo cadastrado.</div>}
              </div>
            </div>
          </section>
        )}
      </div>

      {selectedAppointment && (
        <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAppointment(null); }}>
          <section className="ops-modal" role="dialog" aria-modal="true" aria-label="Detalhes do atendimento">
            <header><div><span className="eyebrow">Atendimento</span><h2>{selectedAppointment.clientName}</h2><p>{selectedAppointment.service?.name} · {currency(selectedAppointment.service?.price || 0)}</p></div><button type="button" onClick={() => setSelectedAppointment(null)} aria-label="Fechar">×</button></header>
            <div className="ops-modal-summary">
              <span><small>Horário atual</small><strong>{timeLabel(new Date(selectedAppointment.startTime))}–{timeLabel(new Date(selectedAppointment.endTime))}</strong></span>
              <span><small>Profissional</small><strong>{selectedAppointment.professional?.name || '—'}</strong></span>
              <span><small>Duração</small><strong>{durationLabel(appointmentMinutes(selectedAppointment))}</strong></span>
              <span><small>Status</small><strong>{statusLabel(selectedAppointment.status)}</strong></span>
            </div>

            {selectedAppointment.status === 'CONFIRMED' && (
              <form className="ops-move-form" onSubmit={submitMove}>
                <h3>Reagendar</h3>
                <label>Data<input type="date" value={moveForm.date} onChange={(event) => setMoveForm({ ...moveForm, date: event.target.value })} required /></label>
                <label>Horário<input type="time" step="1800" value={moveForm.time} onChange={(event) => setMoveForm({ ...moveForm, time: event.target.value })} required /></label>
                <label>Profissional<select value={moveForm.professionalId} onChange={(event) => setMoveForm({ ...moveForm, professionalId: event.target.value })} required>{mergedProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
                <button className="primary" type="submit" disabled={saving}>{saving ? 'Validando…' : 'Salvar novo horário'}</button>
              </form>
            )}

            <div className="ops-status-actions">
              <strong>Atualizar status</strong>
              <div>
                <button type="button" onClick={() => updateStatus('COMPLETED')} disabled={saving}>Concluído</button>
                <button type="button" onClick={() => updateStatus('NO_SHOW')} disabled={saving}>Não compareceu</button>
                <button type="button" className="danger" onClick={() => updateStatus('CANCELED')} disabled={saving}>Cancelar</button>
              </div>
            </div>
          </section>
        </div>
      )}

      <style>{`
        .ops-agenda-page{min-height:75vh;padding:34px 18px 80px;background:radial-gradient(circle at 10% 0%,color-mix(in srgb,var(--gold) 10%,transparent),transparent 28%)}.ops-shell{max-width:1480px;margin:0 auto;display:grid;gap:18px}.ops-header{display:flex;justify-content:space-between;gap:22px;align-items:flex-start}.ops-header>div:first-child{max-width:820px}.ops-header h1{margin:7px 0 8px;font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.04em}.ops-header p{color:var(--muted);margin:0}.ops-header-actions{display:flex;gap:8px;flex-wrap:wrap}
        .ops-toolbar{display:grid;grid-template-columns:auto 1fr minmax(190px,240px);gap:16px;align-items:end;border:1px solid var(--border);background:var(--surface);border-radius:20px;padding:15px}.ops-date-nav{display:flex;align-items:end;gap:7px}.ops-date-nav>button{height:42px;min-width:42px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);font-weight:800;cursor:pointer}.ops-date-nav label,.ops-pro-filter{display:grid;gap:5px;font-size:.76rem;color:var(--muted)}.ops-date-nav input,.ops-pro-filter select{height:42px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:12px;padding:0 11px}.ops-date-title{display:grid;align-self:center}.ops-date-title strong{text-transform:capitalize;font-size:1.05rem}.ops-date-title small{color:var(--muted);margin-top:3px}.ops-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ops-kpis article{display:grid;gap:3px;padding:15px 17px;border:1px solid var(--border);background:var(--surface);border-radius:18px}.ops-kpis span,.ops-kpis small{color:var(--muted)}.ops-kpis strong{font-size:1.25rem}.ops-feedback{margin:0}
        .ops-board-wrap{border:1px solid var(--border);background:var(--surface);border-radius:22px;overflow:hidden}.ops-legend{display:flex;gap:16px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border);color:var(--muted);font-size:.78rem}.ops-legend span{display:flex;align-items:center;gap:6px}.ops-legend i{width:12px;height:12px;border-radius:4px;border:1px solid var(--border)}.legend-free{background:var(--card)}.legend-break{background:color-mix(in srgb,#f0b429 20%,var(--card))}.legend-block{background:color-mix(in srgb,#8b949e 23%,var(--card))}.legend-event{background:color-mix(in srgb,var(--gold) 32%,var(--card))}
        .ops-board{display:flex;max-height:72vh;overflow:auto;position:relative}.ops-time-rail{position:sticky;left:0;z-index:20;width:64px;min-width:64px;background:var(--surface);border-right:1px solid var(--border)}.ops-time-head{height:68px;display:grid;place-items:center;position:sticky;top:0;z-index:30;background:var(--surface);border-bottom:1px solid var(--border);font-size:.72rem;color:var(--muted);font-weight:800}.ops-time-body{position:relative}.ops-time-body span{position:absolute;right:10px;transform:translateY(-7px);font-size:.7rem;color:var(--muted)}.ops-lanes{display:grid;min-width:max-content;flex:1}.ops-lane{min-width:250px;border-right:1px solid var(--border)}.ops-lane-head{height:68px;position:sticky;top:0;z-index:15;display:flex;align-items:center;gap:10px;padding:10px 13px;background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}.ops-lane-head img,.ops-lane-head>span{width:38px;height:38px;border-radius:12px;object-fit:cover;display:grid;place-items:center;background:var(--gold);color:#111;font-weight:900}.ops-lane-head div{display:grid;gap:2px}.ops-lane-head small{color:var(--muted)}.ops-lane-body{position:relative;background:var(--card);overflow:hidden}.ops-lane-body.is-day-off{background:repeating-linear-gradient(135deg,var(--surface),var(--surface) 8px,color-mix(in srgb,var(--border) 35%,var(--surface)) 8px,color-mix(in srgb,var(--border) 35%,var(--surface)) 16px)}.ops-grid-line{position:absolute;left:0;right:0;height:1px;background:color-mix(in srgb,var(--border) 64%,transparent);pointer-events:none}.ops-grid-line:nth-of-type(odd){background:color-mix(in srgb,var(--border) 32%,transparent)}
        .ops-closed-block{position:absolute;left:0;right:0;background:repeating-linear-gradient(135deg,color-mix(in srgb,#8b949e 10%,var(--surface)),color-mix(in srgb,#8b949e 10%,var(--surface)) 7px,color-mix(in srgb,#8b949e 17%,var(--surface)) 7px,color-mix(in srgb,#8b949e 17%,var(--surface)) 14px);z-index:1;color:var(--muted);font-size:.68rem;padding:5px 8px}.ops-closed-block.full{top:0;bottom:0;height:100%;display:grid;place-items:center;font-weight:800}.ops-unavailable-block{position:absolute;left:5px;right:5px;z-index:3;border-radius:9px;padding:5px 7px;display:grid;align-content:start;overflow:hidden;font-size:.68rem;border:1px dashed color-mix(in srgb,#f0b429 45%,var(--border));background:color-mix(in srgb,#f0b429 13%,var(--surface));color:var(--muted);pointer-events:none}.ops-unavailable-block.exception{border-color:color-mix(in srgb,#8b949e 60%,var(--border));background:color-mix(in srgb,#8b949e 18%,var(--surface))}.ops-unavailable-block strong{color:var(--text)}
        .ops-event{position:absolute;left:7px;right:7px;z-index:8;border:1px solid color-mix(in srgb,var(--gold) 45%,var(--border));border-left:4px solid var(--gold);border-radius:11px;background:color-mix(in srgb,var(--gold) 13%,var(--surface));color:var(--text);padding:6px 8px;text-align:left;display:grid;gap:1px;overflow:hidden;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.12)}.ops-event[draggable=true]{cursor:grab}.ops-event[draggable=true]:active{cursor:grabbing}.ops-event-time{font-size:.67rem;font-weight:900;color:var(--gold)}.ops-event strong{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ops-event>span:not(.ops-event-time){font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ops-event small{font-size:.62rem;color:var(--muted)}.ops-event.status-completed{opacity:.72;border-left-color:#3fb950}.ops-event.status-no_show{border-left-color:#f85149}.ops-empty{padding:30px;color:var(--muted)}
        .ops-modal-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.58);display:grid;place-items:center;padding:18px}.ops-modal{width:min(680px,100%);max-height:90vh;overflow:auto;border:1px solid var(--border);border-radius:24px;background:var(--surface);padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.4);display:grid;gap:18px}.ops-modal>header{display:flex;justify-content:space-between;gap:18px}.ops-modal h2{margin:5px 0}.ops-modal header p{margin:0;color:var(--muted)}.ops-modal header>button{width:38px;height:38px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);font-size:1.3rem}.ops-modal-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ops-modal-summary span{display:grid;gap:3px;padding:12px;border:1px solid var(--border);border-radius:14px;background:var(--card)}.ops-modal-summary small{color:var(--muted)}.ops-move-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:9px;align-items:end;border-top:1px solid var(--border);padding-top:16px}.ops-move-form h3{grid-column:1/-1;margin:0}.ops-move-form label{display:grid;gap:5px;color:var(--muted);font-size:.76rem}.ops-move-form input,.ops-move-form select{height:42px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:12px;padding:0 10px}.ops-status-actions{display:grid;gap:10px;border-top:1px solid var(--border);padding-top:16px}.ops-status-actions>div{display:flex;gap:8px;flex-wrap:wrap}.ops-status-actions button{border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:12px;padding:10px 13px;font-weight:800}.ops-status-actions button.danger{border-color:color-mix(in srgb,#f85149 50%,var(--border));color:#f85149}
        @media(max-width:900px){.ops-header{display:grid}.ops-toolbar{grid-template-columns:1fr}.ops-date-title{order:-1}.ops-pro-filter{max-width:none}.ops-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ops-board{max-height:68vh}.ops-lane{min-width:230px}.ops-move-form{grid-template-columns:1fr 1fr}.ops-move-form h3,.ops-move-form label:nth-of-type(3),.ops-move-form button{grid-column:1/-1}}
        @media(max-width:560px){.ops-agenda-page{padding:22px 8px 60px}.ops-header-actions>*{flex:1}.ops-date-nav{display:grid;grid-template-columns:42px 1fr auto 42px}.ops-date-nav label{min-width:0}.ops-date-nav input{width:100%}.ops-kpis{gap:6px}.ops-kpis article{padding:11px}.ops-board-wrap{border-radius:16px}.ops-time-rail{width:48px;min-width:48px}.ops-time-body span{right:5px;font-size:.62rem}.ops-lane{min-width:210px}.ops-modal{padding:16px;border-radius:18px}.ops-modal-summary{grid-template-columns:1fr}.ops-move-form{grid-template-columns:1fr}.ops-move-form>*{grid-column:1/-1}}
      `}</style>
    </main>
  );
}
