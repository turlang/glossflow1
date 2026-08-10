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

      <style>{`
        .manage-booking-page{min-height:100vh;padding:38px 16px;display:grid;place-items:center;background:radial-gradient(circle at 20% 0%,color-mix(in srgb,var(--primary) 14%,transparent),transparent 35%),var(--bg);color:var(--text)}.manage-booking-card{width:min(620px,100%);display:grid;gap:20px;padding:24px;border:1px solid var(--border);border-radius:26px;background:var(--surface);box-shadow:0 24px 80px rgba(0,0,0,.24)}.manage-booking-back{width:max-content;display:inline-flex;align-items:center;min-height:40px;padding:0 12px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);font-weight:850;text-decoration:none}.manage-booking-back:hover{border-color:color-mix(in srgb,var(--primary) 55%,var(--border));color:var(--primary)}.manage-booking-brand{display:flex;align-items:center;gap:12px}.manage-booking-brand>img,.manage-booking-brand>span{width:46px;height:46px;border-radius:14px;object-fit:cover;display:grid;place-items:center;background:var(--primary);color:#111;font-weight:950}.manage-booking-brand>div{display:grid}.manage-booking-brand small{color:var(--muted)}.manage-booking-status{display:flex;align-items:center;gap:8px;width:max-content;padding:7px 11px;border-radius:999px;background:color-mix(in srgb,#22c55e 14%,var(--card));color:#22c55e}.manage-booking-status.is-cancelled{background:color-mix(in srgb,#ef4444 12%,var(--card));color:#ef4444}.manage-booking-main{padding:20px;border-radius:20px;background:var(--card)}.manage-booking-main small{color:var(--muted)}.manage-booking-main h1{margin:5px 0 12px;font-size:clamp(1.7rem,5vw,2.5rem)}.manage-booking-main p{margin:5px 0;color:var(--muted)}.manage-booking-policy{padding:16px 18px;border:1px solid color-mix(in srgb,var(--primary) 32%,var(--border));border-radius:18px;background:color-mix(in srgb,var(--primary) 6%,var(--surface))}.manage-booking-policy p{margin:7px 0 0;color:var(--muted);line-height:1.45}.manage-booking-policy .is-warning{color:#f59e0b}.manage-booking-cancel{height:48px;border:1px solid color-mix(in srgb,#ef4444 48%,var(--border));border-radius:14px;background:color-mix(in srgb,#ef4444 10%,var(--surface));color:#ef4444;font-weight:900;cursor:pointer}.manage-booking-contact{text-align:center;color:var(--primary);font-weight:800}.manage-booking-home{min-height:48px;padding:0 16px;border:1px solid var(--border);border-radius:14px;display:grid;place-items:center;text-align:center;color:var(--text);background:var(--card);font-weight:900;text-decoration:none}.manage-booking-home.primary-home{border-color:color-mix(in srgb,var(--primary) 45%,var(--border));background:var(--primary);color:#111}.manage-booking-state{padding:30px;text-align:center;color:var(--muted)}.manage-booking-state.is-error{display:grid;gap:12px;color:#ef4444}.manage-booking-feedback{padding:12px 14px;border-radius:14px}.manage-booking-feedback.success{background:color-mix(in srgb,#22c55e 12%,var(--surface));color:#22c55e}.manage-booking-feedback.error{background:color-mix(in srgb,#ef4444 12%,var(--surface));color:#ef4444}@media(max-width:640px){.manage-booking-page{padding:16px}.manage-booking-card{padding:18px;border-radius:20px}.manage-booking-back{width:100%;justify-content:center}}
      `}</style>
    </main>
  );
}
