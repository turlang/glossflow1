import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const providerLabels = {
  META: 'Meta / WhatsApp',
  AI: 'Inteligência Artificial',
  OTHER: 'Outros'
};

export function ExternalCostControl({ salon }) {
  const [period, setPeriod] = useState(currentPeriod());
  const [snapshot, setSnapshot] = useState(null);
  const [policy, setPolicy] = useState({ monthlyLimitBr: 100, warningPercent: 80, domainMonthlyBr: 0 });
  const [entry, setEntry] = useState({ provider: 'META', amountBr: '', description: '' });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function load(nextPeriod = period) {
    setBusy('load');
    setMessage('');
    try {
      const data = await request(`/platform-admin/salons/${salon.id}/external-costs?period=${nextPeriod}`);
      setSnapshot(data);
      setPolicy(data.policy);
    } catch (err) {
      setMessage(err.message || 'Não foi possível carregar o controle de custos.');
    } finally {
      setBusy('');
    }
  }

  useEffect(() => { load(period); }, [salon.id, period]);

  const status = useMemo(() => {
    const key = snapshot?.costs?.status || 'OK';
    if (key === 'REVIEW') return { label: 'Revisar plano', tone: 'danger' };
    if (key === 'WARNING') return { label: 'Atenção', tone: 'warn' };
    return { label: 'Dentro do plano', tone: 'ok' };
  }, [snapshot]);

  async function savePolicy(event) {
    event.preventDefault();
    setBusy('policy');
    try {
      await request(`/platform-admin/salons/${salon.id}/external-cost-policy`, {
        method: 'PUT',
        body: JSON.stringify(policy)
      });
      setMessage('Política de uso justo atualizada.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Não foi possível salvar a política.');
    } finally {
      setBusy('');
    }
  }

  async function addEntry(event) {
    event.preventDefault();
    setBusy('entry');
    try {
      await request(`/platform-admin/salons/${salon.id}/external-costs`, {
        method: 'POST',
        body: JSON.stringify({ ...entry, amountBr: Number(entry.amountBr), periodKey: period })
      });
      setEntry({ provider: 'META', amountBr: '', description: '' });
      setMessage('Custo externo registrado.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Não foi possível registrar o custo.');
    } finally {
      setBusy('');
    }
  }

  async function removeEntry(id) {
    if (!window.confirm('Remover este lançamento de custo?')) return;
    setBusy(`delete-${id}`);
    try {
      await request(`/platform-admin/salons/${salon.id}/external-costs/${id}`, { method: 'DELETE' });
      setMessage('Lançamento removido.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Não foi possível remover o lançamento.');
    } finally {
      setBusy('');
    }
  }

  const percentage = Math.min(100, Math.max(0, Number(snapshot?.costs?.usagePercent || 0)));

  return (
    <section className="ecc-shell" aria-label={`Controle de custos externos de ${salon.name}`}>
      <style>{`
        .ecc-shell{display:grid;gap:14px;padding:18px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02))}
        .ecc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}.ecc-head h3{margin:4px 0;color:var(--strong);font-size:1.12rem}.ecc-head p{margin:0;color:var(--muted);font-size:.8rem;line-height:1.45;max-width:720px}.ecc-period{display:grid;gap:5px}.ecc-period span,.ecc-field span{font-size:.68rem;color:var(--muted);font-weight:900;text-transform:uppercase;letter-spacing:.06em}.ecc-period input,.ecc-field input,.ecc-field select{min-height:40px;border:1px solid var(--line);border-radius:12px;padding:0 11px;background:rgba(0,0,0,.16);color:var(--text)}
        .ecc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ecc-kpi{padding:13px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--line)}.ecc-kpi small{display:block;color:var(--muted);font-size:.68rem}.ecc-kpi strong{display:block;margin-top:4px;color:var(--strong);font-size:1.08rem}.ecc-kpi em{font-style:normal;font-size:.68rem;color:var(--muted)}
        .ecc-progress-card{padding:14px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.035)}.ecc-progress-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.ecc-progress-row strong{font-size:.85rem}.ecc-badge{padding:5px 9px;border-radius:999px;font-size:.64rem;font-weight:950}.ecc-badge.ok{background:rgba(52,211,153,.1);color:#86efac;border:1px solid rgba(52,211,153,.18)}.ecc-badge.warn{background:rgba(251,191,36,.1);color:#fde68a;border:1px solid rgba(251,191,36,.18)}.ecc-badge.danger{background:rgba(251,113,133,.1);color:#fecdd3;border:1px solid rgba(251,113,133,.18)}.ecc-bar{height:9px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:10px 0 6px}.ecc-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--gold),var(--primary))}.ecc-progress-card small{color:var(--muted);font-size:.7rem}
        .ecc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ecc-panel{padding:14px;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.03)}.ecc-panel h4{margin:0 0 10px;color:var(--strong);font-size:.9rem}.ecc-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ecc-field{display:grid;gap:5px}.ecc-field.full{grid-column:1/-1}.ecc-actions{grid-column:1/-1;display:flex;justify-content:flex-end}.ecc-actions button{min-width:145px}
        .ecc-list{display:grid;gap:7px}.ecc-entry{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.ecc-entry strong{display:block;font-size:.78rem}.ecc-entry small{display:block;color:var(--muted);font-size:.66rem}.ecc-entry b{font-size:.78rem}.ecc-entry button{width:30px;height:30px;border-radius:9px;background:rgba(251,113,133,.08);color:#fda4af;border:1px solid rgba(251,113,133,.16)}
        .ecc-note{padding:10px 12px;border-radius:13px;background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.15);color:var(--muted);font-size:.72rem;line-height:1.45}.ecc-message{font-size:.74rem;color:var(--gold-2)}
        @media(max-width:900px){.ecc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ecc-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.ecc-shell{padding:13px}.ecc-kpis{grid-template-columns:1fr}.ecc-form{grid-template-columns:1fr}.ecc-field.full,.ecc-actions{grid-column:1}.ecc-entry{grid-template-columns:1fr auto}.ecc-entry button{grid-column:2}.ecc-actions button{width:100%}}
      `}</style>

      <header className="ecc-head">
        <div>
          <span className="eyebrow">Uso justo - custos incluídos</span>
          <h3>Meta + IA + domínio dentro da mensalidade</h3>
          <p>O limite é gerencial, não bloqueia o atendimento. Ao atingir 80% o sistema sinaliza atenção; em 100% recomenda revisão comercial para o próximo ciclo.</p>
        </div>
        <label className="ecc-period"><span>Competência</span><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      </header>

      {snapshot && (
        <>
          <div className="ecc-kpis">
            <article className="ecc-kpi"><small>Custo registrado</small><strong>{money(snapshot.costs.totalBr)}</strong><em>Inclui domínio fixo</em></article>
            <article className="ecc-kpi"><small>Franquia interna</small><strong>{money(snapshot.policy.monthlyLimitBr)}</strong><em>Uso justo mensal</em></article>
            <article className="ecc-kpi"><small>Saldo de segurança</small><strong>{money(snapshot.costs.remainingBr)}</strong><em>Antes da revisão</em></article>
            <article className="ecc-kpi"><small>WhatsApp no mês</small><strong>{snapshot.usage.whatsappOutboundMessages}</strong><em>{snapshot.usage.whatsappInboundMessages} recebidas</em></article>
          </div>

          <div className="ecc-progress-card">
            <div className="ecc-progress-row"><strong>{snapshot.costs.usagePercent}% da franquia utilizada</strong><span className={`ecc-badge ${status.tone}`}>{status.label}</span></div>
            <div className="ecc-bar"><span style={{ width: `${percentage}%` }} /></div>
            <small>Não há corte automático. Acima do limite, o Super Admin avalia ajuste de plano ou política de uso no mês seguinte.</small>
          </div>

          <div className="ecc-grid">
            <form className="ecc-panel" onSubmit={savePolicy}>
              <h4>Política do cliente</h4>
              <div className="ecc-form">
                <label className="ecc-field"><span>Franquia mensal (R$)</span><input type="number" min="0" step="0.01" value={policy.monthlyLimitBr} onChange={(event) => setPolicy((current) => ({ ...current, monthlyLimitBr: event.target.value }))} /></label>
                <label className="ecc-field"><span>Alerta (%)</span><input type="number" min="1" max="100" value={policy.warningPercent} onChange={(event) => setPolicy((current) => ({ ...current, warningPercent: event.target.value }))} /></label>
                <label className="ecc-field full"><span>Domínio mensalizado (R$)</span><input type="number" min="0" step="0.01" value={policy.domainMonthlyBr} onChange={(event) => setPolicy((current) => ({ ...current, domainMonthlyBr: event.target.value }))} /></label>
                <div className="ecc-actions"><button className="primary" disabled={busy === 'policy'}>{busy === 'policy' ? 'Salvando...' : 'Salvar política'}</button></div>
              </div>
            </form>

            <form className="ecc-panel" onSubmit={addEntry}>
              <h4>Registrar custo variável</h4>
              <div className="ecc-form">
                <label className="ecc-field"><span>Fornecedor</span><select value={entry.provider} onChange={(event) => setEntry((current) => ({ ...current, provider: event.target.value }))}><option value="META">Meta / WhatsApp</option><option value="AI">Inteligência Artificial</option><option value="OTHER">Outros</option></select></label>
                <label className="ecc-field"><span>Valor (R$)</span><input required type="number" min="0" step="0.01" value={entry.amountBr} onChange={(event) => setEntry((current) => ({ ...current, amountBr: event.target.value }))} /></label>
                <label className="ecc-field full"><span>Descrição</span><input required placeholder="Ex.: consumo Meta da competência" value={entry.description} onChange={(event) => setEntry((current) => ({ ...current, description: event.target.value }))} /></label>
                <div className="ecc-actions"><button className="secondary" disabled={busy === 'entry'}>{busy === 'entry' ? 'Registrando...' : 'Registrar custo'}</button></div>
              </div>
            </form>
          </div>

          <div className="ecc-panel">
            <h4>Composição do mês</h4>
            <div className="ecc-kpis">
              <article className="ecc-kpi"><small>Meta / WhatsApp</small><strong>{money(snapshot.costs.metaBr)}</strong></article>
              <article className="ecc-kpi"><small>IA</small><strong>{money(snapshot.costs.aiBr)}</strong></article>
              <article className="ecc-kpi"><small>Domínio</small><strong>{money(snapshot.costs.domainBr)}</strong></article>
              <article className="ecc-kpi"><small>Outros</small><strong>{money(snapshot.costs.otherBr)}</strong></article>
            </div>
            <div className="ecc-list" style={{ marginTop: 10 }}>
              {(snapshot.entries || []).map((item) => (
                <div className="ecc-entry" key={item.id}>
                  <div><strong>{providerLabels[item.provider] || item.provider}</strong><small>{item.description || 'Sem descrição'}</small></div>
                  <b>{money(item.amountBr)}</b>
                  <button type="button" title="Remover lançamento" disabled={busy === `delete-${item.id}`} onClick={() => removeEntry(item.id)}>×</button>
                </div>
              ))}
              {(snapshot.entries || []).length === 0 && <div className="ecc-note">Nenhum custo variável lançado nesta competência. Registre os valores efetivos ou estimados de Meta e IA conforme forem aparecendo.</div>}
            </div>
          </div>
        </>
      )}

      {!snapshot && busy === 'load' && <div className="ecc-note">Carregando controle mensal...</div>}
      {message && <div className="ecc-message">{message}</div>}
    </section>
  );
}
