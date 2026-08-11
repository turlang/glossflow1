import React, { useEffect, useState } from 'react';
import { request } from '../../services/api.js';
import { Input, Select, Textarea } from '../ui/Forms.jsx';

export function SecurityAdmin({ clients }) {
  const [overview, setOverview] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState({ clientId: '', type: 'MARKETING_WHATSAPP', granted: true, evidence: 'Consentimento registrado pelo painel administrativo.' });

  async function loadSecurity() {
    const [overviewData, logsData, sessionsData] = await Promise.all([
      request('/admin/security/overview'),
      request('/admin/security/audit-logs'),
      request('/admin/security/sessions')
    ]);
    setOverview(overviewData);
    setAuditLogs(logsData);
    setSessions(sessionsData);
  }

  useEffect(() => { loadSecurity().catch((error) => setMessage(error.message)); }, []);

  async function createBackup() {
    const backup = await request('/admin/security/backups', { method: 'POST', body: JSON.stringify({}) });
    setMessage(`Backup lógico criado: ${backup.summary}`);
    await loadSecurity();
  }

  async function revokeSession(id) {
    await request(`/admin/security/sessions/${id}/revoke`, { method: 'POST', body: JSON.stringify({}) });
    await loadSecurity();
  }

  async function saveConsent(event) {
    event.preventDefault();
    await request('/admin/security/lgpd/consents', { method: 'POST', body: JSON.stringify(consent) });
    setMessage('Consentimento LGPD registrado com sucesso.');
    await loadSecurity();
  }

  return (
    <section className="security-center">
      <div className="panel-card security-hero full-span"><div><span className="eyebrow">Segurança corporativa</span><h2>Auditoria, sessões, LGPD e backup</h2></div><div className="security-score"><strong>{overview?.score || 0}</strong><span>score</span></div></div>
      {message && <p className="feedback full-span" role="status">{message}</p>}
      <div className="security-grid full-span">{(overview?.controls || []).map((control) => <article className="security-control" key={control.name}><span>{control.status}</span><strong>{control.name}</strong><p>{control.description}</p></article>)}</div>
      <section className="panel-card full-span"><h2>Backup lógico</h2><button className="primary" type="button" onClick={createBackup}>Criar backup agora</button></section>
      <form className="panel-card form-grid full-span" onSubmit={saveConsent}>
        <h2>Consentimento LGPD</h2>
        <Select label="Cliente" value={consent.clientId} onChange={(clientId) => setConsent((current) => ({ ...current, clientId }))} options={clients.map((client) => ({ value: client.id, label: `${client.name} • ${client.phone}` }))} />
        <Input label="Tipo de consentimento" value={consent.type} onChange={(type) => setConsent((current) => ({ ...current, type }))} required />
        <Textarea label="Evidência" value={consent.evidence} onChange={(evidence) => setConsent((current) => ({ ...current, evidence }))} />
        <button className="primary full" type="submit">Registrar consentimento</button>
      </form>
      <section className="panel-card full-span"><h2>Sessões administrativas</h2><div className="list">{sessions.map((session) => <div className="list-row" key={session.id}><div><strong>{session.user?.name || 'Usuário'}</strong><span>{session.ip || 'IP não informado'} • {session.revokedAt ? 'Revogada' : 'Ativa'}</span></div><button className="danger-button" type="button" onClick={() => revokeSession(session.id)} disabled={Boolean(session.revokedAt)}>Encerrar sessão</button></div>)}</div></section>
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
