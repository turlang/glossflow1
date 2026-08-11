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
  { key: 'smart', label: 'Smart', description: 'Pacote da primeira cliente', modules: ['SITE', 'AGENDA', 'ESTOQUE', 'WHATSAPP', 'IA'] },
  { key: 'management', label: 'Gestão', description: 'Operação + financeiro', modules: ['SITE', 'AGENDA', 'ESTOQUE', 'CRM', 'FINANCEIRO'] },
  { key: 'complete', label: 'Completo', description: 'Todos os módulos', modules: 'ALL' }
];

const STEPS = [
  { key: 'salon', number: '01', label: 'Salão', hint: 'Dados do negócio' },
  { key: 'admin', number: '02', label: 'Administrador', hint: 'Acesso principal' },
  { key: 'modules', number: '03', label: 'Módulos', hint: 'Recursos contratados' },
  { key: 'review', number: '04', label: 'Revisão', hint: 'Conferir e criar' }
];

function fieldClass(full = false) {
  return `nc-field${full ? ' nc-field-full' : ''}`;
}

function moduleEnabled(value, key) {
  return (value.enabledModules || []).includes(key);
}

export function NewClientWizard({ value, setValue, modules, saving, onSubmit }) {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const selectedCount = value.enabledModules?.length || 0;
  const currentStep = STEPS[step];

  const stepValidity = useMemo(() => ({
    salon: Boolean(value.name.trim() && value.slug.trim() && value.phone.trim() && value.whatsapp.trim() && value.address.trim() && value.openingHours.trim()),
    admin: Boolean(value.adminName.trim() && /^\S+@\S+\.\S+$/.test(value.adminEmail.trim()) && value.adminPassword.length >= 12),
    modules: selectedCount > 0,
    review: true
  }), [value, selectedCount]);

  const completed = [stepValidity.salon, stepValidity.admin, stepValidity.modules];
  const progress = Math.round(((completed.filter(Boolean).length + (step === 3 ? 1 : 0)) / 4) * 100);

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
    <section className="nc-shell" aria-label="Cadastro de novo cliente">

      <header className="nc-head">
        <div>
          <span className="eyebrow">Novo cliente</span>
          <h2>Cadastrar salão</h2>
          <p>Crie o tenant, configure o administrador principal e libere somente os módulos contratados. O Site & Marca será finalizado depois pelo Super Admin.</p>
        </div>
        <span className="nc-badge">Tenant independente</span>
      </header>

      <nav className="nc-stepper" aria-label="Etapas do cadastro">
        {STEPS.map((item, index) => {
          const done = index < 3 && completed[index];
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
              <div className="nc-section-head"><span className="nc-section-icon">◆</span><div><h3>Informações do salão</h3><p>Dados públicos e identificação técnica do novo tenant.</p></div></div>
              <div className="nc-grid">
                <label className={fieldClass()}><span>Nome do salão *</span><input value={value.name} onChange={(event) => patch('name', event.target.value)} placeholder="Ex.: Studio Bella" required /></label>
                <label className={fieldClass()}><span>Slug do cliente *</span><input value={value.slug} onChange={(event) => patchSlug(event.target.value)} placeholder="studio-bella" required /><small className="nc-help">Usado para identificar o tenant e gerar a URL técnica.</small></label>
                <label className={fieldClass()}><span>Telefone *</span><input value={value.phone} onChange={(event) => patch('phone', event.target.value)} placeholder="(11) 3333-4444" required /></label>
                <label className={fieldClass()}><span>WhatsApp *</span><input value={value.whatsapp} onChange={(event) => patch('whatsapp', event.target.value)} placeholder="5511999999999" required /></label>
                <label className={fieldClass()}><span>Instagram</span><input value={value.instagram} onChange={(event) => patch('instagram', event.target.value)} placeholder="@studiobella" /></label>
                <label className={fieldClass()}><span>Horário de funcionamento *</span><input value={value.openingHours} onChange={(event) => patch('openingHours', event.target.value)} required /></label>
                <label className={fieldClass(true)}><span>Endereço *</span><input value={value.address} onChange={(event) => patch('address', event.target.value)} placeholder="Rua, número, bairro, cidade/UF" required /></label>
                <label className={fieldClass(true)}><span>Descrição do negócio</span><textarea value={value.description} onChange={(event) => patch('description', event.target.value)} placeholder="Resumo do posicionamento, serviços e diferenciais do salão." /></label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="nc-section-head"><span className="nc-section-icon">◎</span><div><h3>Administrador do salão</h3><p>Essa será a conta principal do cliente. Ela verá apenas o próprio salão e os módulos liberados.</p></div></div>
              <div className="nc-grid">
                <label className={fieldClass(true)}><span>Nome do administrador *</span><input value={value.adminName} onChange={(event) => patch('adminName', event.target.value)} placeholder="Nome do responsável" required /></label>
                <label className={fieldClass()}><span>E-mail de acesso *</span><input type="email" value={value.adminEmail} onChange={(event) => patch('adminEmail', event.target.value.trim().toLowerCase())} placeholder="admin@salao.com.br" required /></label>
                <label className={fieldClass()}><span>Senha inicial *</span><div className="nc-password"><input type={showPassword ? 'text' : 'password'} value={value.adminPassword} onChange={(event) => patch('adminPassword', event.target.value)} placeholder="Mínimo 12 caracteres" minLength={12} required /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div><small className="nc-help">O Super Admin poderá redefinir essa senha depois. Ela não será exibida novamente após o cadastro.</small></label>
              </div>
              <div className="nc-note">O usuário criado receberá a função <strong>ADMIN</strong> e será vinculado exclusivamente ao novo <strong>salonId</strong>. Ele não terá acesso ao Super Admin.</div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="nc-section-head"><span className="nc-section-icon">✦</span><div><h3>Módulos contratados</h3><p>Escolha os recursos que ficarão disponíveis para este salão. Você pode alterar essa configuração a qualquer momento.</p></div></div>
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
              {selectedCount === 0 && <p className="feedback error" style={{ marginTop: 14 }}>Selecione ao menos um módulo para continuar.</p>}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="nc-section-head"><span className="nc-section-icon">✓</span><div><h3>Revisar cadastro</h3><p>Confira os dados antes de criar o tenant e o primeiro acesso administrativo.</p></div></div>
              <div className="nc-review">
                <section className="nc-review-block"><h4>Salão</h4><div className="nc-review-row"><span>Nome</span><strong>{value.name || '—'}</strong></div><div className="nc-review-row"><span>Slug</span><strong>{value.slug || '—'}</strong></div><div className="nc-review-row"><span>WhatsApp</span><strong>{value.whatsapp || '—'}</strong></div><div className="nc-review-row"><span>Endereço</span><strong>{value.address || '—'}</strong></div></section>
                <section className="nc-review-block"><h4>Acesso do cliente</h4><div className="nc-review-row"><span>Administrador</span><strong>{value.adminName || '—'}</strong></div><div className="nc-review-row"><span>E-mail</span><strong>{value.adminEmail || '—'}</strong></div><div className="nc-review-row"><span>Senha</span><strong>{value.adminPassword ? '••••••••••••' : '—'}</strong></div></section>
                <section className="nc-review-block"><h4>Módulos liberados</h4><div className="nc-chips">{modules.filter((module) => moduleEnabled(value, module.key)).map((module) => <span className="nc-chip" key={module.key}>{module.label}</span>)}</div></section>
              </div>
              <div className="nc-note">Ao finalizar, o GlossFlow cria o tenant e o primeiro ADMIN. Depois você pode configurar <strong>Site & Marca</strong>, plano, assinatura e integrações no próprio Super Admin.</div>
            </div>
          )}

          <footer className="nc-actions">
            <button className="secondary" type="button" onClick={back} disabled={step === 0}>← Voltar</button>
            <div className="nc-actions-right">
              {step < 3 && <button className={`primary nc-next ${!stepValidity[currentStep.key] ? 'nc-disabled' : ''}`} type="button" onClick={next} disabled={!stepValidity[currentStep.key]}>Continuar →</button>}
              {step === 3 && <button className="primary nc-next" type="submit" disabled={saving || !stepValidity.salon || !stepValidity.admin || !stepValidity.modules}>{saving ? 'Criando cliente...' : 'Criar salão e acesso'}</button>}
            </div>
          </footer>
        </form>

        <aside className="nc-card nc-summary">
          <div className="nc-summary-title"><strong>Resumo do cliente</strong><span className="nc-progress">{progress}%</span></div>
          <div className="nc-progressbar"><i style={{ width: `${progress}%` }} /></div>
          <div>
            <div className="nc-avatar">{(value.name || 'G').charAt(0).toUpperCase()}</div>
            <h3>{value.name || 'Novo salão'}</h3>
            <p>{previewUrl}</p>
            <div className="nc-summary-list">
              <div className="nc-summary-item"><span>Administrador</span><strong>{value.adminName || 'Não definido'}</strong></div>
              <div className="nc-summary-item"><span>E-mail</span><strong>{value.adminEmail || 'Não definido'}</strong></div>
              <div className="nc-summary-item"><span>WhatsApp</span><strong>{value.whatsapp || 'Não definido'}</strong></div>
              <div className="nc-summary-item"><span>Módulos</span><strong>{selectedCount}/{modules.length}</strong></div>
            </div>
            <div className="nc-summary-modules">
              <div className="nc-summary-modules-head"><span>Recursos ativos</span><strong>{selectedCount}</strong></div>
              <div className="nc-chips">{modules.filter((module) => moduleEnabled(value, module.key)).map((module) => <span className="nc-chip" key={module.key}>{module.label}</span>)}</div>
            </div>
            <div className="nc-note">Site & Marca é gerenciado pelo Super Admin depois da criação. O cliente não poderá alterar a identidade white-label.</div>
          </div>
        </aside>
      </div>
    </section>
  );
}
