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
      <style>{`
        .pp-shell{display:grid;gap:18px;--pp-line:rgba(148,163,184,.16);--pp-gold:var(--gold-2);--pp-purple:var(--primary)}
        .pp-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.pp-metric{min-height:104px;padding:16px;border:1px solid var(--pp-line);border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.024));display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:center}.pp-metric-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(244,211,125,.22),rgba(170,124,242,.19));color:var(--pp-gold);font-weight:950}.pp-metric small{display:block;color:var(--muted);font-size:.72rem}.pp-metric strong{display:block;color:var(--strong);font-size:1.35rem;margin:3px 0}.pp-metric span{font-size:.72rem;color:var(--muted)}
        .pp-builder{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:16px}.pp-panel,.pp-preview,.pp-catalog,.pp-editor{border:1px solid var(--pp-line);border-radius:24px;background:linear-gradient(180deg,rgba(17,24,39,.92),rgba(9,14,24,.92));box-shadow:0 22px 70px rgba(0,0,0,.15)}html[data-theme="light"] .pp-panel,html[data-theme="light"] .pp-preview,html[data-theme="light"] .pp-catalog,html[data-theme="light"] .pp-editor{background:var(--surface)}
        .pp-panel,.pp-catalog,.pp-editor{padding:22px}.pp-preview{padding:20px;display:flex;flex-direction:column}.pp-panel-head,.pp-catalog-head,.pp-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.pp-panel-head h2,.pp-catalog-head h2,.pp-editor-head h2{margin:4px 0 5px;color:var(--strong);font-size:1.35rem}.pp-panel-head p,.pp-catalog-head p,.pp-editor-head p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.5}.pp-step,.pp-count{padding:7px 10px;border:1px solid rgba(244,211,125,.18);border-radius:999px;background:rgba(244,211,125,.07);color:var(--pp-gold);font-size:.68rem;font-weight:950;white-space:nowrap}
        .pp-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pp-field{display:grid;gap:7px}.pp-field.full{grid-column:1/-1}.pp-field span{font-size:.72rem;font-weight:900;color:var(--text)}.pp-field small{color:var(--muted);font-size:.68rem}.pp-field input,.pp-field textarea,.pp-field select{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.20);background:rgba(7,11,20,.52);color:var(--text);border-radius:14px;padding:12px 13px;outline:none;font:inherit}.pp-field textarea{min-height:112px;resize:vertical}.pp-field input:focus,.pp-field textarea:focus,.pp-field select:focus{border-color:rgba(244,211,125,.58);box-shadow:0 0 0 3px rgba(244,211,125,.08)}.pp-form-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:4px}.pp-form-note{font-size:.72rem;color:var(--muted);max-width:500px}.pp-actions{display:flex;gap:8px;flex-wrap:wrap}.pp-actions button{min-height:36px;padding:0 12px}
        .pp-preview-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.pp-preview-top span:first-child{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:900}.pp-live{padding:5px 8px;border-radius:999px;background:rgba(52,211,153,.09);border:1px solid rgba(52,211,153,.2);color:#86efac;font-size:.62rem;font-weight:950}.pp-plan-icon{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;margin:24px 0 16px;background:linear-gradient(135deg,var(--pp-gold),var(--pp-purple));color:#101421;font-weight:950}.pp-preview h3{margin:0;color:var(--strong);font-size:1.55rem}.pp-price{display:flex;align-items:baseline;gap:5px;margin:10px 0 16px}.pp-price strong{font-size:2rem;color:var(--strong)}.pp-price span{color:var(--muted);font-size:.78rem}.pp-preview-features{display:grid;gap:8px;margin:0 0 18px;padding:0;list-style:none}.pp-preview-features li{display:grid;grid-template-columns:20px 1fr;gap:8px;color:var(--muted);font-size:.78rem}.pp-preview-features b{color:#86efac}.pp-preview-empty{color:var(--muted);font-size:.78rem;padding:12px;border:1px dashed var(--pp-line);border-radius:14px}.pp-preview-foot{margin-top:auto;padding-top:16px;border-top:1px solid var(--pp-line);display:flex;justify-content:space-between;color:var(--muted);font-size:.72rem}
        .pp-feedback{padding:12px 14px;border-radius:16px;background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.18);color:#bbf7d0;font-size:.82rem}.pp-editor{border-color:rgba(244,211,125,.28);box-shadow:0 20px 55px rgba(0,0,0,.2),inset 0 0 0 1px rgba(244,211,125,.05)}.pp-editor-preview{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pp-editor-preview span{padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.055);border:1px solid var(--pp-line);font-size:.68rem;color:var(--muted)}
        .pp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:12px}.pp-card{min-height:285px;padding:17px;border:1px solid var(--pp-line);border-radius:19px;background:linear-gradient(180deg,rgba(255,255,255,.047),rgba(255,255,255,.022));display:flex;flex-direction:column;transition:.18s ease}.pp-card:hover{transform:translateY(-2px);border-color:rgba(244,211,125,.28)}.pp-card.archived{opacity:.68}.pp-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.pp-card-head h3{margin:0;color:var(--strong);font-size:1rem}.pp-status{padding:5px 8px;border-radius:999px;font-size:.6rem;font-weight:950;text-transform:uppercase;background:rgba(251,113,133,.08);border:1px solid rgba(251,113,133,.18);color:#fda4af}.pp-status.on{background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.18);color:#86efac}.pp-card-price{margin:13px 0 14px}.pp-card-price strong{font-size:1.6rem;color:var(--strong)}.pp-card-price span{color:var(--muted);font-size:.7rem}.pp-card-features{display:grid;gap:6px;margin-bottom:16px}.pp-card-features span{color:var(--muted);font-size:.72rem;line-height:1.35}.pp-card-features span:before{content:'✓';color:#86efac;font-weight:950;margin-right:7px}.pp-card-foot{display:grid;gap:11px;margin-top:auto;padding-top:13px;border-top:1px solid var(--pp-line)}.pp-card-meta{display:flex;justify-content:space-between;gap:10px}.pp-card-meta strong,.pp-card-meta span{font-size:.68rem}.pp-card-meta span{color:var(--muted)}.pp-card-controls{display:flex;gap:8px}.pp-card-controls button{flex:1;min-height:36px;border-radius:999px;font-weight:850}.pp-archive{color:#fecdd3;background:rgba(251,113,133,.08);border:1px solid rgba(251,113,133,.18)}.pp-reactivate{color:#bbf7d0;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.18)}.pp-empty{grid-column:1/-1;padding:30px;border:1px dashed var(--pp-line);border-radius:18px;text-align:center;color:var(--muted)}
        @media(max-width:1180px){.pp-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-builder{grid-template-columns:1fr}.pp-preview{min-height:300px}}@media(max-width:720px){.pp-metrics{grid-template-columns:1fr 1fr}.pp-panel,.pp-preview,.pp-catalog,.pp-editor{padding:16px;border-radius:19px}.pp-form{grid-template-columns:1fr}.pp-field.full,.pp-form-actions{grid-column:1}.pp-form-actions,.pp-editor-head{align-items:stretch;flex-direction:column}.pp-form-actions .primary{width:100%}.pp-grid{grid-template-columns:1fr}.pp-card-controls{flex-direction:column}}@media(max-width:460px){.pp-metrics{grid-template-columns:1fr}}
      `}</style>

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
