import React, { useEffect, useState } from 'react';
import { request } from '../../services/api.js';
import { Input, Select, Textarea } from '../ui/Forms.jsx';

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function SecurityAdmin({ clients }) {
  const [overview, setOverview] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [retention, setRetention] = useState(null);
  const [message, setMessage] = useState('');
  const [privacyClientId, setPrivacyClientId] = useState('');
  const [eraseReason, setEraseReason] = useState('');
  const [consent, setConsent] = useState({ clientId: '', type: 'MARKETING_WHATSAPP', granted: true, evidence: 'Consentimento registrado pelo painel administrativo.' });

  async function loadSecurity() {
    const [overviewData, logsData, sessionsData, retentionData] = await Promise.all([
      request('/admin/security/overview'),
      request('/admin/security/audit-logs'),
      request('/admin/security/sessions'),
      request('/admin/security/retention/preview')
    ]);
    setOverview(overviewData);
    setAuditLogs(logsData);
    setSessions(sessionsData);
    setRetention(retentionData);
  }

  useEffect(() => { loadSecurity().catch((error) => setMessage(error.message)); }, []);

  async function createBackup() {
    const backup = await request('/admin/security/backups', { method: 'POST', body: JSON.stringify({}) });
    if (backup.snapshot) {
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`glossflow-backup-${date}.json`, backup.snapshot);
    }
    setMessage(`Backup assinado criado: ${backup.summary}`);
    await loadSecurity();
  }

  async function revokeSession(id) {
    await request(`/admin/security/sessions/${id}/revoke`, { method: 'POST', body: JSON.stringify({}) });
    setMessage('Sessão encerrada. O access token vinculado deixa de ser aceito pelo servidor.');
    await loadSecurity();
  }

  async function revokeOtherSessions() {
    if (!window.confirm('Encerrar todas as outras sessões administrativas deste salão?')) return;
    const result = await request('/admin/security/sessions/revoke-all', {
      method: 'POST',
      body: JSON.stringify({ includeCurrent: false })
    });
    setMessage(`${result.count || 0} sessão(ões) encerrada(s).`);
    await loadSecurity();
  }

  async function exportPersonalData() {
    if (!privacyClientId) return setMessage('Selecione um cliente para exportar os dados LGPD.');
    const data = await request(`/admin/security/lgpd/export/${privacyClientId}`);
    downloadJson(`glossflow-lgpd-${privacyClientId}.json`, data);
    setMessage('Pacote LGPD exportado em JSON. Trate o arquivo como dado pessoal sensível.');
  }

  async function erasePersonalData() {
    if (!privacyClientId) return setMessage('Selecione um cliente para a eliminação LGPD.');
    if (eraseReason.trim().length < 10) return setMessage('Informe um motivo com pelo menos 10 caracteres.');
    const confirmation = window.prompt('Esta ação remove o perfil e anonimiza o histórico. Digite EXCLUIR DADOS para continuar.');
    if (confirmation !== 'EXCLUIR DADOS') return setMessage('Eliminação cancelada: confirmação não informada.');

    const result = await request(`/admin/security/lgpd/erase/${privacyClientId}`, {
      method: 'POST',
      body: JSON.stringify({ confirmation, reason: eraseReason.trim() })
    });
    setMessage(`Dados eliminados. ${result.appointmentsAnonymized || 0} atendimento(s) preservado(s) sem PII e ${result.auditEventsRedacted || 0} evento(s) redigido(s). Atualize o cadastro de clientes.`);
    setPrivacyClientId('');
    setEraseReason('');
    await loadSecurity();
  }

  async function applyRetention() {
    const candidates = retention?.candidates;
    const total = candidates
      ? Object.values(candidates).reduce((sum, value) => sum + Number(value || 0), 0)
      : 0;
    const confirmation = window.prompt(`A prévia encontrou ${total} registro(s)/evento(s) elegíveis. Digite APLICAR RETENCAO para executar.`);
    if (confirmation !== 'APLICAR RETENCAO') return setMessage('Rotina de retenção cancelada.');
    const result = await request('/admin/security/retention/run', {
      method: 'POST',
      body: JSON.stringify({ confirmation })
    });
    setMessage(`Retenção aplicada: ${result.sessionsDeleted || 0} sessões removidas, ${result.whatsappEventsRedacted || 0} eventos WhatsApp redigidos e ${result.auditLogsDeleted || 0} logs vencidos removidos.`);
    await loadSecurity();
  }

  async function saveConsent(event) {
    event.preventDefault();
    await request('/admin/security/lgpd/consents', { method: 'POST', body: JSON.stringify(consent) });
    setMessage('Consentimento LGPD registrado com sucesso.');
    await loadSecurity();
  }

  const privacyOptions = clients.map((client) => ({ value: client.id, label: `${client.name} • ${client.phone}` }));
  const retentionCandidates = retention?.candidates || {};

  return (
    <section className="security-center">
      <div className="panel-card security-hero full-span"><div><span className="eyebrow">Segurança corporativa</span><h2>Auditoria, sessões, LGPD, retenção e recuperação</h2></div><div className="security-score"><strong>{overview?.score || 0}</strong><span>score</span></div></div>
      {message && <p className="feedback full-span" role="status">{message}</p>}
      <div className="security-grid full-span">{(overview?.controls || []).map((control) => <article className="security-control" key={control.name}><span>{control.status}</span><strong>{control.name}</strong><p>{control.description}</p></article>)}</div>

      <section className="panel-card full-span">
        <div className="section-inline-head"><div><span className="eyebrow">Recuperação</span><h2>Backup lógico assinado</h2></div><button className="primary" type="button" onClick={createBackup}>Criar e baixar backup</button></div>
        <p className="panel-help">O arquivo contém dados operacionais do tenant e deve ser guardado em local seguro. Usuários, senhas, sessões, assinatura SaaS, domínio e auditoria não fazem parte do snapshot.</p>
        <small>Restore na API: {overview?.restoreEnabled ? 'habilitado temporariamente' : 'bloqueado por padrão'}</small>
      </section>

      <section className="panel-card full-span">
        <div className="section-inline-head"><div><span className="eyebrow">Retenção</span><h2>Prévia da política de dados</h2></div><button className="secondary" type="button" onClick={applyRetention}>Aplicar retenção</button></div>
        <div className="security-grid">
          <article className="security-control"><strong>{retentionCandidates.sessionsToDelete || 0}</strong><p>Sessões expiradas/revogadas a remover</p></article>
          <article className="security-control"><strong>{retentionCandidates.whatsappEventsToRedact || 0}</strong><p>Eventos WhatsApp com conteúdo a redigir</p></article>
          <article className="security-control"><strong>{retentionCandidates.auditLogsToDelete || 0}</strong><p>Logs além da janela de auditoria</p></article>
          <article className="security-control"><strong>{retentionCandidates.backupMetadataToDelete || 0}</strong><p>Metadados antigos de backup</p></article>
        </div>
      </section>

      <section className="panel-card form-grid full-span">
        <h2>Direitos do titular — LGPD</h2>
        <Select label="Cliente" value={privacyClientId} onChange={setPrivacyClientId} options={privacyOptions} />
        <Textarea label="Motivo da eliminação" value={eraseReason} onChange={setEraseReason} placeholder="Ex.: solicitação formal do titular recebida em 12/08/2026." />
        <div className="form-actions full">
          <button className="secondary" type="button" onClick={exportPersonalData}>Exportar dados</button>
          <button className="danger-button" type="button" onClick={erasePersonalData}>Eliminar dados pessoais</button>
        </div>
        <p className="panel-help full">A eliminação apaga perfil/fila/fidelidade/consentimentos, anonimiza PII de atendimentos históricos e redige eventos relacionados. Não use para corrigir cadastro.</p>
      </section>

      <form className="panel-card form-grid full-span" onSubmit={saveConsent}>
        <h2>Consentimento LGPD</h2>
        <Select label="Cliente" value={consent.clientId} onChange={(clientId) => setConsent((current) => ({ ...current, clientId }))} options={privacyOptions} />
        <Input label="Tipo de consentimento" value={consent.type} onChange={(type) => setConsent((current) => ({ ...current, type }))} required />
        <Textarea label="Evidência" value={consent.evidence} onChange={(evidence) => setConsent((current) => ({ ...current, evidence }))} />
        <button className="primary full" type="submit">Registrar consentimento</button>
      </form>

      <section className="panel-card full-span">
        <div className="section-inline-head"><h2>Sessões administrativas</h2><button className="danger-button" type="button" onClick={revokeOtherSessions}>Encerrar outras sessões</button></div>
        <div className="list">{sessions.map((session) => <div className="list-row" key={session.id}><div><strong>{session.user?.name || 'Usuário'}</strong><span>{session.ip || 'IP não informado'} • {session.revokedAt ? 'Revogada' : 'Ativa'}</span></div><button className="danger-button" type="button" onClick={() => revokeSession(session.id)} disabled={Boolean(session.revokedAt)}>Encerrar sessão</button></div>)}</div>
      </section>
      <section className="panel-card full-span"><h2>Auditoria recente</h2><div className="audit-table">{auditLogs.slice(0, 30).map((log) => <article key={log.id}><strong>{log.action} • {log.resource}</strong><span>{log.path}</span><small>{new Date(log.createdAt).toLocaleString('pt-BR')} • {log.ip}</small></article>)}</div></section>
    </section>
  );
}

