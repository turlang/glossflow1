import React, { useMemo } from 'react';

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
    .slice(0, 8);
}

export function PlatformPlans({ plans, salons, value, setValue, saving, onSubmit }) {
  const features = useMemo(() => parseFeatures(value.features), [value.features]);

  const metrics = useMemo(() => {
    const activePlans = plans.filter((plan) => plan.active !== false);
    const assigned = salons.filter((salon) => salon.subscription?.planId).length;
    const mrr = salons.reduce((total, salon) => {
      if (salon.subscription?.status !== 'ACTIVE') return total;
      const plan = plans.find((item) => item.id === salon.subscription?.planId);
      return total + Number(plan?.price || 0);
    }, 0);
    return {
      total: plans.length,
      active: activePlans.length,
      assigned,
      mrr
    };
  }, [plans, salons]);

  function patch(key, next) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  function subscribers(planId) {
    return salons.filter((salon) => salon.subscription?.planId === planId).length;
  }

  return (
    <section className="pp-shell" aria-label="Gestão de planos">
      <style>{`
        .pp-shell{display:grid;gap:18px;--pp-line:rgba(148,163,184,.16);--pp-soft:rgba(255,255,255,.035);--pp-gold:var(--gold-2);--pp-purple:var(--primary)}
        .pp-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .pp-metric{min-height:104px;padding:16px;border:1px solid var(--pp-line);border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.024));display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:center}
        .pp-metric-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(244,211,125,.22),rgba(170,124,242,.19));border:1px solid rgba(244,211,125,.19);color:var(--pp-gold);font-weight:950}
        .pp-metric small,.pp-card small{display:block;color:var(--muted);font-size:.72rem}.pp-metric strong{display:block;color:var(--strong);font-size:1.35rem;line-height:1.1;margin:3px 0}.pp-metric span{font-size:.72rem;color:var(--muted)}
        .pp-builder{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:16px;align-items:stretch}
        .pp-panel,.pp-preview,.pp-catalog{border:1px solid var(--pp-line);border-radius:24px;background:linear-gradient(180deg,rgba(17,24,39,.92),rgba(9,14,24,.92));box-shadow:0 22px 70px rgba(0,0,0,.15)}
        html[data-theme="light"] .pp-panel,html[data-theme="light"] .pp-preview,html[data-theme="light"] .pp-catalog{background:var(--surface)}
        .pp-panel{padding:22px}.pp-panel-head,.pp-catalog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.pp-panel-head h2,.pp-catalog-head h2{margin:4px 0 5px;color:var(--strong);font-size:1.35rem;letter-spacing:-.025em}.pp-panel-head p,.pp-catalog-head p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.5}
        .pp-step{padding:7px 10px;border:1px solid rgba(244,211,125,.18);border-radius:999px;background:rgba(244,211,125,.07);color:var(--pp-gold);font-size:.68rem;font-weight:950;white-space:nowrap}
        .pp-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pp-field{display:grid;gap:7px}.pp-field.full{grid-column:1/-1}.pp-field span{font-size:.72rem;font-weight:900;color:var(--text)}.pp-field small{color:var(--muted);font-size:.68rem;line-height:1.35}
        .pp-field input,.pp-field textarea{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.20);background:rgba(7,11,20,.52);color:var(--text);border-radius:14px;padding:12px 13px;outline:none;font:inherit;transition:.16s ease}.pp-field textarea{min-height:112px;resize:vertical}.pp-field input:focus,.pp-field textarea:focus{border-color:rgba(244,211,125,.58);box-shadow:0 0 0 3px rgba(244,211,125,.08)}
        html[data-theme="light"] .pp-field input,html[data-theme="light"] .pp-field textarea{background:rgba(255,255,255,.72)}
        .pp-form-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:4px}.pp-form-note{font-size:.72rem;color:var(--muted);max-width:460px}.pp-form-actions .primary{min-width:160px}
        .pp-preview{padding:20px;display:flex;flex-direction:column;position:relative;overflow:hidden}.pp-preview:before{content:"";position:absolute;width:220px;height:220px;border-radius:50%;right:-90px;top:-110px;background:radial-gradient(circle,rgba(170,124,242,.22),transparent 68%);pointer-events:none}
        .pp-preview-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.pp-preview-top span:first-child{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:900}.pp-live{padding:5px 8px;border-radius:999px;background:rgba(52,211,153,.09);border:1px solid rgba(52,211,153,.2);color:#86efac;font-size:.62rem;font-weight:950}
        .pp-plan-icon{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;margin:24px 0 16px;background:linear-gradient(135deg,var(--pp-gold),var(--pp-purple));color:#101421;font-weight:950;font-size:1.1rem;box-shadow:0 14px 35px rgba(170,124,242,.20)}
        .pp-preview h3{margin:0;color:var(--strong);font-size:1.55rem;letter-spacing:-.035em}.pp-price{display:flex;align-items:baseline;gap:5px;margin:10px 0 16px}.pp-price strong{font-size:2rem;color:var(--strong);letter-spacing:-.045em}.pp-price span{color:var(--muted);font-size:.78rem}
        .pp-preview-features{display:grid;gap:8px;margin:0 0 18px;padding:0;list-style:none}.pp-preview-features li{display:grid;grid-template-columns:20px 1fr;gap:8px;align-items:start;color:var(--muted);font-size:.78rem;line-height:1.4}.pp-preview-features b{width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:rgba(52,211,153,.1);color:#86efac;font-size:.65rem}.pp-preview-empty{color:var(--muted);font-size:.78rem;line-height:1.5;padding:12px;border:1px dashed var(--pp-line);border-radius:14px}
        .pp-preview-foot{margin-top:auto;padding-top:16px;border-top:1px solid var(--pp-line);display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--muted);font-size:.72rem}.pp-preview-foot strong{color:var(--text)}
        .pp-catalog{padding:22px}.pp-count{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.055);border:1px solid var(--pp-line);color:var(--muted);font-size:.7rem;font-weight:850;white-space:nowrap}
        .pp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px}.pp-card{position:relative;min-height:250px;padding:17px;border:1px solid var(--pp-line);border-radius:19px;background:linear-gradient(180deg,rgba(255,255,255,.047),rgba(255,255,255,.022));display:flex;flex-direction:column;overflow:hidden;transition:.18s ease}.pp-card:hover{transform:translateY(-2px);border-color:rgba(244,211,125,.28)}.pp-card.active{box-shadow:inset 0 0 0 1px rgba(52,211,153,.08)}
        .pp-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.pp-card-head h3{margin:0;color:var(--strong);font-size:1rem}.pp-status{padding:5px 8px;border-radius:999px;font-size:.6rem;font-weight:950;text-transform:uppercase;letter-spacing:.05em;background:rgba(251,113,133,.08);border:1px solid rgba(251,113,133,.18);color:#fda4af}.pp-status.on{background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.18);color:#86efac}
        .pp-card-price{margin:13px 0 14px}.pp-card-price strong{font-size:1.6rem;color:var(--strong);letter-spacing:-.04em}.pp-card-price span{color:var(--muted);font-size:.7rem}.pp-card-features{display:grid;gap:6px;margin-bottom:16px}.pp-card-features span{display:flex;gap:7px;align-items:flex-start;color:var(--muted);font-size:.72rem;line-height:1.35}.pp-card-features span:before{content:"✓";color:#86efac;font-weight:950}.pp-card-features .muted:before{content:"—";color:var(--soft)}
        .pp-card-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:13px;border-top:1px solid var(--pp-line)}.pp-card-foot strong{font-size:.72rem;color:var(--text)}.pp-card-foot span{font-size:.68rem;color:var(--muted)}
        .pp-empty{grid-column:1/-1;padding:30px;border:1px dashed var(--pp-line);border-radius:18px;text-align:center;color:var(--muted)}
        @media(max-width:1180px){.pp-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-builder{grid-template-columns:1fr}.pp-preview{min-height:330px}}
        @media(max-width:720px){.pp-metrics{grid-template-columns:1fr 1fr}.pp-panel,.pp-preview,.pp-catalog{padding:16px;border-radius:19px}.pp-form{grid-template-columns:1fr}.pp-field.full,.pp-form-actions{grid-column:1}.pp-form-actions{align-items:stretch;flex-direction:column}.pp-form-actions .primary{width:100%}.pp-grid{grid-template-columns:1fr}.pp-panel-head,.pp-catalog-head{align-items:flex-start}.pp-metric{min-height:90px;padding:12px;grid-template-columns:36px 1fr}.pp-metric-icon{width:36px;height:36px}.pp-metric strong{font-size:1.12rem}}
        @media(max-width:460px){.pp-metrics{grid-template-columns:1fr}.pp-panel-head{flex-direction:column}.pp-step{align-self:flex-start}}
      `}</style>

      <div className="pp-metrics" aria-label="Resumo comercial de planos">
        {[
          ['◇', metrics.total, 'Planos', 'Catálogo criado'],
          ['✓', metrics.active, 'Ativos', 'Disponíveis para venda'],
          ['◆', metrics.assigned, 'Clientes', 'Com plano atribuído'],
          ['R$', money(metrics.mrr), 'MRR', 'Assinaturas ativas']
        ].map(([icon, result, label, hint]) => (
          <article className="pp-metric" key={label}>
            <span className="pp-metric-icon">{icon}</span>
            <div><small>{label}</small><strong>{result}</strong><span>{hint}</span></div>
          </article>
        ))}
      </div>

      <div className="pp-builder">
        <section className="pp-panel">
          <header className="pp-panel-head">
            <div>
              <span className="eyebrow">Catálogo comercial</span>
              <h2>Novo plano</h2>
              <p>Defina uma oferta comercial clara. A assinatura será vinculada ao cliente depois.</p>
            </div>
            <span className="pp-step">CONFIGURAÇÃO</span>
          </header>

          <form className="pp-form" onSubmit={onSubmit}>
            <label className="pp-field">
              <span>Nome do plano</span>
              <input required placeholder="Ex.: GlossFlow Smart" value={value.name} onChange={(event) => patch('name', event.target.value)} />
              <small>Nome que aparecerá no catálogo comercial.</small>
            </label>

            <label className="pp-field">
              <span>Preço mensal</span>
              <input required type="number" min="0" step="0.01" placeholder="399,00" value={value.price} onChange={(event) => patch('price', event.target.value)} />
              <small>Valor recorrente cobrado por mês.</small>
            </label>

            <label className="pp-field">
              <span>Limite de usuários</span>
              <input required type="number" min="1" value={value.maxUsers} onChange={(event) => patch('maxUsers', event.target.value)} />
              <small>Quantidade máxima de acessos internos.</small>
            </label>

            <label className="pp-field">
              <span>Status inicial</span>
              <input value="Ativo" disabled aria-label="Status inicial do plano" />
              <small>Novos planos entram ativos no catálogo.</small>
            </label>

            <label className="pp-field full">
              <span>Benefícios e recursos</span>
              <textarea required placeholder={'Agenda inteligente\nControle de estoque\nWhatsApp + IA'} value={value.features} onChange={(event) => patch('features', event.target.value)} />
              <small>Use uma linha por benefício. Também aceitamos vírgula ou ponto e vírgula.</small>
            </label>

            <div className="pp-form-actions">
              <span className="pp-form-note">O plano define a oferta comercial. Os módulos efetivamente liberados continuam sendo controlados por cliente.</span>
              <button className="primary" disabled={saving}>{saving ? 'Criando plano...' : 'Criar plano'}</button>
            </div>
          </form>
        </section>

        <aside className="pp-preview" aria-label="Prévia do plano">
          <div className="pp-preview-top"><span>Prévia comercial</span><span className="pp-live">AO VIVO</span></div>
          <div className="pp-plan-icon">◇</div>
          <h3>{value.name || 'Nome do plano'}</h3>
          <div className="pp-price"><strong>{money(value.price)}</strong><span>/ mês</span></div>

          {features.length > 0 ? (
            <ul className="pp-preview-features">
              {features.map((feature) => <li key={feature}><b>✓</b><span>{feature}</span></li>)}
            </ul>
          ) : (
            <div className="pp-preview-empty">Os benefícios digitados no formulário aparecerão aqui como uma lista comercial organizada.</div>
          )}

          <div className="pp-preview-foot">
            <span>Limite de equipe</span>
            <strong>{value.maxUsers || 0} usuário(s)</strong>
          </div>
        </aside>
      </div>

      <section className="pp-catalog">
        <header className="pp-catalog-head">
          <div>
            <span className="eyebrow">Oferta da plataforma</span>
            <h2>Planos cadastrados</h2>
            <p>Visualize rapidamente preço, benefícios e adesão de cada plano.</p>
          </div>
          <span className="pp-count">{plans.length} plano(s)</span>
        </header>

        <div className="pp-grid">
          {plans.map((plan) => {
            const items = parseFeatures(plan.features);
            return (
              <article className={`pp-card ${plan.active !== false ? 'active' : ''}`} key={plan.id}>
                <div className="pp-card-head">
                  <h3>{plan.name}</h3>
                  <span className={`pp-status ${plan.active !== false ? 'on' : ''}`}>{plan.active !== false ? 'Ativo' : 'Inativo'}</span>
                </div>

                <div className="pp-card-price"><strong>{money(plan.price)}</strong><span> / mês</span></div>

                <div className="pp-card-features">
                  {items.length > 0
                    ? items.slice(0, 5).map((item) => <span key={item}>{item}</span>)
                    : <span className="muted">Sem benefícios detalhados</span>}
                </div>

                <div className="pp-card-foot">
                  <span>Até {plan.maxUsers} usuário(s)</span>
                  <strong>{subscribers(plan.id)} cliente(s)</strong>
                </div>
              </article>
            );
          })}
          {plans.length === 0 && <div className="pp-empty">Nenhum plano cadastrado ainda. Crie a primeira oferta acima.</div>}
        </div>
      </section>
    </section>
  );
}
