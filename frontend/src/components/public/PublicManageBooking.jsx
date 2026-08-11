import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';

function dateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

export function PublicManageBooking() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const appointmentId = params.get('appointment') || '';
  const token = params.get('token') || '';
  const siteUrl = useMemo(() => {
    const next = new URLSearchParams();
    const salonSlug = params.get('salon');
    if (salonSlug) next.set('salon', salonSlug);
    const query = next.toString();
    return `${window.location.origin}/${query ? `?${query}` : ''}`;
  }, [params]);
  const [salon, setSalon] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ appointmentId, token });
      const [salonData, bookingData] = await Promise.all([
        request('/public/salon'),
        request(`/appointments/manage?${query}`)
      ]);
      setSalon(salonData);
      setAppointment(bookingData);
    } catch (err) {
      setError(err.message || 'Não foi possível abrir este agendamento.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function cancel() {
    if (!appointment?.cancellationPolicy?.canCancel) return;
    const ok = window.confirm(`Cancelar ${appointment.service.name} em ${dateTime(appointment.startTime)}? O horário será liberado para outro cliente.`);
    if (!ok) return;
    setCancelling(true);
    setError('');
    setMessage('');
    try {
      const result = await request('/appointments/cancel', {
        method: 'POST',
        body: JSON.stringify({ appointmentId, token })
      });
      setMessage(result.message || 'Agendamento cancelado com sucesso.');
      localStorage.removeItem('glossflow.lastBooking');
      await load();
    } catch (err) {
      setError(err.message || 'Não foi possível cancelar o agendamento.');
    } finally {
      setCancelling(false);
    }
  }

  const statusLabel = appointment?.status === 'CANCELED' ? 'Cancelado' : appointment?.status === 'COMPLETED' ? 'Concluído' : appointment?.status === 'NO_SHOW' ? 'Não compareceu' : 'Confirmado';

  return (
    <main className="manage-booking-page" style={{ '--primary': salon?.primaryColor || '#C49A6C' }}>
      <section className="manage-booking-card">
        <a className="manage-booking-back" href={siteUrl} aria-label="Voltar para o site do salão">← Voltar ao site</a>

        <div className="manage-booking-brand">
          {salon?.logoUrl ? <img src={salon.logoUrl} alt="" /> : <span>{(salon?.name || 'S').charAt(0)}</span>}
          <div><small>Gerenciar agendamento</small><strong>{salon?.name || 'Salão'}</strong></div>
        </div>

        {loading && <div className="manage-booking-state">Carregando seu agendamento…</div>}
        {!loading && error && !appointment && <div className="manage-booking-state is-error"><strong>Não foi possível abrir o agendamento.</strong><span>{error}</span><a className="manage-booking-home" href={siteUrl}>Voltar ao site do salão</a></div>}

        {appointment && (
          <>
            <div className={`manage-booking-status ${appointment.status === 'CANCELED' ? 'is-cancelled' : ''}`}>
              <span>●</span><strong>{statusLabel}</strong>
            </div>
            <div className="manage-booking-main">
              <small>Serviço</small>
              <h1>{appointment.service.name}</h1>
              <p>{dateTime(appointment.startTime)}</p>
              <p>Profissional: <strong>{appointment.professional.name}</strong></p>
            </div>

            <div className="manage-booking-policy">
              <strong>Política de cancelamento</strong>
              <p>O cancelamento pelo site é permitido com no mínimo <b>{appointment.cancellationPolicy.minHours} horas de antecedência</b>.</p>
              {appointment.status === 'CONFIRMED' && appointment.cancellationPolicy.canCancel
                ? <p>Você pode cancelar online até <strong>{dateTime(appointment.cancellationPolicy.cancelUntil)}</strong>.</p>
                : appointment.status === 'CONFIRMED'
                  ? <p className="is-warning">O prazo de cancelamento online encerrou. Entre em contato diretamente com o salão.</p>
                  : null}
            </div>

            {message && <p className="manage-booking-feedback success">{message}</p>}
            {error && <p className="manage-booking-feedback error">{error}</p>}

            {appointment.status === 'CONFIRMED' && appointment.cancellationPolicy.canCancel && (
              <button className="manage-booking-cancel" type="button" onClick={cancel} disabled={cancelling}>
                {cancelling ? 'Cancelando…' : 'Cancelar meu agendamento'}
              </button>
            )}

            {appointment.status === 'CANCELED' && (
              <a className="manage-booking-home primary-home" href={siteUrl}>← Voltar para o site do salão</a>
            )}

            {salon?.whatsapp && (
              <a className="manage-booking-contact" href={`https://wa.me/${String(salon.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Falar com o salão pelo WhatsApp</a>
            )}
          </>
        )}
      </section>
    </main>
  );
}
