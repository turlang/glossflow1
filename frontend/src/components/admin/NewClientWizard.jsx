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
      <style>{`
        .nc-shell{--nc-border:rgba(148,163,184,.17);--nc-soft:rgba(255,255,255,.035);--nc-gold:#f4d37d;--nc-purple:#aa7cf2;display:grid;gap:18px}
        .nc-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:4px 2px 10px}
        .nc-head h2{font-size:clamp(24px,2.2vw,34px);margin:4px 0 6px;letter-spacing:-.035em}.nc-head p{max-width:720px;margin:0;color:var(--muted);line-height:1.55}
        .nc-badge{padding:8px 12px;border:1px solid rgba(244,211,125,.22);border-radius:999px;background:rgba(244,211,125,.07);color:var(--nc-gold);font-size:12px;font-weight:900;white-space:nowrap}
        .nc-stepper{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:8px;border:1px solid var(--nc-border);border-radius:20px;background:rgba(7,11,20,.34)}
        .nc-step{border:0;background:transparent;color:var(--muted);display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;text-align:left;transition:.18s ease}.nc-step:hover{background:rgba(255,255,255,.04)}
        .nc-step.active{background:linear-gradient(135deg,rgba(244,211,125,.14),rgba(170,124,242,.12));color:var(--text);box-shadow:inset 0 0 0 1px rgba(244,211,125,.22)}
        .nc-step.done .nc-step-num{background:rgba(52,211,153,.13);border-color:rgba(52,211,153,.35);color:#6ee7b7}.nc-step-num{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--nc-border);border-radius:11px;font-size:11px;font-weight:950;color:var(--nc-gold);flex:none}.nc-step strong,.nc-step small{display:block}.nc-step small{font-size:10px;color:var(--muted);margin-top:2px}
        .nc-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}
        .nc-card{border:1px solid var(--nc-border);border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.018));box-shadow:0 22px 70px rgba(0,0,0,.13)}
        .nc-main{padding:22px}.nc-summary{padding:18px;position:sticky;top:88px}.nc-section-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:20px}.nc-section-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,rgba(244,211,125,.18),rgba(170,124,242,.16));border:1px solid rgba(244,211,125,.2);font-weight:950;color:var(--nc-gold)}
        .nc-section-head h3{margin:0 0 4px;font-size:20px}.nc-section-head p{margin:0;color:var(--muted);font-size:13px;line-height:1.45}
        .nc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.nc-field{display:grid;gap:7px}.nc-field-full{grid-column:1/-1}.nc-field>span{font-size:12px;font-weight:850;color:var(--text)}
        .nc-field input,.nc-field textarea{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.22);background:rgba(9,14,25,.58);color:var(--text);border-radius:13px;padding:12px 13px;outline:none;transition:.16s ease;font:inherit}.nc-field textarea{min-height:100px;resize:vertical}.nc-field input:focus,.nc-field textarea:focus{border-color:rgba(244,211,125,.62);box-shadow:0 0 0 3px rgba(244,211,125,.08)}
        .nc-help{font-size:10px;color:var(--muted);line-height:1.4}.nc-password{position:relative}.nc-password input{padding-right:74px}.nc-password button{position:absolute;right:7px;top:7px;border:0;background:rgba(255,255,255,.06);color:var(--muted);border-radius:9px;padding:6px 8px;font-size:10px}
        .nc-presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.nc-preset{border:1px solid var(--nc-border);background:rgba(255,255,255,.025);color:var(--text);border-radius:12px;padding:8px 11px;text-align:left}.nc-preset strong{display:block;font-size:11px}.nc-preset small{font-size:9px;color:var(--muted)}
        .nc-modules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.nc-module{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr) 22px;gap:10px;align-items:center;padding:12px;border:1px solid var(--nc-border);border-radius:15px;background:rgba(255,255,255,.022);cursor:pointer;transition:.16s ease}.nc-module:hover{transform:translateY(-1px);border-color:rgba(244,211,125,.28)}.nc-module.on{background:linear-gradient(135deg,rgba(52,211,153,.08),rgba(244,211,125,.055));border-color:rgba(52,211,153,.33)}
        .nc-module-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.055);font-weight:950;color:var(--nc-gold);font-size:12px}.nc-module strong{display:block;font-size:12px}.nc-module small{display:block;margin-top:2px;color:var(--muted);font-size:9px;line-height:1.3}.nc-toggle{width:22px;height:22px;border:1px solid var(--nc-border);border-radius:8px;display:grid;place-items:center;font-size:12px;color:transparent}.nc-module.on .nc-toggle{background:#34d399;border-color:#34d399;color:#06120d}
        .nc-review{display:grid;gap:12px}.nc-review-block{border:1px solid var(--nc-border);border-radius:16px;background:rgba(255,255,255,.022);padding:14px}.nc-review-block h4{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--nc-gold)}.nc-review-row{display:flex;justify-content:space-between;gap:18px;padding:5px 0;font-size:12px}.nc-review-row span{color:var(--muted)}.nc-review-row strong{text-align:right;overflow-wrap:anywhere}
        .nc-chips{display:flex;gap:6px;flex-wrap:wrap}.nc-chip{padding:5px 8px;border-radius:999px;background:rgba(52,211,153,.09);border:1px solid rgba(52,211,153,.18);font-size:9px;font-weight:850;color:#a7f3d0}
        .nc-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:20px;padding-top:18px;border-top:1px solid var(--nc-border)}.nc-actions-right{display:flex;gap:8px}.nc-actions button{min-height:42px}.nc-next{min-width:150px}.nc-disabled{opacity:.52;cursor:not-allowed!important}
        .nc-summary-title{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:14px;border-bottom:1px solid var(--nc-border)}.nc-summary-title strong{font-size:14px}.nc-progress{font-size:10px;color:var(--nc-gold);font-weight:900}.nc-progressbar{height:5px;background:rgba(255,255,255,.05);border-radius:999px;overflow:hidden;margin:12px 0 18px}.nc-progressbar i{display:block;height:100%;background:linear-gradient(90deg,var(--nc-gold),var(--nc-purple));border-radius:999px;transition:width .2s ease}
        .nc-avatar{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:linear-gradient(135deg,var(--nc-gold),var(--nc-purple));color:#0b1020;font-size:20px;font-weight:950;margin-bottom:12px}.nc-summary h3{margin:0 0 3px;font-size:17px}.nc-summary>p{color:var(--muted);font-size:11px;overflow-wrap:anywhere;margin:0 0 16px}.nc-summary-list{display:grid;gap:9px}.nc-summary-item{display:flex;justify-content:space-between;gap:12px;font-size:11px}.nc-summary-item span{color:var(--muted)}.nc-summary-item strong{text-align:right}.nc-summary-modules{margin-top:16px;padding-top:14px;border-top:1px solid var(--nc-border)}.nc-summary-modules-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-size:11px}.nc-note{margin-top:15px;padding:11px;border-radius:13px;background:rgba(244,211,125,.06);border:1px solid rgba(244,211,125,.15);color:var(--muted);font-size:10px;line-height:1.45}
        @media(max-width:1100px){.nc-layout{grid-template-columns:1fr}.nc-summary{position:static;display:grid;grid-template-columns:auto 1fr;gap:18px}.nc-summary-title,.nc-progressbar{grid-column:1/-1}.nc-modules{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:720px){.nc-head{align-items:flex-start;flex-direction:column}.nc-stepper{grid-template-columns:repeat(2,minmax(0,1fr))}.nc-layout{display:block}.nc-main{padding:16px}.nc-summary{margin-top:14px;display:block}.nc-grid,.nc-modules{grid-template-columns:1fr}.nc-actions{align-items:stretch;flex-direction:column}.nc-actions-right{display:grid;grid-template-columns:1fr 1fr}.nc-actions-right button{width:100%}.nc-step small{display:none}}
      `}</style>

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
