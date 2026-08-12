const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const AGENDA_HOURS = Array.from({ length: 13 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);

export function isValidIsoDate(value) {
  if (!DATE_RE.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseLocalDate(value) {
  if (!isValidIsoDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toLocalIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localDateFromTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : toLocalIsoDate(date);
}

export function daysInSelectedMonth(selectedDate) {
  const selected = parseLocalDate(selectedDate);
  if (!selected) return 0;
  return new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 12).getDate();
}

export function buildWeekDays(selectedDate) {
  const selected = parseLocalDate(selectedDate);
  if (!selected) return [];
  const dayIndex = selected.getDay();
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
  const monday = new Date(selected);
  monday.setDate(selected.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      date,
      iso: toLocalIsoDate(date),
      label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
      day: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    };
  });
}

export function buildMonthDays(selectedDate) {
  const selected = parseLocalDate(selectedDate);
  if (!selected) return [];
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
  const start = new Date(first);
  const weekDay = start.getDay() || 7;
  start.setDate(first.getDate() - (weekDay - 1));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      iso: toLocalIsoDate(date),
      inMonth: date.getMonth() === selected.getMonth(),
      label: String(date.getDate()).padStart(2, '0')
    };
  });
}

export function normalizeAppointments(appointments, professionalId = '') {
  return (Array.isArray(appointments) ? appointments : [])
    .filter((appointment) => !professionalId || appointment.professionalId === professionalId || appointment.professional?.id === professionalId)
    .map((appointment) => {
      const start = new Date(appointment.startTime);
      const validStart = !Number.isNaN(start.getTime());
      return {
        ...appointment,
        dateIso: validStart ? toLocalIsoDate(start) : '',
        hourKey: validStart ? `${String(start.getHours()).padStart(2, '0')}:00` : ''
      };
    })
    .filter((appointment) => appointment.dateIso)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function filterAppointmentsForView({ appointments, viewMode, selectedDate, weekDays }) {
  if (viewMode === 'day' || viewMode === 'timeline') {
    return appointments.filter((appointment) => appointment.dateIso === selectedDate);
  }
  if (viewMode === 'month') {
    const selected = parseLocalDate(selectedDate);
    if (!selected) return [];
    return appointments.filter((appointment) => {
      const date = new Date(appointment.startTime);
      return date.getMonth() === selected.getMonth() && date.getFullYear() === selected.getFullYear();
    });
  }
  const start = weekDays[0]?.iso;
  const end = weekDays[6]?.iso;
  if (!start || !end) return [];
  return appointments.filter((appointment) => appointment.dateIso >= start && appointment.dateIso <= end);
}

export function calculateAgendaMetrics({ appointments, professionals, viewMode, selectedDate, hours = AGENDA_HOURS }) {
  const list = Array.isArray(appointments) ? appointments : [];
  const team = Array.isArray(professionals) ? professionals : [];
  const potential = list.reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
  const occupiedSlots = new Set(list.map((appointment) => `${appointment.professional?.id || appointment.professionalId}-${appointment.dateIso}-${appointment.hourKey}`)).size;
  const periodDays = viewMode === 'week' ? 7 : viewMode === 'month' ? Math.max(1, daysInSelectedMonth(selectedDate)) : 1;
  const capacity = Math.max(1, team.length * hours.length * periodDays);
  return {
    count: list.length,
    potential,
    capacity,
    occupancy: Math.min(100, Math.round((occupiedSlots / capacity) * 100))
  };
}

export function moveAgendaDate(selectedDate, amount, unit = 'day') {
  const current = parseLocalDate(selectedDate);
  if (!current) return selectedDate;
  const originalDay = current.getDate();

  if (unit === 'month') {
    current.setDate(1);
    current.setMonth(current.getMonth() + amount);
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0, 12).getDate();
    current.setDate(Math.min(originalDay, lastDay));
  } else {
    current.setDate(current.getDate() + amount);
  }
  return toLocalIsoDate(current);
}

export function buildRescheduleStart(dateIso, time) {
  if (!isValidIsoDate(dateIso) || !/^\d{2}:\d{2}$/.test(String(time || ''))) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const date = parseLocalDate(dateIso);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function appointmentsForSlot(appointments, { dateIso, hour, professional }) {
  return appointments.filter((appointment) => {
    const byDate = !dateIso || appointment.dateIso === dateIso;
    const byHour = !hour || appointment.hourKey === hour;
    const byProfessional = !professional || appointment.professionalId === professional.id || appointment.professional?.id === professional.id;
    return byDate && byHour && byProfessional;
  });
}
