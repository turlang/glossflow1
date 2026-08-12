import React, { useRef } from 'react';
import { Input, Select } from '../../ui/Forms.jsx';

const VIEWS = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'timeline', label: 'Profissionais' }
];

export function AgendaToolbar({ viewMode, setViewMode, selectedDate, setSelectedDate, professionalId, setProfessionalId, professionals, onPrevious, onNext, todayIso }) {
  const refs = useRef([]);

  function onTabsKeyDown(event, index) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % VIEWS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + VIEWS.length) % VIEWS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = VIEWS.length - 1;
    const next = VIEWS[nextIndex];
    setViewMode(next.key);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div className="calendar-toolbar full-span">
      <div className="calendar-view-switch" role="tablist" aria-label="Alternar visualização da agenda">
        {VIEWS.map((view, index) => (
          <button
            key={view.key}
            ref={(element) => { refs.current[index] = element; }}
            type="button"
            role="tab"
            aria-selected={viewMode === view.key}
            tabIndex={viewMode === view.key ? 0 : -1}
            className={viewMode === view.key ? 'active' : ''}
            onClick={() => setViewMode(view.key)}
            onKeyDown={(event) => onTabsKeyDown(event, index)}
          >
            {view.label}
          </button>
        ))}
      </div>
      <div className="calendar-navigation">
        <button type="button" className="ghost-button" onClick={onPrevious}>Anterior</button>
        <Input label="Data" type="date" value={selectedDate} onChange={setSelectedDate} />
        <button type="button" className="ghost-button" onClick={() => setSelectedDate(todayIso)}>Hoje</button>
        <button type="button" className="ghost-button" onClick={onNext}>Próximo</button>
      </div>
      <Select
        label="Profissional"
        value={professionalId}
        onChange={setProfessionalId}
        options={professionals.map((professional) => ({ value: professional.id, label: professional.name }))}
      />
    </div>
  );
}
