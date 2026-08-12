import React, { useEffect, useState } from 'react';
import { request } from '../../services/api';

const EMPTY = {
  provider: 'MANUAL',
  customerId: '',
  subscriptionRef: '',
  nextBillingAt: '',
  notes: ''
};

function dateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function TenantBillingProfile({ salon }) {
  const [snapshot, setSnapshot] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function load() {
    setLoading(true);
    setFeedback('');
    try {
      const data = await request(`/platform-admin/salons/${salon.id}/lifecycle`);
      setSnapshot(data);
      setDraft({
        provider: data.billing?.provider || 'MANUAL',
        customerId: data.billing?.customerId || '',
        subscriptionRef: data.billing?.subscriptionRef || '',
        nextBillingAt: dateInput(data.billing?.nextBillingAt),
        notes: data.billing?.notes || ''
      });
    } catch (error) {
      setFeedback(error.message || 'Não foi possível carregar o ciclo SaaS.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [salon.id]);

  function patch(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      const data = await request(`/platform-admin/salons/${salon.id}/lifecycle`, {
        method: 'PUT',
        body: JSON.stringify({ billing: draft })
      });
      setSnapshot((current) => current ? { ...current, billing: data.billing, billingReady: data.billing?.provider === 'MANUAL' || Boolean(data.billing?.customerId && data.billing?.subscriptionRef) } : current);
      setFeedback('Preparação de billing salva e auditada.');
    } catch (error) {
      setFeedback(error.message || 'Não foi possível salvar a preparação de billing.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="panel-card"><p>Carregando ciclo SaaS...</p></section>;

  const access = snapshot?.access;
  return (
    <section className="panel-card" aria-label={`Ciclo SaaS de ${salon.name}`}>
      <div className="hero-actions">
        <div>
          <span className="eyebrow">Ciclo SaaS</span>
          <h3>Billing e acesso contratual</h3>
          <p>Referências do gateway ficam separadas do estado da assinatura. Nenhuma cobrança externa é criada automaticamente nesta tela.</p>
        </div>
        <span className={`status-badge ${access?.allowed ? 'status-active' : 'status-canceled'}`}>
          {access?.allowed ? `Acesso liberado · ${access.code}` : `Acesso bloqueado · ${access?.code || 'SEM ESTADO'}`}
        </span>
      </div>

      {snapshot?.subscription && (
        <div className="mini-stats full-span">
          <div><span>Status</span><strong>{snapshot.subscription.status}</strong></div>
          <div><span>Plano</span><strong>{snapshot.subscription.plan?.name || 'Sem plano'}</strong></div>
          <div><span>Fim / graça</span><strong>{snapshot.subscription.endsAt ? new Date(snapshot.subscription.endsAt).toLocaleDateString('pt-BR') : 'Sem data'}</strong></div>
          <div><span>Billing</span><strong>{snapshot?.billingReady ? 'Pronto' : 'Pendente'}</strong></div>
        </div>
      )}

      <form className="pp-form" onSubmit={save}>
        <label className="pp-field"><span>Provider de cobrança</span><select value={draft.provider} onChange={(event) => patch('provider', event.target.value)}><option value="MANUAL">Manual</option><option value="MERCADO_PAGO">Mercado Pago</option><option value="STRIPE">Stripe</option><option value="OTHER">Outro</option></select></label>
        <label className="pp-field"><span>Customer ID</span><input value={draft.customerId} onChange={(event) => patch('customerId', event.target.value)} placeholder="ID do cliente no gateway" /></label>
        <label className="pp-field"><span>Subscription / contrato externo</span><input value={draft.subscriptionRef} onChange={(event) => patch('subscriptionRef', event.target.value)} placeholder="ID da assinatura no gateway" /></label>
        <label className="pp-field"><span>Próxima cobrança</span><input type="date" value={draft.nextBillingAt} onChange={(event) => patch('nextBillingAt', event.target.value)} /></label>
        <label className="pp-field full"><span>Observações de billing</span><textarea value={draft.notes} onChange={(event) => patch('notes', event.target.value)} placeholder="Ex.: cobrança negociada, período de cortesia, referência do contrato..." /></label>
        <div className="pp-form-actions"><span className="pp-form-note">Para providers externos, o cadastro fica “Pronto” quando Customer ID e Subscription ID estiverem preenchidos.</span><button className="primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar billing'}</button></div>
      </form>

      {snapshot?.lastLifecycleEvent && <p className="panel-help">Último evento: <strong>{snapshot.lastLifecycleEvent.action}</strong> em {new Date(snapshot.lastLifecycleEvent.createdAt).toLocaleString('pt-BR')}.</p>}
      {feedback && <p className="feedback">{feedback}</p>}
    </section>
  );
}