export function EcosystemAdmin() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  async function load() { setData(await request('/admin/ecosystem/integrations')); }
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

  async function testIntegration(key) {
    const result = await request(`/admin/ecosystem/integrations/${key}/test`, { method: 'POST', body: JSON.stringify({}) });
    setMessage(result.message);
  }

  return (
    <section className="ecosystem-center">
      <div className="panel-card ecosystem-hero full-span"><div><span className="eyebrow">Ecossistema conectado</span><h2>Integrações do SaaS</h2></div><div className="ecosystem-score"><strong>{data?.connected || 0}/{data?.total || 0}</strong><span>conectadas</span></div></div>
      {message && <p className="feedback full-span">{message}</p>}
      <div className="integration-grid full-span">{(data?.integrations || []).map((integration) => <article className={`integration-card ${integration.status}`} key={integration.key}><div><span>{integration.category}</span><strong>{integration.name}</strong><p>{integration.description}</p><small>Variável: {integration.env}</small></div><footer><b>{integration.status === 'connected' ? 'Conectado' : 'Pronto para conectar'}</b><button className="ghost-button" type="button" onClick={() => testIntegration(integration.key)}>Testar</button></footer></article>)}</div>
    </section>
  );
}

export function ObservabilityAdmin() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  async function load() { setData(await request('/admin/observability/overview')); }
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

  return (
    <section className="observability-center">
      <div className="panel-card observability-hero full-span"><div><span className="eyebrow">Observabilidade</span><h2>Saúde e rastreabilidade</h2></div><div className="observability-score"><strong>{data?.healthScore || 0}</strong><span>health score</span></div></div>
      {message && <p className="feedback full-span">{message}</p>}
      <div className="observability-kpis full-span">
        <article><strong>{data?.serviceStatus || 'Carregando'}</strong><span>Status da API</span></article>
        <article><strong>{data?.averageLatency || 0}ms</strong><span>Latência média</span></article>
        <article><strong>{data?.totalRequests || 0}</strong><span>Requisições</span></article>
        <article><strong>{data?.errorRate || 0}%</strong><span>Taxa de erro</span></article>
        <article><strong>{data?.memoryMb || 0}MB</strong><span>Memória</span></article>
      </div>
      <button className="secondary" type="button" onClick={load}>Atualizar métricas</button>
    </section>
  );
}

