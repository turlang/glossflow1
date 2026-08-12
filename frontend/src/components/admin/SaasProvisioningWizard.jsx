import React, { useMemo, useState } from 'react';

const MODULE_ICONS = {
  SITE: '✦',
  AGENDA: '▦',
  ESTOQUE: '▣',
  CRM: '◎',
  FINANCEIRO: 'R$',
  FIDELIDADE: '★',
  WHATSAPP: '⚡',
  IA: '✧',
  ANALYTICS: '↗'
};

const PRESETS = [
  { key: 'essential', label: 'Essencial', description: 'Site + Agenda', modules: ['SITE', 'AGENDA'] },
  { key: 'smart', label: 'Smart', description: 'Agenda + Estoque + WhatsApp + IA', modules: ['SITE', 'AGENDA', 'ESTOQUE', 'WHATSAPP', 'IA'] },
  { key: 'management', label: 'Gestão', description: 'Operação + CRM + financeiro', modules: ['SITE', 'AGENDA', 'ESTOQUE', 'CRM', 'FINANCEIRO'] },
  { key: 'complete', label: 'Completo', description: 'Todos os módulos', modules: 'ALL' }
];

const STEPS = [
  { key: 'salon', number: '01', label: 'Salão', hint: 'Dados do negócio' },
  { key: 'admin', number: '02', label: 'Administrador', hint: 'Acesso principal' },
  { key: 'contract', number: '03', label: 'Contrato', hint: 'Plano e ciclo SaaS' },
  { key: 'modules', number: '04', label: 'Módulos', hint: 'Recursos contratados' },
  { key: 'review', number: '05', label: 'Revisão', hint: 'Provisionar tenant' }
];

function fieldClass(full = false) {
  return `nc-field${full ? ' nc-field-full' : ''}`;
}

function moduleEnabled(value, key) {
  return (value.enabledModules || []).includes(key);
}

function planLabel(plan) {
  const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(plan?.price || 0));
  return `${plan?.name || 'Plano'} — ${price}/mês`;
}

