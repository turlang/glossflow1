import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';

function money(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function parseFeatures(value) {
  return String(value || '')
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function planDraft(plan) {
  return {
    name: plan?.name || '',
    price: String(plan?.price ?? ''),
    maxUsers: String(plan?.maxUsers ?? 5),
    maxSalons: String(plan?.maxSalons ?? 1),
    features: plan?.features || '',
    active: plan?.active !== false
  };
}

export function PlatformPlans({ plans, salons, value, setValue, saving, onSubmit }) {
  const [localPlans, setLocalPlans] = useState(plans || []);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState(planDraft());
  const [action, setAction] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => { setLocalPlans(plans || []); }, [plans]);

  const features = useMemo(() => parseFeatures(value.features), [value.features]);
  const editFeatures = useMemo(() => parseFeatures(draft.features), [draft.features]);

  const metrics = useMemo(() => {
    const active = localPlans.filter((plan) => plan.active !== false).length;
    const assigned = salons.filter((salon) => salon.subscription?.planId).length;
    const mrr = salons.reduce((total, salon) => {
      if (salon.subscription?.status !== 'ACTIVE') return total;
      const plan = localPlans.find((item) => item.id === salon.subscription?.planId);
      return total + Number(plan?.price || 0);
    }, 0);
    return { total: localPlans.length, active, assigned, mrr };
  }, [localPlans, salons]);

  function patch(key, next) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  function patchDraft(key, next) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  function subscribers(planId) {
    return salons.filter((salon) => salon.subscription?.planId === planId).length;
  }

  function beginEdit(plan) {
    setEditingId(plan.id);
    setDraft(planDraft(plan));
    setFeedback('');
    requestAnimationFrame(() => document.getElementById('pp-maintenance-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  function cancelEdit() {
    setEditingId('');
    setDraft(planDraft());
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editingId) return;
    setAction(`edit-${editingId}`);
    setFeedback('');
    try {
      const updated = await request(`/platform-admin/plans/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: draft.name,
          price: Number(draft.price),
          maxUsers: Number(draft.maxUsers),
          maxSalons: Number(draft.maxSalons || 1),
          features: draft.features,
          active: Boolean(draft.active)
        })
      });
      setLocalPlans((current) => current.map((plan) => plan.id === editingId ? updated : plan));
      setFeedback(`Plano ${updated.name} atualizado com sucesso.`);
      cancelEdit();
    } catch (error) {
      setFeedback(error.message || 'Não foi possível atualizar o plano.');
    } finally {
      setAction('');
    }
  }

  async function toggleStatus(plan) {
    setAction(`status-${plan.id}`);
    setFeedback('');
    try {
      const updated = await request(`/platform-admin/plans/${plan.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: plan.name,
          price: Number(plan.price),
          maxUsers: Number(plan.maxUsers),
          maxSalons: Number(plan.maxSalons || 1),
          features: plan.features,
          active: plan.active === false
        })
      });
      setLocalPlans((current) => current.map((item) => item.id === plan.id ? updated : item));
      setFeedback(updated.active ? `Plano ${updated.name} reativado.` : `Plano ${updated.name} arquivado. Clientes já vinculados mantêm o histórico.`);
    } catch (error) {
      setFeedback(error.message || 'Não foi possível alterar o status do plano.');
    } finally {
      setAction('');
    }
  }

  return (
    <section className="pp-shell" aria-label="Gestão de planos">

      <div className="pp-metrics">
        {[['◇', metrics.total, 'Planos', 'Catálogo criado'], ['✓', metrics.active, 'Ativos', 'Disponíveis para venda'], ['◆', metrics.assigned, 'Clientes', 'Com plano atribuído'], ['R$', money(metrics.mrr), 'MRR', 'Assinaturas ativas']].map(([icon, result, label, hint]) => (
          <article className="pp-metric" key={label}><span className="pp-metric-icon">{icon}</span><div><small>{label}</small><strong>{result}</strong><span>{hint}</span></div></article>
        ))}
      </div>

      {feedback && <div className="pp-feedback">{feedback}</div>}

      <div className="pp-builder">
        <section className="pp-panel">
          <header className="pp-panel-head"><div><span className="eyebrow">Catálogo comercial</span><h2>Novo plano</h2><p>Crie uma nova oferta para disponibilizar aos clientes.</p></div><span className="pp-step">NOVO</span></header>
          <form className="pp-form" onSubmit={onSubmit}>
            <label className="pp-field"><span>Nome do plano</span><input required placeholder="Ex.: GlossFlow Smart" value={value.name} onChange={(event) => patch('name', event.target.value)} /></label>
            <label className="pp-field"><span>Preço mensal</span><input required type="number" min="0" step="0.01" value={value.price} onChange={(event) => patch('price', event.target.value)} /></label>
            <label className="pp-field"><span>Limite de usuários</span><input required type="number" min="1" value={value.maxUsers} onChange={(event) => patch('maxUsers', event.target.value)} /></label>
            <label className="pp-field"><span>Status inicial</span><input value="Ativo" disabled /></label>
            <label className="pp-field full"><span>Benefícios e recursos</span><textarea required placeholder={'Agenda inteligente\nControle de estoque\nWhatsApp + IA'} value={value.features} onChange={(event) => patch('features', event.target.value)} /></label>
            <div className="pp-form-actions"><span className="pp-form-note">Os módulos liberados continuam sendo definidos individualmente por cliente.</span><button className="primary" disabled={saving}>{saving ? 'Criando...' : 'Criar plano'}</button></div>
          </form>
        </section>

        <aside className="pp-preview">
          <div className="pp-preview-top"><span>Prévia comercial</span><span className="pp-live">AO VIVO</span></div><div className="pp-plan-icon">◇</div><h3>{value.name || 'Nome do plano'}</h3><div className="pp-price"><strong>{money(value.price)}</strong><span>/ mês</span></div>
          {features.length ? <ul className="pp-preview-features">{features.map((feature) => <li key={feature}><b>✓</b><span>{feature}</span></li>)}</ul> : <div className="pp-preview-empty">Adicione os benefícios para visualizar a oferta.</div>}
          <div className="pp-preview-foot"><span>Usuários incluídos</span><strong>{value.maxUsers || 0}</strong></div>
        </aside>
      </div>

      {editingId && (
        <section className="pp-editor" id="pp-maintenance-editor">
          <header className="pp-editor-head"><div><span className="eyebrow">Manutenção do plano</span><h2>Editar {draft.name}</h2><p>Altere preço, limites, benefícios e disponibilidade sem recriar o plano.</p></div><div className="pp-actions"><button className="secondary" type="button" onClick={cancelEdit}>Cancelar</button></div></header>
          <form className="pp-form" onSubmit={saveEdit}>
            <label className="pp-field"><span>Nome</span><input required value={draft.name} onChange={(e) => patchDraft('name', e.target.value)} /></label>
            <label className="pp-field"><span>Preço mensal</span><input required type="number" min="0" step="0.01" value={draft.price} onChange={(e) => patchDraft('price', e.target.value)} /></label>
            <label className="pp-field"><span>Máx. usuários</span><input required type="number" min="1" value={draft.maxUsers} onChange={(e) => patchDraft('maxUsers', e.target.value)} /></label>
            <label className="pp-field"><span>Status</span><select value={draft.active ? 'active' : 'archived'} onChange={(e) => patchDraft('active', e.target.value === 'active')}><option value="active">Ativo</option><option value="archived">Arquivado</option></select></label>
            <label className="pp-field full"><span>Benefícios e recursos</span><textarea required value={draft.features} onChange={(e) => patchDraft('features', e.target.value)} /></label>
            <div className="pp-field full"><span>Prévia dos benefícios</span><div className="pp-editor-preview">{editFeatures.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></div>
            <div className="pp-form-actions"><span className="pp-form-note">As alterações afetam a oferta do plano. Assinaturas já vinculadas permanecem relacionadas ao mesmo plano.</span><button className="primary" disabled={action === `edit-${editingId}`}>{action === `edit-${editingId}` ? 'Salvando...' : 'Salvar alterações'}</button></div>
          </form>
        </section>
      )}

      <section className="pp-catalog">
        <header className="pp-catalog-head"><div><span className="eyebrow">Planos cadastrados</span><h2>Catálogo e manutenção</h2><p>Edite um plano existente ou arquive ofertas que não devem mais ser vendidas.</p></div><span className="pp-count">{localPlans.length} plano(s)</span></header>
        <div className="pp-grid">
          {localPlans.map((plan) => {
            const planFeatures = parseFeatures(plan.features);
            const count = subscribers(plan.id);
            const active = plan.active !== false;
            return (
              <article className={`pp-card ${active ? '' : 'archived'}`} key={plan.id}>
                <div className="pp-card-head"><h3>{plan.name}</h3><span className={`pp-status ${active ? 'on' : ''}`}>{active ? 'Ativo' : 'Arquivado'}</span></div>
                <div className="pp-card-price"><strong>{money(plan.price)}</strong><span>/ mês</span></div>
                <div className="pp-card-features">{planFeatures.slice(0, 4).map((feature) => <span key={feature}>{feature}</span>)}{!planFeatures.length && <span>Sem benefícios cadastrados</span>}</div>
                <div className="pp-card-foot">
                  <div className="pp-card-meta"><strong>{plan.maxUsers} usuário(s)</strong><span>{count} cliente(s)</span></div>
                  <div className="pp-card-controls">
                    <button className="secondary" type="button" onClick={() => beginEdit(plan)}>Editar</button>
                    <button className={active ? 'pp-archive' : 'pp-reactivate'} type="button" disabled={action === `status-${plan.id}`} onClick={() => toggleStatus(plan)}>{action === `status-${plan.id}` ? 'Aguarde...' : active ? 'Arquivar' : 'Reativar'}</button>
                  </div>
                </div>
              </article>
            );
          })}
          {!localPlans.length && <div className="pp-empty">Nenhum plano cadastrado ainda.</div>}
        </div>
      </section>
    </section>
  );
}
