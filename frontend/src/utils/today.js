export function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function businessToday(appointments, entries, now) {
  const today = appointments
    .filter((a) => dayKey(a.startTime) === dayKey(now))
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const active = today.filter((a) => !['CANCELED', 'NO_SHOW'].includes(a.status));
  return {
    today,
    completed: today.filter((a) => a.status === 'COMPLETED').length,
    expected: active.reduce((sum, a) => sum + Number(a.service?.price || 0), 0),
    received: entries
      .filter((e) => e.type === 'REVENUE' && e.paid === true && dayKey(e.referenceDate) === dayKey(now))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    next: today.filter((a) => a.status === 'CONFIRMED' && new Date(a.endTime || a.startTime) >= now)
  };
}
