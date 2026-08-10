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

function startOfWeekIso(value) {
  const date = new Date(`${value}T12:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  return shiftDate(value, -mondayOffset);
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

function compactDateLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
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
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
}

function localDateTimeIso(dateIso, time) {
  return new Date(`${dateIso}T${time}:00`).toISOString();
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

function attendanceLabel(status) {
  const labels = { SCHEDULED: 'Confirmado', ARRIVED: 'Cliente chegou', IN_SERVICE: 'Em atendimento' };
  return labels[status] || 'Confirmado';
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

function professionalCanUseService(professional, serviceId) {
  if (!professional?.servicesConfigured) return true;
  return Array.isArray(professional.serviceIds) && professional.serviceIds.includes(serviceId);
}

function communicationLabel(appointment, operationalData) {
  if (operationalData.confirmationByAppointment?.[appointment.id]) return '✓ Presença confirmada';
  if (operationalData.reminderByAppointment?.[appointment.id]?.main) return 'Lembrete enviado';
  return 'Aguardando confirmação';
}

function EventCard({ appointment, attendanceStatus, communication, top, height, onOpen, onDragStart }) {
  const start = new Date(appointment.startTime);
  const end = appointment.endTime ? new Date(appointment.endTime) : new Date(start.getTime() + appointmentMinutes(appointment) * 60000);
  const operational = attendanceStatus || 'SCHEDULED';
  const activeLabel = appointment.status === 'CONFIRMED' ? attendanceLabel(operational) : statusLabel(appointment.status);
  const draggable = appointment.status === 'CONFIRMED' && operational === 'SCHEDULED';

  return (
    <button
      type="button"
      className={`ops-event status-${String(appointment.status || 'CONFIRMED').toLowerCase()} attendance-${operational.toLowerCase()}`}
      style={{ top, height }}
      draggable={draggable}
      onDragStart={(event) => onDragStart(event, appointment)}
      onClick={() => onOpen(appointment)}
      title={`${activeLabel} · ${communication}`}
    >
      <span className="ops-event-time">{timeLabel(start)}–{timeLabel(end)}</span>
      <strong>{appointment.clientName}</strong>
      <span>{appointment.service?.name || 'Serviço'}</span>
      <small>{durationLabel(appointmentMinutes(appointment))} · {activeLabel}</small>
      {communication.startsWith('✓') && <em className="ops-confirmed-presence">✓ presença</em>}
    </button>
  );
}

export function OperationalAgendaBoard({ appointments, professionals, reload, setPage }) {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [viewMode, setViewMode] = useState('DAY');
  const [scheduleData, setScheduleData] = useState(null);
  const [operationalData, setOperationalData] = useState({
    role: '', services: [], attendanceByAppointment: {}, confirmationByAppointment: {}, reminderByAppointment: {}
  });
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [moveForm, setMoveForm] = useState({ date: selectedDate, time: '09:00', professionalId: '' });
  const [clock, setClock] = useState(new Date());
  const [lastSync, setLastSync] = useState(new Date());
  const [quickContext, setQuickContext] = useState(null);
  const [quickMode, setQuickMode] = useState('BOOKING');
  const [quickForm, setQuickForm] = useState({ clientName: '', clientPhone: '', clientEmail: '', serviceId: '', notes: '' });
  const [blockForm, setBlockForm] = useState({ type: 'BLOCK', endTime: '10:00', reason: '' });

  async function loadSchedule(silent = false) {
    if (!silent) setLoadingSchedule(true);
    try {
      const data = await request('/admin/appointments/team-schedules');
      setScheduleData(data);
    } catch (error) {
      if (!silent) setMessage(error.message || 'Não foi possível carregar a jornada da equipe.');
    } finally {
      if (!silent) setLoadingSchedule(false);
    }
  }

  async function loadOperationalOptions(silent = false) {
    try {
      const data = await request('/admin/appointments/operational-options');
      setOperationalData({
        role: data.role || '',
        services: data.services || [],
        attendanceByAppointment: data.attendanceByAppointment || {},
        confirmationByAppointment: data.confirmationByAppointment || {},
        reminderByAppointment: data.reminderByAppointment || {}
      });
    } catch (error) {
      if (!silent) setMessage(error.message || 'Não foi possível carregar as ações da agenda operacional.');
    }
  }

  useEffect(() => {
    void loadSchedule();
    void loadOperationalOptions();
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function sync() {
      if (document.visibilityState !== 'visible' || saving || quickContext || selectedAppointment) return;
      try {
        await Promise.all([reload(), loadOperationalOptions(true)]);
        setLastSync(new Date());
      } catch {
        // A sincronização silenciosa não interrompe o trabalho da recepção.
      }
    }
    const timer = window.setInterval(() => { void sync(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [reload, saving, quickContext, selectedAppointment]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !saving && !quickContext) void loadSchedule(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [saving, quickContext]);

  const scheduleProfessionals = scheduleData?.professionals || [];
  const mergedProfessionals = useMemo(() => {
    const byId = new Map(scheduleProfessionals.map((professional) => [professional.id, professional]));
    return professionals.map((professional) => ({ ...professional, ...(byId.get(professional.id) || {}) }));
  }, [professionals, scheduleProfessionals]);

  const professionalsInView = selectedProfessionalId
    ? mergedProfessionals.filter((professional) => professional.id === selectedProfessionalId)
    : mergedProfessionals;

  const canManage = ['ADMIN', 'RECEPTION'].includes(operationalData.role);
  const weekStart = useMemo(() => startOfWeekIso(selectedDate), [selectedDate]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index)), [weekStart]);

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

  const selectedDayAppointments = useMemo(
    () => dayAppointments(appointments, selectedDate, selectedProfessionalId),
    [appointments, selectedDate, selectedProfessionalId]
  );
  const weekAppointments = useMemo(
    () => weekDates.flatMap((date) => dayAppointments(appointments, date, selectedProfessionalId)),
    [appointments, weekDates, selectedProfessionalId]
  );
  const scopeAppointments = viewMode === 'WEEK' ? weekAppointments : selectedDayAppointments;
  const bookedMinutes = scopeAppointments.reduce((sum, appointment) => sum + appointmentMinutes(appointment), 0);
  const scopeDates = viewMode === 'WEEK' ? weekDates : [selectedDate];
  const availableMinutes = scopeDates.reduce((total, date) => total + professionalsInView.reduce(
    (sum, professional) => sum + availableMinutesForProfessional(professional, scheduleData?.defaultSchedule, date), 0
  ), 0);
  const occupancy = availableMinutes ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100)) : 0;
  const revenuePotential = scopeAppointments
    .filter((appointment) => appointment.status !== 'NO_SHOW')
    .reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
  const timelineHeight = rows.length * SLOT_HEIGHT;
  const nowMinutes = minutesOf(clock);
  const showNow = selectedDate === localDateIso(clock) && nowMinutes >= range.start && nowMinutes <= range.end;

  function positionForMinutes(minutes) {
    return ((minutes - range.start) / SLOT_MINUTES) * SLOT_HEIGHT;
  }

  function eventPosition(appointment) {
    const start = new Date(appointment.startTime);
    const duration = appointmentMinutes(appointment);
    return {
      top: Math.max(0, positionForMinutes(minutesOf(start))),
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

  function minuteFromPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const raw = range.start + (offset / SLOT_HEIGHT) * SLOT_MINUTES;
    return Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES;
  }

  function openQuickAction(event, professional) {
    if (!canManage || viewMode !== 'DAY') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.ops-event,.ops-unavailable-block,.ops-closed-block')) return;
    const minute = Math.max(range.start, Math.min(range.end - SLOT_MINUTES, minuteFromPointer(event)));
    const time = timeFromMinutes(minute);
    const eligible = operationalData.services.filter((service) => professionalCanUseService(professional, service.id));
    setQuickContext({ professional, date: selectedDate, minute, time });
    setQuickMode('BOOKING');
    setQuickForm({ clientName: '', clientPhone: '', clientEmail: '', serviceId: eligible[0]?.id || '', notes: '' });
    setBlockForm({ type: 'BLOCK', endTime: timeFromMinutes(minute + 60), reason: '' });
    setMessage('');
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
        body: JSON.stringify({ startTime: start.toISOString(), professionalId, status: appointment.status || 'CONFIRMED' })
      });
      setMessage('Agendamento reagendado. Jornada, duração e conflitos foram validados.');
      setSelectedAppointment(null);
      await Promise.all([reload(), loadSchedule(true), loadOperationalOptions(true)]);
      setLastSync(new Date());
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
    await moveAppointment(appointment, selectedDate, minuteFromPointer(event), professional.id);
  }

  async function submitMove(event) {
    event.preventDefault();
    if (!selectedAppointment) return;
    await moveAppointment(selectedAppointment, moveForm.date, minutesFromTime(moveForm.time, 9 * 60), moveForm.professionalId);
  }

  async function updateStatus(status) {
    if (!selectedAppointment) return;
    setSaving(true);
    setMessage('Atualizando atendimento…');
    try {
      await request(`/admin/appointments/${selectedAppointment.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      setMessage(`Atendimento marcado como ${statusLabel(status).toLowerCase()}.`);
      setSelectedAppointment(null);
      await Promise.all([reload(), loadOperationalOptions(true)]);
      setLastSync(new Date());
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar o atendimento.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAttendance(status) {
    if (!selectedAppointment) return;
    setSaving(true);
    try {
      await request(`/admin/appointments/${selectedAppointment.id}/attendance`, { method: 'PUT', body: JSON.stringify({ status }) });
      setOperationalData((current) => ({
        ...current,
        attendanceByAppointment: { ...current.attendanceByAppointment, [selectedAppointment.id]: status }
      }));
      setMessage(`Atendimento atualizado: ${attendanceLabel(status)}.`);
      if (status === 'IN_SERVICE') setSelectedAppointment(null);
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar a etapa do atendimento.');
    } finally {
      setSaving(false);
    }
  }

  async function submitQuickBooking(event) {
    event.preventDefault();
    if (!quickContext || !quickForm.serviceId) return;
    setSaving(true);
    try {
      const result = await request('/admin/appointments/quick-create', {
        method: 'POST',
        body: JSON.stringify({
          clientName: quickForm.clientName,
          clientPhone: quickForm.clientPhone,
          clientEmail: quickForm.clientEmail,
          serviceId: quickForm.serviceId,
          professionalId: quickContext.professional.id,
          startTime: localDateTimeIso(quickContext.date, quickContext.time),
          notes: quickForm.notes
        })
      });
      const notificationText = result.confirmation?.clientNotification === 'SENT'
        ? ' Cliente avisado pelo WhatsApp.'
        : ' Horário confirmado; o WhatsApp não foi entregue e a equipe deve confirmar o contato.';
      setMessage(`Agendamento criado para ${quickContext.time}.${notificationText}`);
      setQuickContext(null);
      await Promise.all([reload(), loadOperationalOptions(true), loadSchedule(true)]);
      setLastSync(new Date());
    } catch (error) {
      setMessage(error.message || 'Não foi possível criar o agendamento neste horário.');
    } finally {
      setSaving(false);
    }
  }

  async function submitQuickBlock(event) {
    event.preventDefault();
    if (!quickContext) return;
    if (blockForm.endTime <= quickContext.time) {
      setMessage('O fim do bloqueio precisa ser posterior ao início.');
      return;
    }
    setSaving(true);
    try {
      await request(`/admin/appointments/team-schedules/${quickContext.professional.id}/blocks`, {
        method: 'POST',
        body: JSON.stringify({
          type: blockForm.type,
          startTime: localDateTimeIso(quickContext.date, quickContext.time),
          endTime: localDateTimeIso(quickContext.date, blockForm.endTime),
          reason: blockForm.reason
        })
      });
      setMessage(`Horário de ${quickContext.professional.name} bloqueado de ${quickContext.time} a ${blockForm.endTime}.`);
      setQuickContext(null);
      await loadSchedule(true);
      setLastSync(new Date());
    } catch (error) {
      setMessage(error.message || 'Não foi possível bloquear este período.');
    } finally {
      setSaving(false);
    }
  }

  function openWeekDay(date) {
    setSelectedDate(date);
    setViewMode('DAY');
  }

  const selectedAttendance = selectedAppointment
    ? (operationalData.attendanceByAppointment[selectedAppointment.id] || 'SCHEDULED')
    : 'SCHEDULED';
  const quickEligibleServices = quickContext
    ? operationalData.services.filter((service) => professionalCanUseService(quickContext.professional, service.id))
    : [];
  const selectedCommunication = selectedAppointment ? communicationLabel(selectedAppointment, operationalData) : '';

  return (
    <main className="ops-agenda-page">
      <div className="ops-shell">
        <header className="ops-header">
          <div>
            <span className="eyebrow">Agenda operacional 2.1</span>
            <h1>{viewMode === 'DAY' ? 'O dia inteiro em uma única visão' : 'Planejamento da semana'}</h1>
            <p>{viewMode === 'DAY'
              ? 'Arraste atendimentos para reagendar e clique em um espaço livre para agendar ou bloquear. A linha vermelha mostra o horário atual.'
              : 'Veja a carga da semana, confirmações de presença e distribuição dos atendimentos por dia.'}</p>
          </div>
          <div className="ops-header-actions">
            <span className="ops-sync-state">● sincronização automática · {timeLabel(lastSync)}</span>
            <button className="secondary" type="button" onClick={() => setPage('professional-schedule')}>Jornada da equipe</button>
            <button className="secondary" type="button" onClick={() => setPage('admin')}>Painel</button>
          </div>
        </header>

        <section className="ops-toolbar">
          <div className="ops-date-nav">
            <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, viewMode === 'WEEK' ? -7 : -1))} aria-label="Período anterior">‹</button>
            <label><span>Data</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            <button type="button" onClick={() => setSelectedDate(todayIso())}>Hoje</button>
            <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, viewMode === 'WEEK' ? 7 : 1))} aria-label="Próximo período">›</button>
          </div>
          <div className="ops-date-title">
            <strong>{viewMode === 'DAY' ? dateLabel(selectedDate) : `${compactDateLabel(weekDates[0])} — ${compactDateLabel(weekDates[6])}`}</strong>
            <small>{scheduleData?.openingHours || 'Horário geral do salão'}</small>
          </div>
          <div className="ops-toolbar-right">
            <div className="ops-view-toggle" role="group" aria-label="Visualização da agenda">
              <button type="button" className={viewMode === 'DAY' ? 'active' : ''} onClick={() => setViewMode('DAY')}>Dia</button>
              <button type="button" className={viewMode === 'WEEK' ? 'active' : ''} onClick={() => setViewMode('WEEK')}>Semana</button>
            </div>
            <label className="ops-pro-filter"><span>Profissional</span><select value={selectedProfessionalId} onChange={(event) => setSelectedProfessionalId(event.target.value)}><option value="">Equipe inteira</option>{mergedProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
          </div>
        </section>

        <section className="ops-kpis">
          <article><span>Atendimentos</span><strong>{scopeAppointments.length}</strong><small>{viewMode === 'WEEK' ? 'na semana' : 'ativos no dia'}</small></article>
          <article><span>Horas reservadas</span><strong>{durationLabel(bookedMinutes)}</strong><small>tempo ocupado</small></article>
          <article><span>Ocupação real</span><strong>{occupancy}%</strong><small>sobre a jornada líquida</small></article>
          <article><span>Potencial</span><strong>{currency(revenuePotential)}</strong><small>exclui no-show</small></article>
        </section>

        {message && <p className="feedback ops-feedback">{message}</p>}
        {loadingSchedule && <p className="feedback">Carregando jornada e bloqueios…</p>}

        {!loadingSchedule && viewMode === 'WEEK' && (
          <section className="ops-week-grid">
            {weekDates.map((date) => {
              const items = dayAppointments(appointments, date, selectedProfessionalId).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
              const dayBooked = items.reduce((sum, item) => sum + appointmentMinutes(item), 0);
              const dayAvailable = professionalsInView.reduce((sum, professional) => sum + availableMinutesForProfessional(professional, scheduleData?.defaultSchedule, date), 0);
              const dayOccupancy = dayAvailable ? Math.min(100, Math.round((dayBooked / dayAvailable) * 100)) : 0;
              const isToday = date === todayIso();
              return (
                <article className={`ops-week-day ${isToday ? 'is-today' : ''}`} key={date}>
                  <header>
                    <div><strong>{compactDateLabel(date)}</strong><small>{items.length} atendimento{items.length === 1 ? '' : 's'} · {dayOccupancy}%</small></div>
                    <button type="button" onClick={() => openWeekDay(date)}>Abrir dia</button>
                  </header>
                  <div className="ops-week-list">
                    {items.map((appointment) => {
                      const communication = communicationLabel(appointment, operationalData);
                      const attendance = operationalData.attendanceByAppointment[appointment.id] || 'SCHEDULED';
                      return (
                        <button type="button" className={`ops-week-event attendance-${attendance.toLowerCase()}`} key={appointment.id} onClick={() => openAppointment(appointment)}>
                          <span>{timeLabel(new Date(appointment.startTime))}</span>
                          <strong>{appointment.clientName}</strong>
                          <small>{appointment.service?.name} · {appointment.professional?.name}</small>
                          <em className={communication.startsWith('✓') ? 'confirmed' : ''}>{communication}</em>
                        </button>
                      );
                    })}
                    {!items.length && <div className="ops-week-empty">Sem atendimentos</div>}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {!loadingSchedule && viewMode === 'DAY' && (
          <section className="ops-board-wrap">
            <div className="ops-legend">
              <span><i className="legend-free" />Livre — clique para agir</span>
              <span><i className="legend-arrived" />Cliente chegou</span>
              <span><i className="legend-service" />Em atendimento</span>
              <span><i className="legend-confirmed" />Presença confirmada</span>
              <span><i className="legend-break" />Intervalo</span>
              <span><i className="legend-block" />Ausência/férias</span>
            </div>
            <div className="ops-board">
              <aside className="ops-time-rail">
                <div className="ops-time-head">Hora</div>
                <div className="ops-time-body" style={{ height: timelineHeight }}>
                  {rows.map((minute) => <span key={minute} style={{ top: positionForMinutes(minute) }}>{minute % 60 === 0 ? timeFromMinutes(minute) : '·'}</span>)}
                  {showNow && <b className="ops-now-label" style={{ top: positionForMinutes(nowMinutes) }}>{timeLabel(clock)}</b>}
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
                      <div
                        className={`ops-lane-body ${schedule.enabled ? '' : 'is-day-off'} ${canManage ? 'is-clickable' : ''}`}
                        style={{ height: timelineHeight }}
                        onClick={(event) => openQuickAction(event, professional)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleLaneDrop(event, professional)}
                      >
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

                        {showNow && <div className="ops-now-line" style={{ top: positionForMinutes(nowMinutes) }}><span /></div>}

                        {professionalAppointments.map((appointment) => {
                          const position = eventPosition(appointment);
                          return <EventCard key={appointment.id} appointment={appointment} attendanceStatus={operationalData.attendanceByAppointment[appointment.id] || 'SCHEDULED'} communication={communicationLabel(appointment, operationalData)} top={position.top} height={position.height} onOpen={openAppointment} onDragStart={handleDragStart} />;
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

      {quickContext && (
        <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickContext(null); }}>
          <section className="ops-modal ops-quick-modal" role="dialog" aria-modal="true" aria-label="Ação rápida na agenda">
            <header><div><span className="eyebrow">Ação rápida</span><h2>{quickContext.time} · {quickContext.professional.name}</h2><p>{dateLabel(quickContext.date)}</p></div><button type="button" onClick={() => setQuickContext(null)} aria-label="Fechar">×</button></header>
            <div className="ops-quick-tabs"><button type="button" className={quickMode === 'BOOKING' ? 'active' : ''} onClick={() => setQuickMode('BOOKING')}>+ Novo agendamento</button><button type="button" className={quickMode === 'BLOCK' ? 'active' : ''} onClick={() => setQuickMode('BLOCK')}>Bloquear horário</button></div>
            {quickMode === 'BOOKING' ? (
              <form className="ops-quick-form" onSubmit={submitQuickBooking}>
                <label>Cliente<input value={quickForm.clientName} onChange={(event) => setQuickForm({ ...quickForm, clientName: event.target.value })} placeholder="Nome do cliente" minLength={3} required /></label>
                <label>WhatsApp<input value={quickForm.clientPhone} onChange={(event) => setQuickForm({ ...quickForm, clientPhone: event.target.value })} placeholder="11999999999" minLength={10} required /></label>
                <label>E-mail <small>opcional</small><input type="email" value={quickForm.clientEmail} onChange={(event) => setQuickForm({ ...quickForm, clientEmail: event.target.value })} placeholder="cliente@email.com" /></label>
                <label>Serviço<select value={quickForm.serviceId} onChange={(event) => setQuickForm({ ...quickForm, serviceId: event.target.value })} required><option value="">Selecione</option>{quickEligibleServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {durationLabel(service.durationMin)} · {currency(service.price)}</option>)}</select></label>
                <label className="full">Observação <small>opcional</small><textarea value={quickForm.notes} onChange={(event) => setQuickForm({ ...quickForm, notes: event.target.value })} rows={3} placeholder="Preferências ou observações para a equipe" /></label>
                {!quickEligibleServices.length && <p className="feedback error full">Este profissional não possui serviços disponíveis para agendamento.</p>}
                <button className="primary full" type="submit" disabled={saving || !quickEligibleServices.length}>{saving ? 'Validando agenda…' : `Confirmar ${quickContext.time}`}</button>
              </form>
            ) : (
              <form className="ops-quick-form" onSubmit={submitQuickBlock}>
                <label>Início<input value={quickContext.time} disabled /></label>
                <label>Fim<input type="time" step="1800" value={blockForm.endTime} onChange={(event) => setBlockForm({ ...blockForm, endTime: event.target.value })} required /></label>
                <label>Tipo<select value={blockForm.type} onChange={(event) => setBlockForm({ ...blockForm, type: event.target.value })}><option value="BLOCK">Bloqueio</option><option value="TIME_OFF">Ausência</option></select></label>
                <label className="full">Motivo<input value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} placeholder="Ex.: reunião, almoço extra, compromisso" /></label>
                <button className="primary full" type="submit" disabled={saving}>{saving ? 'Bloqueando…' : 'Bloquear este período'}</button>
              </form>
            )}
          </section>
        </div>
      )}

      {selectedAppointment && (
        <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAppointment(null); }}>
          <section className="ops-modal" role="dialog" aria-modal="true" aria-label="Detalhes do atendimento">
            <header><div><span className="eyebrow">Atendimento</span><h2>{selectedAppointment.clientName}</h2><p>{selectedAppointment.service?.name} · {currency(selectedAppointment.service?.price || 0)}</p></div><button type="button" onClick={() => setSelectedAppointment(null)} aria-label="Fechar">×</button></header>
            <div className="ops-modal-summary">
              <span><small>Horário atual</small><strong>{timeLabel(new Date(selectedAppointment.startTime))}–{timeLabel(new Date(selectedAppointment.endTime))}</strong></span>
              <span><small>Profissional</small><strong>{selectedAppointment.professional?.name || '—'}</strong></span>
              <span><small>Duração</small><strong>{durationLabel(appointmentMinutes(selectedAppointment))}</strong></span>
              <span><small>Etapa</small><strong>{selectedAppointment.status === 'CONFIRMED' ? attendanceLabel(selectedAttendance) : statusLabel(selectedAppointment.status)}</strong></span>
              <span className="full-summary"><small>Confirmação do cliente</small><strong className={selectedCommunication.startsWith('✓') ? 'presence-ok' : ''}>{selectedCommunication}</strong></span>
            </div>

            {selectedAppointment.status === 'CONFIRMED' && selectedAttendance !== 'IN_SERVICE' && (
              <form className="ops-move-form" onSubmit={submitMove}>
                <h3>Reagendar</h3>
                <label>Data<input type="date" value={moveForm.date} onChange={(event) => setMoveForm({ ...moveForm, date: event.target.value })} required /></label>
                <label>Horário<input type="time" step="1800" value={moveForm.time} onChange={(event) => setMoveForm({ ...moveForm, time: event.target.value })} required /></label>
                <label>Profissional<select value={moveForm.professionalId} onChange={(event) => setMoveForm({ ...moveForm, professionalId: event.target.value })} required>{mergedProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
                <button className="primary" type="submit" disabled={saving}>{saving ? 'Validando…' : 'Salvar novo horário'}</button>
              </form>
            )}

            {selectedAppointment.status === 'CONFIRMED' && (
              <div className="ops-status-actions ops-attendance-actions"><strong>Fluxo do atendimento</strong><div><button type="button" className={selectedAttendance === 'SCHEDULED' ? 'is-current' : ''} onClick={() => updateAttendance('SCHEDULED')} disabled={saving}>Confirmado</button><button type="button" className={selectedAttendance === 'ARRIVED' ? 'is-current arrived' : ''} onClick={() => updateAttendance('ARRIVED')} disabled={saving}>✓ Cliente chegou</button><button type="button" className={selectedAttendance === 'IN_SERVICE' ? 'is-current service' : ''} onClick={() => updateAttendance('IN_SERVICE')} disabled={saving}>▶ Em atendimento</button></div></div>
            )}

            <div className="ops-status-actions"><strong>Encerrar / ocorrência</strong><div><button type="button" onClick={() => updateStatus('COMPLETED')} disabled={saving}>Concluído</button><button type="button" onClick={() => updateStatus('NO_SHOW')} disabled={saving}>Não compareceu</button><button type="button" className="danger" onClick={() => updateStatus('CANCELED')} disabled={saving}>Cancelar</button></div></div>
          </section>
        </div>
      )}

      <style>{`
        .ops-agenda-page{min-height:75vh;padding:34px 18px 80px;background:radial-gradient(circle at 10% 0%,color-mix(in srgb,var(--gold) 10%,transparent),transparent 28%)}.ops-shell{max-width:1480px;margin:0 auto;display:grid;gap:18px}.ops-header{display:flex;justify-content:space-between;gap:22px;align-items:flex-start}.ops-header>div:first-child{max-width:820px}.ops-header h1{margin:7px 0 8px;font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.04em}.ops-header p{color:var(--muted);margin:0}.ops-header-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ops-sync-state{font-size:.72rem;color:#22c55e;padding:8px 10px;border:1px solid color-mix(in srgb,#22c55e 24%,var(--border));border-radius:999px;background:color-mix(in srgb,#22c55e 7%,var(--surface))}
        .ops-toolbar{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:end;border:1px solid var(--border);background:var(--surface);border-radius:20px;padding:15px}.ops-date-nav{display:flex;align-items:end;gap:7px}.ops-date-nav>button{height:42px;min-width:42px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);font-weight:800;cursor:pointer}.ops-date-nav label,.ops-pro-filter{display:grid;gap:5px;font-size:.76rem;color:var(--muted)}.ops-date-nav input,.ops-pro-filter select{height:42px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:12px;padding:0 11px}.ops-date-title{display:grid;align-self:center}.ops-date-title strong{text-transform:capitalize;font-size:1.05rem}.ops-date-title small{color:var(--muted);margin-top:3px}.ops-toolbar-right{display:flex;gap:10px;align-items:end}.ops-view-toggle{display:flex;padding:4px;border:1px solid var(--border);border-radius:12px;background:var(--card)}.ops-view-toggle button{height:34px;padding:0 13px;border:0;border-radius:8px;background:transparent;color:var(--muted);font-weight:850;cursor:pointer}.ops-view-toggle button.active{background:var(--surface);color:var(--text);box-shadow:0 3px 12px rgba(0,0,0,.12)}.ops-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ops-kpis article{display:grid;gap:3px;padding:15px 17px;border:1px solid var(--border);background:var(--surface);border-radius:18px}.ops-kpis span,.ops-kpis small{color:var(--muted)}.ops-kpis strong{font-size:1.25rem}.ops-feedback{margin:0}
        .ops-week-grid{display:grid;grid-template-columns:repeat(7,minmax(185px,1fr));gap:10px;overflow-x:auto;padding-bottom:6px}.ops-week-day{min-width:185px;border:1px solid var(--border);border-radius:18px;background:var(--surface);overflow:hidden}.ops-week-day.is-today{border-color:color-mix(in srgb,var(--gold) 60%,var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--gold) 10%,transparent)}.ops-week-day>header{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:12px;border-bottom:1px solid var(--border);background:var(--card)}.ops-week-day>header div{display:grid;gap:2px}.ops-week-day>header strong{text-transform:capitalize}.ops-week-day>header small{color:var(--muted);font-size:.68rem}.ops-week-day>header button{border:0;background:transparent;color:var(--gold);font-size:.7rem;font-weight:900;cursor:pointer}.ops-week-list{display:grid;gap:7px;padding:8px;max-height:62vh;overflow:auto}.ops-week-event{display:grid;gap:2px;padding:9px;border:1px solid var(--border);border-left:3px solid var(--gold);border-radius:11px;background:var(--card);color:var(--text);text-align:left;cursor:pointer}.ops-week-event>span{font-size:.68rem;color:var(--gold);font-weight:900}.ops-week-event strong{font-size:.78rem}.ops-week-event small{font-size:.66rem;color:var(--muted)}.ops-week-event em{font-style:normal;font-size:.62rem;color:var(--muted)}.ops-week-event em.confirmed{color:#22c55e;font-weight:900}.ops-week-event.attendance-arrived{border-left-color:#2563eb}.ops-week-event.attendance-in_service{border-left-color:#16a34a}.ops-week-empty{padding:22px 8px;text-align:center;color:var(--muted);font-size:.75rem}
        .ops-board-wrap{border:1px solid var(--border);background:var(--surface);border-radius:22px;overflow:hidden}.ops-legend{display:flex;gap:16px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border);color:var(--muted);font-size:.78rem}.ops-legend span{display:flex;align-items:center;gap:6px}.ops-legend i{width:12px;height:12px;border-radius:4px;border:1px solid var(--border)}.legend-free{background:var(--card)}.legend-arrived{background:#2563eb}.legend-service{background:#16a34a}.legend-confirmed{background:#22c55e}.legend-break{background:color-mix(in srgb,#f0b429 20%,var(--card))}.legend-block{background:color-mix(in srgb,#8b949e 23%,var(--card))}
        .ops-board{display:flex;max-height:72vh;overflow:auto;position:relative}.ops-time-rail{position:sticky;left:0;z-index:20;width:64px;min-width:64px;background:var(--surface);border-right:1px solid var(--border)}.ops-time-head{height:68px;display:grid;place-items:center;position:sticky;top:0;z-index:30;background:var(--surface);border-bottom:1px solid var(--border);font-size:.72rem;color:var(--muted);font-weight:800}.ops-time-body{position:relative}.ops-time-body>span{position:absolute;right:10px;transform:translateY(-7px);font-size:.7rem;color:var(--muted)}.ops-now-label{position:absolute;right:4px;z-index:40;transform:translateY(-50%);padding:2px 4px;border-radius:5px;background:#ef4444;color:white;font-size:.58rem}.ops-lanes{display:grid;min-width:max-content;flex:1}.ops-lane{min-width:250px;border-right:1px solid var(--border)}.ops-lane-head{height:68px;position:sticky;top:0;z-index:15;display:flex;align-items:center;gap:10px;padding:10px 13px;background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}.ops-lane-head img,.ops-lane-head>span{width:38px;height:38px;border-radius:12px;object-fit:cover;display:grid;place-items:center;background:var(--gold);color:#111;font-weight:900}.ops-lane-head div{display:grid;gap:2px}.ops-lane-head small{color:var(--muted)}.ops-lane-body{position:relative;background:var(--card);overflow:hidden}.ops-lane-body.is-clickable{cursor:crosshair}.ops-lane-body.is-day-off{background:repeating-linear-gradient(135deg,var(--surface),var(--surface) 8px,color-mix(in srgb,var(--border) 35%,var(--surface)) 8px,color-mix(in srgb,var(--border) 35%,var(--surface)) 16px)}.ops-grid-line{position:absolute;left:0;right:0;height:1px;background:color-mix(in srgb,var(--border) 64%,transparent);pointer-events:none}.ops-now-line{position:absolute;left:0;right:0;height:2px;background:#ef4444;z-index:7;pointer-events:none}.ops-now-line span{position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:#ef4444}.ops-closed-block{position:absolute;left:0;right:0;background:repeating-linear-gradient(135deg,color-mix(in srgb,#8b949e 10%,var(--surface)),color-mix(in srgb,#8b949e 10%,var(--surface)) 7px,color-mix(in srgb,#8b949e 17%,var(--surface)) 7px,color-mix(in srgb,#8b949e 17%,var(--surface)) 14px);z-index:1;color:var(--muted);font-size:.68rem;padding:5px 8px}.ops-closed-block.full{top:0;bottom:0;height:100%;display:grid;place-items:center;font-weight:800}.ops-unavailable-block{position:absolute;left:5px;right:5px;z-index:3;border-radius:9px;padding:5px 7px;display:grid;align-content:start;overflow:hidden;font-size:.68rem;border:1px dashed color-mix(in srgb,#f0b429 45%,var(--border));background:color-mix(in srgb,#f0b429 13%,var(--surface));color:var(--muted)}.ops-unavailable-block.exception{border-color:color-mix(in srgb,#8b949e 60%,var(--border));background:color-mix(in srgb,#8b949e 18%,var(--surface))}.ops-unavailable-block strong{color:var(--text)}
        .ops-event{position:absolute;left:7px;right:7px;z-index:8;border:1px solid color-mix(in srgb,var(--gold) 45%,var(--border));border-left:4px solid var(--gold);border-radius:11px;background:color-mix(in srgb,var(--gold) 13%,var(--surface));color:var(--text);padding:6px 8px;text-align:left;display:grid;gap:1px;overflow:hidden;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.12)}.ops-event[draggable=true]{cursor:grab}.ops-event-time{font-size:.67rem;font-weight:900;color:var(--gold)}.ops-event strong{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ops-event>span:not(.ops-event-time){font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ops-event small{font-size:.62rem;color:var(--muted)}.ops-event.attendance-arrived{border-left-color:#2563eb;background:color-mix(in srgb,#2563eb 13%,var(--surface))}.ops-event.attendance-in_service{border-left-color:#16a34a;background:color-mix(in srgb,#16a34a 14%,var(--surface))}.ops-event.status-completed{opacity:.72;border-left-color:#3fb950}.ops-event.status-no_show{border-left-color:#f85149}.ops-confirmed-presence{font-style:normal;font-size:.58rem;color:#22c55e;font-weight:900}.ops-empty{padding:30px;color:var(--muted)}
        .ops-modal-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.58);display:grid;place-items:center;padding:18px}.ops-modal{width:min(680px,100%);max-height:90vh;overflow:auto;border:1px solid var(--border);border-radius:24px;background:var(--surface);padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.4);display:grid;gap:18px}.ops-modal>header{display:flex;justify-content:space-between;gap:18px}.ops-modal h2{margin:5px 0}.ops-modal header p{margin:0;color:var(--muted)}.ops-modal header>button{width:38px;height:38px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);font-size:1.3rem}.ops-modal-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ops-modal-summary span{display:grid;gap:3px;padding:12px;border:1px solid var(--border);border-radius:14px;background:var(--card)}.ops-modal-summary span.full-summary{grid-column:1/-1}.ops-modal-summary small{color:var(--muted)}.presence-ok{color:#22c55e}.ops-move-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:9px;align-items:end;border-top:1px solid var(--border);padding-top:16px}.ops-move-form h3{grid-column:1/-1;margin:0}.ops-move-form label{display:grid;gap:5px;color:var(--muted);font-size:.76rem}.ops-move-form input,.ops-move-form select{height:42px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:12px;padding:0 10px}.ops-status-actions{display:grid;gap:10px;border-top:1px solid var(--border);padding-top:16px}.ops-status-actions>div{display:flex;gap:8px;flex-wrap:wrap}.ops-status-actions button{border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:12px;padding:10px 13px;font-weight:800;cursor:pointer}.ops-status-actions button.danger{border-color:color-mix(in srgb,#f85149 50%,var(--border));color:#f85149}.ops-status-actions button.is-current{border-color:var(--gold)}.ops-status-actions button.is-current.arrived{border-color:#2563eb;color:#60a5fa}.ops-status-actions button.is-current.service{border-color:#16a34a;color:#4ade80}
        .ops-quick-modal{width:min(720px,100%)}.ops-quick-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:5px;background:var(--card);border-radius:14px}.ops-quick-tabs button{min-height:42px;border:0;border-radius:10px;background:transparent;color:var(--muted);font-weight:850;cursor:pointer}.ops-quick-tabs button.active{background:var(--surface);color:var(--text)}.ops-quick-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ops-quick-form label{display:grid;gap:6px;color:var(--muted);font-size:.78rem}.ops-quick-form input,.ops-quick-form select,.ops-quick-form textarea{width:100%;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:12px;padding:10px 11px;font:inherit}.ops-quick-form input,.ops-quick-form select{height:44px}.ops-quick-form textarea{resize:vertical}.ops-quick-form .full{grid-column:1/-1}
        @media(max-width:1050px){.ops-toolbar{grid-template-columns:1fr}.ops-toolbar-right{justify-content:space-between}.ops-week-grid{grid-template-columns:repeat(7,210px)}}
        @media(max-width:900px){.ops-header{display:grid}.ops-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ops-board{max-height:68vh}.ops-lane{min-width:230px}.ops-move-form{grid-template-columns:1fr 1fr}.ops-move-form h3,.ops-move-form label:nth-of-type(3),.ops-move-form button{grid-column:1/-1}}
        @media(max-width:560px){.ops-agenda-page{padding:22px 8px 60px}.ops-header-actions{display:grid}.ops-header-actions>*{width:100%;text-align:center}.ops-date-nav{display:grid;grid-template-columns:42px 1fr auto 42px}.ops-date-nav input{width:100%}.ops-toolbar-right{display:grid}.ops-view-toggle{display:grid;grid-template-columns:1fr 1fr}.ops-kpis{gap:6px}.ops-kpis article{padding:11px}.ops-board-wrap{border-radius:16px}.ops-time-rail{width:48px;min-width:48px}.ops-time-body>span{right:5px;font-size:.62rem}.ops-lane{min-width:210px}.ops-modal{padding:16px;border-radius:18px}.ops-modal-summary{grid-template-columns:1fr}.ops-modal-summary span.full-summary{grid-column:1}.ops-move-form,.ops-quick-form{grid-template-columns:1fr}.ops-move-form>*,.ops-quick-form>*{grid-column:1/-1}.ops-quick-tabs{grid-template-columns:1fr}.ops-week-grid{grid-template-columns:repeat(7,82vw)}}
      `}</style>
    </main>
  );
}
