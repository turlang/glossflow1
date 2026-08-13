import React, { useMemo, useState } from 'react';
import { request } from '../../../services/api.js';
import { currency } from '../../../utils/format.js';

function appointmentLabel(appointment) {
  const start = new Date(appointment.startTime);
  const when = Number.isNaN(start.getTime()) ? '' : start.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${appointment.clientName || 'Cliente'} • ${appointment.service?.name || 'Serviço'}${when ? ` • ${when}` : ''}`;
}

export function AgendaCheckoutPanel({ appointments = [], reload }) {
  const candidates = useMemo(
    () => appointments
      .filter((appointment) => ['CONFIRMED', 'COMPLETED'].includes(appointment.status))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [appointments]
  );
  const [appointmentId, setAppointmentId] = useState('');
  const [preview, setPreview] = useState(null);
  const [packageId, setPackageId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const servicePrice = Number(preview?.appointment?.service?.price || 0);
  const usingPackage = Boolean(packageId);
  const amountDue = usingPackage ? 0 : servicePrice;

  async function openCheckout(event) {
    event?.preventDefault();
    if (!appointmentId) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await request(`/admin/pos/appointments/${appointmentId}/checkout-preview`);
      setPreview(data);
      setPackageId('');
      setPaymentAmount(String(Number(data?.appointment?.service?.price || 0)));
      setResourceId('');
      if (data?.existingSale) setMessage(`Checkout já concluído pela venda ${data.existingSale.number}.`);
    } catch (error) {
      setPreview(null);
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function reserveResource() {
    if (!preview?.appointment?.id || !resourceId) return;
    setBusy(true);
    setMessage('');
    try {
      await request(`/admin/pos/appointments/${preview.appointment.id}/resource-reservations`, {
        method: 'POST',
        body: JSON.stringify({ resourceId })
      });
      setMessage('Recurso vinculado ao horário do atendimento.');
      await openCheckout();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function finishCheckout(event) {
    event.preventDefault();
    if (!preview?.appointment?.id || preview?.existingSale) return;
    setBusy(true);
    setMessage('');
    try {
      const normalizedAmount = Number(paymentAmount || 0);
      const payload = {
        ...(packageId ? { packageId } : {}),
        payments: amountDue > 0 ? [{ method: paymentMethod, amount: normalizedAmount }] : []
      };
      const result = await request(`/admin/pos/appointments/${preview.appointment.id}/checkout`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage(`Atendimento finalizado. Venda ${result.sale?.number || ''} registrada com sucesso.`);
      setPreview((current) => current ? { ...current, existingSale: result.sale, readyForCheckout: false } : current);
      await reload?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function changePackage(nextPackageId) {
    setPackageId(nextPackageId);
    setPaymentAmount(nextPackageId ? '0' : String(servicePrice));
  }

  if (!candidates.length) {
    return (
      <section className="panel-card full-span" aria-label="Checkout integrado da Agenda">
        <span className="eyebrow">Fechamento integrado</span>
        <h2>Agenda → PDV → Financeiro</h2>
        <p className="panel-help">Não há atendimentos confirmados ou concluídos aguardando operação de checkout.</p>
      </section>
    );
  }

  return (
    <section className="panel-card full-span" aria-label="Checkout integrado da Agenda">
      <div className="full-span">
        <span className="eyebrow">Fechamento integrado</span>
        <h2>Agenda → Recursos → Pacotes → PDV → Financeiro</h2>
        <p className="panel-help">Abra um atendimento para conferir benefício, recurso e valor antes de concluir a venda.</p>
      </div>

      <form className="form-grid full-span" onSubmit={openCheckout}>
        <label className="full-span">Atendimento
          <select value={appointmentId} onChange={(event) => { setAppointmentId(event.target.value); setPreview(null); setMessage(''); }} required>
            <option value="">Selecione</option>
            {candidates.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointmentLabel(appointment)}</option>)}
          </select>
        </label>
        <button type="submit" className="secondary full" disabled={busy || !appointmentId}>{busy ? 'Carregando...' : 'Abrir checkout'}</button>
      </form>

      {preview && (
        <div className="full-span dashboard-grid">
          <section className="panel-card">
            <h3>{preview.appointment.clientName}</h3>
            <p>{preview.appointment.service.name} • {preview.appointment.professional.name}</p>
            <strong>{currency(servicePrice)}</strong>
            <small>Status: {preview.appointment.status}</small>
          </section>

          <section className="panel-card">
            <h3>Pacote do cliente</h3>
            {preview.modules?.packages ? (
              <label>Crédito aplicável
                <select value={packageId} onChange={(event) => changePackage(event.target.value)} disabled={Boolean(preview.existingSale)}>
                  <option value="">Não usar pacote</option>
                  {(preview.eligiblePackages || []).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} • {item.remainingCredits} crédito(s)</option>
                  ))}
                </select>
              </label>
            ) : <p className="panel-help">Módulo Pacotes não habilitado neste tenant.</p>}
          </section>

          <section className="panel-card">
            <h3>Recurso físico</h3>
            {(preview.resourceReservations || []).length > 0 && (
              <p className="panel-help">Reservado: {preview.resourceReservations.map((item) => item.resourceName).join(', ')}</p>
            )}
            {preview.modules?.resources ? (
              <>
                <select value={resourceId} onChange={(event) => setResourceId(event.target.value)} disabled={busy || Boolean(preview.existingSale)}>
                  <option value="">Selecionar recurso disponível</option>
                  {(preview.availableResources || []).filter((item) => item.available).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} • {item.type}</option>
                  ))}
                </select>
                <button type="button" className="ghost-button" onClick={reserveResource} disabled={busy || !resourceId || Boolean(preview.existingSale)}>Vincular recurso</button>
              </>
            ) : <p className="panel-help">Módulo Recursos não habilitado neste tenant.</p>}
          </section>

          <form className="panel-card form-grid" onSubmit={finishCheckout}>
            <h3 className="full-span">Pagamento</h3>
            <div className="full-span"><span>Total do atendimento</span><strong>{currency(amountDue)}</strong></div>
            {amountDue > 0 && (
              <>
                <label>Forma de pagamento
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <option value="PIX">PIX</option>
                    <option value="CREDIT_CARD">Cartão de crédito</option>
                    <option value="DEBIT_CARD">Cartão de débito</option>
                    <option value="CASH">Dinheiro</option>
                  </select>
                </label>
                <label>Valor
                  <input type="number" step="0.01" min="0" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required />
                </label>
              </>
            )}
            <button type="submit" className="primary full" disabled={busy || Boolean(preview.existingSale) || !preview.readyForCheckout}>
              {preview.existingSale ? `Venda ${preview.existingSale.number} concluída` : busy ? 'Finalizando...' : 'Concluir atendimento e venda'}
            </button>
          </form>
        </div>
      )}

      {message && <p className="feedback full-span" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