export function UXPremiumAdmin({ setTab }) {
  const shortcuts = [
    ['Agenda', 'appointments'], ['Clientes', 'clients'], ['Estoque', 'inventory'], ['Financeiro', 'financial'], ['Automações', 'automations'], ['IA', 'assistant']
  ];
  return (
    <section className="panel-card full-span">
      <span className="eyebrow">UX Premium</span><h2>Atalhos operacionais</h2><p className="panel-help">Navegação direta para tarefas frequentes, sem replicar regra de negócio.</p>
      <div className="executive-action-grid">{shortcuts.map(([label, tab]) => <button type="button" key={tab} onClick={() => setTab(tab)}>{label}</button>)}</div>
    </section>
  );
}

export function PWAAdmin() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const media = window.matchMedia?.('(display-mode: standalone)');
  const [standalone, setStandalone] = useState(Boolean(media?.matches || navigator.standalone));
  const [swState, setSwState] = useState('verificando');

  useEffect(() => {
    const beforeInstall = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const updateOnline = () => setOnline(navigator.onLine);
    const updateStandalone = () => setStandalone(Boolean(media?.matches || navigator.standalone));
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    media?.addEventListener?.('change', updateStandalone);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => setSwState(registration.active ? 'ativo' : 'registrado')).catch(() => setSwState('indisponível'));
    } else {
      setSwState('não suportado');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      media?.removeEventListener?.('change', updateStandalone);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <section className="pwa-center">
      <div className="panel-card pwa-hero full-span"><div><span className="eyebrow">Aplicativo móvel / PWA</span><h2>GlossFlow instalável</h2></div><div className="pwa-status"><strong>{standalone ? 'Instalado' : online ? 'Online' : 'Offline'}</strong><span>status</span></div></div>
      <section className="panel-card full-span"><div className="section-inline-head"><h2>Diagnóstico PWA</h2><button className="primary" type="button" onClick={installApp} disabled={!installPrompt}>Instalar aplicativo</button></div><div className="pwa-diagnostics"><span><b>Conexão</b><strong>{online ? 'Online' : 'Offline'}</strong></span><span><b>Service Worker</b><strong>{swState}</strong></span><span><b>Modo app</b><strong>{standalone ? 'Standalone' : 'Navegador'}</strong></span></div></section>
    </section>
  );
}
