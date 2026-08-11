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
export function AgendaEnterprise({ appointments, professionals, reload }) {
  const todayIso = toLocalIsoDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [viewMode, setViewMode] = useState('week');
  const [professionalId, setProfessionalId] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [editingAppointment, setEditingAppointment] = useState(null);

  const normalizedAppointments = useMemo(
    () => normalizeAppointments(appointments, professionalId),
    [appointments, professionalId]
  );

  const visibleProfessionals = useMemo(
    () => professionalId ? professionals.filter((professional) => professional.id === professionalId) : professionals,
    [professionalId, professionals]
  );

  // Grades custosas só são montadas quando a visualização correspondente está ativa.
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
      appointments: normalizedAppointments,
      viewMode,
      selectedDate,
      weekDays: viewMode === 'week' ? weekDays : buildWeekDays(selectedDate)
    }),
    [normalizedAppointments, selectedDate, viewMode, weekDays]
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
    if (!draggingId) return;
    const appointment = appointments.find((item) => item.id === draggingId);
    const nextProfessionalId = professional?.id || appointment?.professionalId || appointment?.professional?.id;
    if (!appointment || !nextProfessionalId) return;
    try {
      await reschedule({ appointmentId: appointment.id, dateIso, time: hour, professionalId: nextProfessionalId });
      setDraggingId('');
    } catch {
      // O hook mantém o feedback visível; o drop não deve desmontar a Agenda em erro.
    }
  }, [appointments, draggingId, reschedule]);

  const openDay = useCallback((dateIso) => {
    setSelectedDate(dateIso);
    setViewMode('day');
  }, []);

  return (
    <section className="panel-card enterprise-calendar-panel">
      <div className="enterprise-calendar-header full-span">
        <div>
          <span className="eyebrow">Agenda Enterprise</span>
          <h2>Calendário operacional do salão</h2>
          <p className="panel-help">Dia, semana, mês e profissionais usam o mesmo contrato de reagendamento e isolamento de dados.</p>
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
        professionals={professionals}
        onPrevious={() => move(-1)}
        onNext={() => move(1)}
        todayIso={todayIso}
      />

      {message && <p className="feedback full-span" role="status" aria-live="polite">{message}</p>}

      {viewMode === 'day' && (
        <AgendaDayView
          selectedDate={selectedDate}
          appointments={visibleAppointments}
          professionals={visibleProfessionals}
          draggingId={draggingId}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId('')}
          onDrop={handleDrop}
          onReschedule={setEditingAppointment}
        />
      )}

      {viewMode === 'week' && (
        <AgendaWeekView
          weekDays={weekDays}
          appointments={visibleAppointments}
          professionals={visibleProfessionals}
          draggingId={draggingId}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId('')}
          onDrop={handleDrop}
          onReschedule={setEditingAppointment}
        />
      )}

      {viewMode === 'month' && (
        <AgendaMonthView
          monthDays={monthDays}
          appointments={normalizedAppointments}
          onOpenDay={openDay}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId('')}
          onReschedule={setEditingAppointment}
        />
      )}

      {viewMode === 'timeline' && (
        <AgendaProfessionalsView
          selectedDate={selectedDate}
          appointments={visibleAppointments}
          professionals={visibleProfessionals}
          draggingId={draggingId}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId('')}
          onDrop={handleDrop}
          onReschedule={setEditingAppointment}
        />
      )}

      {visibleAppointments.length === 0 && viewMode !== 'month' && (
        <p className="empty-state full-span">Nenhum agendamento encontrado para o período selecionado.</p>
      )}

      {editingAppointment && (
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