export function SaasProvisioningWizard({ value, setValue, modules, plans, saving, onSubmit }) {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const selectedCount = value.enabledModules?.length || 0;
  const currentStep = STEPS[step];
  const selectedPlan = plans.find((plan) => plan.id === value.planId);

  const stepValidity = useMemo(() => ({
    salon: Boolean(value.name.trim() && value.slug.trim() && value.phone.trim() && value.whatsapp.trim() && value.address.trim() && value.openingHours.trim()),
    admin: Boolean(value.adminName.trim() && /^\S+@\S+\.\S+$/.test(value.adminEmail.trim()) && value.adminPassword.length >= 12),
    contract: Boolean(value.planId && ['TRIAL', 'ACTIVE'].includes(value.subscriptionStatus)),
    modules: selectedCount > 0,
    review: true
  }), [value, selectedCount]);

  const completed = [stepValidity.salon, stepValidity.admin, stepValidity.contract, stepValidity.modules];
  const progress = Math.round(((completed.filter(Boolean).length + (step === 4 ? 1 : 0)) / 5) * 100);

  function patch(key, next) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  function patchSlug(next) {
    patch('slug', next.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, ''));
  }

  function toggleModule(key) {
    setValue((current) => {
      const active = new Set(current.enabledModules || []);
      if (active.has(key)) active.delete(key); else active.add(key);
      return { ...current, enabledModules: [...active] };
    });
  }

  function applyPreset(preset) {
    const next = preset.modules === 'ALL' ? modules.map((module) => module.key) : preset.modules;
    setValue((current) => ({ ...current, enabledModules: [...next] }));
  }

  function next() {
    if (!stepValidity[currentStep.key]) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function back() {
    setStep((current) => Math.max(current - 1, 0));
  }

  const previewUrl = value.slug ? `glossflow1.vercel.app/?salon=${value.slug}` : 'glossflow1.vercel.app/?salon=slug-do-cliente';

  return (
    <section className="nc-shell" aria-label="Provisionamento de novo cliente SaaS">
      <header className="nc-head">
        <div>
          <span className="eyebrow">Novo cliente SaaS</span>
          <h2>Provisionar salão completo</h2>
          <p>Crie tenant, ADMIN, contrato, módulos e preparação de billing em um único fluxo auditado.</p>
        </div>
        <span className="nc-badge">Sem edição manual no banco</span>
      </header>

      <nav className="nc-stepper" aria-label="Etapas do provisionamento">
        {STEPS.map((item, index) => {
          const done = index < 4 && completed[index];
          return (
            <button key={item.key} type="button" className={`nc-step ${step === index ? 'active' : ''} ${done ? 'done' : ''}`} onClick={() => setStep(index)}>
              <span className="nc-step-num">{done ? '✓' : item.number}</span>
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          );
        })}
      </nav>

      <div className="nc-layout">
        <form className="nc-card nc-main" onSubmit={onSubmit}>
          {step === 0 && (
            <div>
              <div className="nc-section-head"><span className="nc-section-icon">◆</span><div><h3>Informações do salão</h3><p>Dados públicos e identificação técnica do tenant.</p></div></div>
              <div className="nc-grid">
                <label className={fieldClass()}><span>Nome do salão *</span><input value={value.name} onChange={(event) => patch('name', event.target.value)} required /></label>
                <label className={fieldClass()}><span>Slug do cliente *</span><input value={value.slug} onChange={(event) => patchSlug(event.target.value)} placeholder="studio-bella" required /><small className="nc-help">Identificador único do tenant.</small></label>
                <label className={fieldClass()}><span>Telefone *</span><input value={value.phone} onChange={(event) => patch('phone', event.target.value)} required /></label>
                <label className={fieldClass()}><span>WhatsApp *</span><input value={value.whatsapp} onChange={(event) => patch('whatsapp', event.target.value)} required /></label>
                <label className={fieldClass()}><span>Instagram</span><input value={value.instagram} onChange={(event) => patch('instagram', event.target.value)} /></label>
                <label className={fieldClass()}><span>Horário de funcionamento *</span><input value={value.openingHours} onChange={(event) => patch('openingHours', event.target.value)} required /></label>
                <label className={fieldClass(true)}><span>Endereço *</span><input value={value.address} onChange={(event) => patch('address', event.target.value)} required /></label>
                <label className={fieldClass(true)}><span>Descrição</span><textarea value={value.description} onChange={(event) => patch('description', event.target.value)} /></label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="nc-section-head"><span className="nc-section-icon">◎</span><div><h3>Administrador principal</h3><p>Conta inicial do cliente, vinculada exclusivamente ao novo salonId.</p></div></div>
              <div className="nc-grid">
                <label className={fieldClass(true)}><span>Nome *</span><input value={value.adminName} onChange={(event) => patch('adminName', event.target.value)} required /></label>
                <label className={fieldClass()}><span>E-mail *</span><input type="email" value={value.adminEmail} onChange={(event) => patch('adminEmail', event.target.value.trim().toLowerCase())} required /></label>
                <label className={fieldClass()}><span>Senha inicial *</span><div className="nc-password"><input type={showPassword ? 'text' : 'password'} value={value.adminPassword} onChange={(event) => patch('adminPassword', event.target.value)} minLength={12} required /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div><small className="nc-help">Mínimo 12 caracteres. Trocas futuras revogam sessões ativas.</small></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="nc-section-head"><span className="nc-section-icon">◇</span><div><h3>Plano e ciclo de vida</h3><p>Defina como o novo cliente entra na plataforma. O servidor aplica as regras de transição.</p></div></div>
              <div className="nc-grid">
                <label className={fieldClass(true)}><span>Plano *</span><select value={value.planId} onChange={(event) => patch('planId', event.target.value)} required><option value="">Selecione um plano ativo</option>{plans.filter((plan) => plan.active !== false).map((plan) => <option value={plan.id} key={plan.id}>{planLabel(plan)}</option>)}</select></label>
                <label className={fieldClass()}><span>Status inicial *</span><select value={value.subscriptionStatus} onChange={(event) => patch('subscriptionStatus', event.target.value)}><option value="TRIAL">TRIAL</option><option value="ACTIVE">ACTIVE</option></select></label>
                <label className={fieldClass()}><span>Fim / vencimento</span><input type="date" value={value.subscriptionEndsAt} onChange={(event) => patch('subscriptionEndsAt', event.target.value)} /><small className="nc-help">Em TRIAL vazio, o backend aplica o prazo padrão. Em ACTIVE pode ficar vazio.</small></label>
                <label className={fieldClass()}><span>Billing</span><select value={value.billingProvider} onChange={(event) => patch('billingProvider', event.target.value)}><option value="MANUAL">Manual</option><option value="MERCADO_PAGO">Mercado Pago</option><option value="STRIPE">Stripe</option><option value="OTHER">Outro</option></select></label>
                <div className="nc-note nc-field-full">{selectedPlan ? <><strong>{selectedPlan.name}</strong> selecionado por {planLabel(selectedPlan)}. A referência real de cliente/assinatura do gateway pode ser preenchida depois no gerenciamento do tenant.</> : 'Selecione um plano para continuar.'}</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="nc-section-head"><span className="nc-section-icon">✦</span><div><h3>Módulos contratados</h3><p>Libere somente os recursos incluídos na proposta comercial deste cliente.</p></div></div>
              <div className="nc-presets">
                {PRESETS.map((preset) => <button className="nc-preset" type="button" key={preset.key} onClick={() => applyPreset(preset)}><strong>{preset.label}</strong><small>{preset.description}</small></button>)}
                <button className="nc-preset" type="button" onClick={() => patch('enabledModules', [])}><strong>Limpar</strong><small>Nenhum módulo</small></button>
              </div>
              <div className="nc-modules">
                {modules.map((module) => {
                  const enabled = moduleEnabled(value, module.key);
                  return (
                    <button key={module.key} className={`nc-module ${enabled ? 'on' : ''}`} type="button" onClick={() => toggleModule(module.key)} aria-pressed={enabled}>
                      <span className="nc-module-icon">{MODULE_ICONS[module.key] || '◇'}</span>
                      <span><strong>{module.label}</strong><small>{module.description}</small></span>
                      <span className="nc-toggle">✓</span>
                    </button>
                  );
                })}
              </div>
              {selectedCount === 0 && <p className="feedback error">Selecione ao menos um módulo.</p>}
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="nc-section-head"><span className="nc-section-icon">✓</span><div><h3>Revisar e provisionar</h3><p>Esta ação cria todas as relações comerciais necessárias e registra a trilha SaaS.</p></div></div>
              <div className="nc-review">
                <section className="nc-review-block"><h4>Tenant</h4><div className="nc-review-row"><span>Salão</span><strong>{value.name || '—'}</strong></div><div className="nc-review-row"><span>Slug</span><strong>{value.slug || '—'}</strong></div><div className="nc-review-row"><span>ADMIN</span><strong>{value.adminEmail || '—'}</strong></div></section>
                <section className="nc-review-block"><h4>Contrato</h4><div className="nc-review-row"><span>Plano</span><strong>{selectedPlan?.name || '—'}</strong></div><div className="nc-review-row"><span>Status</span><strong>{value.subscriptionStatus}</strong></div><div className="nc-review-row"><span>Billing</span><strong>{value.billingProvider}</strong></div></section>
                <section className="nc-review-block"><h4>Módulos</h4><div className="nc-chips">{modules.filter((module) => moduleEnabled(value, module.key)).map((module) => <span className="nc-chip" key={module.key}>{module.label}</span>)}</div></section>
              </div>
              <div className="nc-note">Se qualquer etapa interna falhar, o backend limpa o provisionamento parcial para não deixar tenant órfão.</div>
            </div>
          )}

          <footer className="nc-actions">
            <button className="secondary" type="button" onClick={back} disabled={step === 0}>← Voltar</button>
            <div className="nc-actions-right">
              {step < 4 && <button className={`primary nc-next ${!stepValidity[currentStep.key] ? 'nc-disabled' : ''}`} type="button" onClick={next} disabled={!stepValidity[currentStep.key]}>Continuar →</button>}
              {step === 4 && <button className="primary nc-next" type="submit" disabled={saving || !stepValidity.salon || !stepValidity.admin || !stepValidity.contract || !stepValidity.modules}>{saving ? 'Provisionando...' : 'Provisionar cliente SaaS'}</button>}
            </div>
          </footer>
        </form>

        <aside className="nc-card nc-summary">
          <div className="nc-summary-title"><strong>Resumo do contrato</strong><span className="nc-progress">{progress}%</span></div>
          <div className="nc-progressbar"><i style={{ width: `${progress}%` }} /></div>
          <div>
            <div className="nc-avatar">{(value.name || 'G').charAt(0).toUpperCase()}</div>
            <h3>{value.name || 'Novo salão'}</h3>
            <p>{previewUrl}</p>
            <div className="nc-summary-list">
              <div className="nc-summary-item"><span>Plano</span><strong>{selectedPlan?.name || 'Não definido'}</strong></div>
              <div className="nc-summary-item"><span>Status</span><strong>{value.subscriptionStatus}</strong></div>
              <div className="nc-summary-item"><span>Administrador</span><strong>{value.adminName || 'Não definido'}</strong></div>
              <div className="nc-summary-item"><span>Módulos</span><strong>{selectedCount}/{modules.length}</strong></div>
            </div>
            <div className="nc-note">Site & Marca e domínio continuam sob controle exclusivo do Super Admin após o provisionamento.</div>
          </div>
        </aside>
      </div>
    </section>
  );
}
