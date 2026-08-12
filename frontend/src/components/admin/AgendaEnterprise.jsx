import React, { useCallback, useMemo, useState } from 'react';
import { currency } from '../../utils/format.js';
import {
  AGENDA_HOURS,
  buildMonthDays,
  buildWeekDays,
  calculateAgendaMetrics,
  filterAppointmentsForView,
  moveAgendaDate,
  normalizeAppointments,
  toLocalIsoDate
} from './agenda/agenda-enterprise.utils.js';
import { AgendaToolbar } from './agenda/AgendaToolbar.jsx';
import { AgendaDayView } from './agenda/AgendaDayView.jsx';
import { AgendaWeekView } from './agenda/AgendaWeekView.jsx';
import { AgendaMonthView } from './agenda/AgendaMonthView.jsx';
import { AgendaProfessionalsView } from './agenda/AgendaProfessionalsView.jsx';
import { AgendaRescheduleForm } from './agenda/AgendaRescheduleForm.jsx';
import { useAgendaReschedule } from './agenda/useAgendaReschedule.js';

/** Orquestrador do domínio Agenda; regras e visualizações vivem em módulos próprios. */
export function AgendaEnterprise({ appointments, professionals, services = [], reload, readOnly = false }) {
  const todayIso = toLocalIsoDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [viewMode, setViewMode] = useState('week');
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [editingAppointment, setEditingAppointment] = useState(null);

  const normalizedAppointments = useMemo(
    () => normalizeAppointments(appointments, professionalId),
    [appointments, professionalId]
  );

  const commercialFilteredAppointments = useMemo(
    () => normalizedAppointments.filter((appointment) => {
      const appointmentServiceId = appointment.serviceId || appointment.service?.id || '';
      const matchesService = !serviceId || appointmentServiceId === serviceId;
      const matchesStatus = !statusFilter || appointment.status === statusFilter;
      return matchesService && matchesStatus;
    }),
    [normalizedAppointments, serviceId, statusFilter]
  );

  const visibleProfessionals = useMemo(
    () => professionalId ? professionals.filter((professional) => professional.id === professionalId) : professionals,
    [professionalId, professionals]
  );

  const weekDays = useMemo(
    () => viewMode === 'week' ? buildWeekDays(selectedDate) : [],
    [selectedDate, viewMode]
  );
  const monthDays = useMemo(
    () => viewMode === 'month' ? buildMonthDays(selectedDate) : [],
    [selectedDate, viewMode]
  );

  const visibleAppointments = useMemo(
    () => filterAppointmentsForView({
      appointments: commercialFilteredAppointments,
      viewMode,
      selectedDate,
      weekDays: viewMode === 'week' ? weekDays : buildWeekDays(selectedDate)
    }),
    [commercialFilteredAppointments, selectedDate, viewMode, weekDays]
  );

  const metrics = useMemo(
    () => calculateAgendaMetrics({
      appointments: visibleAppointments,
      professionals: visibleProfessionals,
      viewMode,
      selectedDate,
      hours: AGENDA_HOURS
    }),
    [selectedDate, visibleAppointments, visibleProfessionals, viewMode]
  );

  const { reschedule, message, busy } = useAgendaReschedule({ appointments, reload });

  const move = useCallback((direction) => {
    const unit = viewMode === 'month' ? 'month' : 'day';
    const amount = viewMode === 'week' ? direction * 7 : direction;
    setSelectedDate((current) => moveAgendaDate(current, amount, unit));
  }, [viewMode]);

  const handleDrop = useCallback(async (event, { dateIso, hour, professional }) => {
    event.preventDefault();
    if (readOnly || !draggingId) return;
    const appointment = appointments.find((item) => item.id === draggingId);
    const nextProfessionalId = professional?.id || appointment?.professionalId || appointment?.professional?.id;
    if (!appointment || !nextProfessionalId) return;
    try {
      await reschedule({ appointmentId: appointment.id, dateIso, time: hour, professionalId: nextProfessionalId });
      setDraggingId('');
    } catch {
      // O hook mantém o feedback visível; o drop não deve desmontar a Agenda em erro.
    }
  }, [appointments, draggingId, readOnly, reschedule]);

  const openDay = useCallback((dateIso) => {
    setSelectedDate(dateIso);
    setViewMode('day');
  }, []);

  const clearFilters = useCallback(() => {
    setProfessionalId('');
    setServiceId('');
    setStatusFilter('');
  }, []);

  const dragStart = readOnly ? undefined : setDraggingId;
  const dragEnd = readOnly ? undefined : () => setDraggingId('');
  const drop = readOnly ? undefined : handleDrop;
  const openReschedule = readOnly ? undefined : setEditingAppointment;
  const hasCommercialFilters = Boolean(professionalId || serviceId || statusFilter);

  return (
    <section className="panel-card enterprise-calendar-panel">
      <div className="enterprise-calendar-header full-span">
        <div>
          <span className="eyebrow">Agenda Enterprise</span>
          <h2>Calendário operacional do salão</h2>
          <p className="panel-help">
            {readOnly
              ? 'Visualização somente leitura para o perfil Profissional.'
              : 'Planeje por período e combine filtros de profissional, serviço e status antes de reagendar.'}
          </p>
        </div>
        <div className="enterprise-calendar-kpis" aria-label="Indicadores da agenda">
          <div><span>Agendamentos</span><strong>{metrics.count}</strong><small>no período</small></div>
          <div><span>Ocupação</span><strong>{metrics.occupancy}%</strong><small>capacidade estimada</small></div>
          <div><span>Potencial</span><strong>{currency(metrics.potential)}</strong><small>em serviços</small></div>
        </div>
      </div>

      <AgendaToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        professionalId={professionalId}
        setProfessionalId={setProfessionalId}
        serviceId={serviceId}
        setServiceId={setServiceId}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        professionals={professionals}
        services={services}
        onPrevious={() => move(-1)}
        onNext={() => move(1)}
        onClearFilters={clearFilters}
        todayIso={todayIso}
      />

      {hasCommercialFilters && (
        <p className="agenda-filter-summary full-span" role="status">
          Filtros ativos: {commercialFilteredAppointments.length} agendamento(s) no conjunto selecionado.
        </p>
      )}

      {!readOnly && message && <p className="feedback full-span" role="status" aria-live="polite">{message}</p>}

      {viewMode === 'day' && (
        <AgendaDayView
          selectedDate={selectedDate}
          appointments={visibleAppointments}
          professionals={visibleProfessionals}
          draggingId={draggingId}
          onDragStart={dragStart}
          onDragEnd={dragEnd}
          onDrop={drop}
          onReschedule={openReschedule}
        />
      )}

      {viewMode === 'week' && (
        <AgendaWeekView
          weekDays={weekDays}
          appointments={visibleAppointments}
          professionals={visibleProfessionals}
          draggingId={draggingId}
          onDragStart={dragStart}
          onDragEnd={dragEnd}
          onDrop={drop}
          onReschedule={openReschedule}
        />
      )}

      {viewMode === 'month' && (
        <AgendaMonthView
          monthDays={monthDays}
          appointments={commercialFilteredAppointments}
          onOpenDay={openDay}
          onDragStart={dragStart}
          onDragEnd={dragEnd}
          onReschedule={openReschedule}
        />
      )}

      {viewMode === 'timeline' && (
        <AgendaProfessionalsView
          selectedDate={selectedDate}
          appointments={visibleAppointments}
          professionals={visibleProfessionals}
          draggingId={draggingId}
          onDragStart={dragStart}
          onDragEnd={dragEnd}
          onDrop={drop}
          onReschedule={openReschedule}
        />
      )}

      {visibleAppointments.length === 0 && viewMode !== 'month' && (
        <p className="empty-state full-span">
          {hasCommercialFilters
            ? 'Nenhum agendamento corresponde aos filtros e ao período selecionados.'
            : 'Nenhum agendamento encontrado para o período selecionado.'}
        </p>
      )}

      {!readOnly && editingAppointment && (
        <AgendaRescheduleForm
          appointment={editingAppointment}
          professionals={professionals}
          busy={busy}
          onCancel={() => setEditingAppointment(null)}
          onConfirm={reschedule}
        />
      )}
    </section>
  );
}
