import React, { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api.js';
import { currency } from '../../utils/format.js';

const CONFIG = {
  pos: {
    title: 'Marco 25 • PDV / Checkout', endpoint: '/admin/pos/sales', create: '/admin/pos/sales',
    fields: [['description', 'Descrição', 'text'], ['quantity', 'Quantidade', 'number'], ['unitPrice', 'Valor unitário', 'number'], ['paymentMethod', 'Pagamento', 'choice', ['PIX', 'CASH', 'CARD', 'TRANSFER']], ['discount', 'Desconto', 'number']]
  },
  'customer-plans': {
    title: 'Marco 26 • Pacotes, Assinaturas e Gift Cards', endpoint: '/admin/customer-plans', create: '/admin/customer-plans/packages',
    fields: [['name', 'Nome do pacote', 'text'], ['description', 'Descrição', 'text'], ['price', 'Preço', 'number'], ['totalCredits', 'Créditos', 'number'], ['validityDays', 'Validade em dias', 'number']]
  },
  procurement: {
    title: 'Marco 27 • Compras e Fornecedores', endpoint: '/admin/procurement', create: '/admin/procurement/suppliers',
    fields: [['name', 'Fornecedor', 'text'], ['document', 'Documento', 'text'], ['phone', 'Telefone', 'text'], ['email', 'E-mail', 'email'], ['contact', 'Contato', 'text']]
  },
  'team-management': {
    title: 'Marco 28 • Equipe, Ponto, Metas e Folha', endpoint: '/admin/team-management', create: '/admin/team-management/time-clock',
    fields: [['professionalId', 'Profissional', 'professional'], ['type', 'Evento', 'choice', ['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']], ['notes', 'Observação', 'text']]
  },
  clinical: {
    title: 'Marco 29 • Anamnese / Prontuário', endpoint: '/admin/clinical-records', create: '/admin/clinical-records',
    fields: [['clientId', 'Cliente', 'client'], ['recordType', 'Tipo', 'choice', ['ANAMNESIS', 'TREATMENT', 'EVOLUTION', 'CONSENT']], ['allergies', 'Alergias', 'text'], ['notes', 'Evolução / observações', 'textarea'], ['signedBy', 'Responsável', 'text']]
  },
  marketing: {
    title: 'Marco 30 • Marketing 360 e Reputação', endpoint: '/admin/marketing', create: '/admin/marketing/campaigns',
    fields: [['name', 'Campanha', 'text'], ['channel', 'Canal', 'choice', ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP']], ['segment', 'Segmento', 'text'], ['message', 'Mensagem', 'textarea'], ['status', 'Status', 'choice', ['DRAFT', 'SCHEDULED']]]
  },
  'client-portal': {
    title: 'Marco 31 • Portal do Cliente', endpoint: '/admin/client-portal/access', create: '/admin/client-portal/access',
    fields: [['clientId', 'Cliente', 'client'], ['expiresInHours', 'Validade do link (horas)', 'number']]
  },
  organizations: {
    title: 'Marco 32 • Multiunidade / Redes', endpoint: '/admin/organizations', create: '/admin/organizations',
    fields: [['name', 'Nome da rede', 'text'], ['document', 'Documento', 'text']]
  },
  resources: {
    title: 'Marco 33 • Recursos Físicos', endpoint: '/admin/resources', create: '/admin/resources',
    fields: [['name', 'Recurso', 'text'], ['type', 'Tipo', 'choice', ['ROOM', 'CHAIR', 'BED', 'EQUIPMENT', 'OTHER']], ['capacity', 'Capacidade', 'number'], ['notes', 'Observações', 'text']]
  },
  'finance-advanced': {
    title: 'Marco 34 • Financeiro Avançado / Fiscal', endpoint: '/admin/finance-advanced', create: '/admin/finance-advanced/ledger',
    fields: [['type', 'Tipo', 'choice', ['PAYABLE', 'RECEIVABLE']], ['description', 'Descrição', 'text'], ['category', 'Categoria', 'text'], ['amount', 'Valor', 'number'], ['dueDate', 'Vencimento', 'date']]
  }
};

const DEFAULTS = {
  pos: { description: '', quantity: 1, unitPrice: '', paymentMethod: 'PIX', discount: 0 },
  'customer-plans': { name: '', description: '', price: '', totalCredits: 1, validityDays: 90 },
  procurement: { name: '', document: '', phone: '', email: '', contact: '' },
  'team-management': { professionalId: '', type: 'CLOCK_IN', notes: '' },
  clinical: { clientId: '', recordType: 'ANAMNESIS', allergies: '', notes: '', signedBy: '' },
  marketing: { name: '', channel: 'WHATSAPP', segment: 'ALL', message: '', status: 'DRAFT' },
  'client-portal': { clientId: '', expiresInHours: 72 },
  organizations: { name: '', document: '' },
  resources: { name: '', type: 'ROOM', capacity: 1, notes: '' },
  'finance-advanced': { type: 'PAYABLE', description: '', category: '', amount: '', dueDate: '' }
};

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data).flatMap(([group, list]) => Array.isArray(list) ? list.map((item) => ({ ...item, _group: group })) : []);
}

function describe(item) {
  if (item.number) return `${item.number} • ${item.status || ''}${item.total != null ? ` • ${currency(item.total)}` : ''}`;
  if (item.name) return `${item.name}${item.status ? ` • ${item.status}` : ''}`;
  if (item.description) return `${item.description}${item.amount != null ? ` • ${currency(item.amount)}` : ''}${item.status ? ` • ${item.status}` : ''}`;
  return `${item.type || item._group || 'Registro'} • ${String(item.id || '').slice(-8)}`;
}

export function BusinessExpansionSuite({ module, clients = [], professionals = [] }) {
  const config = CONFIG[module] || CONFIG.pos;
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ ...DEFAULTS[module] });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');

  async function load() {
    setBusy(true);
    try {
      setData(await request(config.endpoint));
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setForm({ ...DEFAULTS[module] });
    setPortalUrl('');
    void load();
  }, [module]);

  const rows = useMemo(() => rowsFrom(data).slice(0, 40), [data]);

  function payload() {
    const normalized = { ...form };
    config.fields.forEach(([key, , type]) => {
      if (type === 'number') normalized[key] = Number(normalized[key] || 0);
    });
    if (module === 'pos') {
      const amount = Math.max(0, normalized.quantity * normalized.unitPrice - normalized.discount);
      return {
        items: [{ kind: 'SERVICE', description: normalized.description, quantity: normalized.quantity, unitPrice: normalized.unitPrice }],
        payments: [{ method: normalized.paymentMethod, amount }],
        discount: normalized.discount
      };
    }
    if (module === 'clinical') return { ...normalized, photoUrls: [], consentText: '' };
    return normalized;
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await request(config.create, { method: 'POST', body: JSON.stringify(payload()) });
      if (module === 'client-portal') setPortalUrl(response.url || '');
      setStatus('Registro salvo com sucesso.');
      await load();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inventory-layout">
      <section className="panel-card inventory-summary full-span">
        <span className="eyebrow">Expansão comercial • Marcos 25–34</span>
        <h2>{config.title}</h2>
        <p className="panel-help">Operação isolada por tenant e protegida por RBAC, entitlements e auditoria.</p>
        <button type="button" className="secondary" onClick={load} disabled={busy}>{busy ? 'Atualizando...' : 'Atualizar dados'}</button>
        {status && <p className="panel-help">{status}</p>}
      </section>

      <form className="panel-card form-grid" onSubmit={submit}>
        <h2 className="full-span">Novo registro</h2>
        {config.fields.map(([key, label, type, options]) => {
          if (type === 'choice') return <label key={key}>{label}<select value={form[key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
          if (type === 'client' || type === 'professional') {
            const optionsList = type === 'client' ? clients : professionals;
            return <label key={key}>{label}<select required value={form[key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}><option value="">Selecione</option>{optionsList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
          }
          if (type === 'textarea') return <label key={key}>{label}<textarea value={form[key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>;
          return <label key={key}>{label}<input type={type} value={form[key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>;
        })}
        <button className="primary full" type="submit" disabled={busy}>Salvar</button>
        {portalUrl && <label className="full-span">Link temporário do cliente<input readOnly value={portalUrl} onFocus={(event) => event.target.select()} /></label>}
      </form>

      <section className="panel-card">
        <h2>Registros recentes</h2>
        <p className="panel-help">{rows.length} item(ns) exibido(s).</p>
        <div className="editable-list">
          {rows.length === 0 && <p className="panel-help">Nenhum registro ainda.</p>}
          {rows.map((item) => <div className="editable-row" key={`${item._group || 'row'}-${item.id}`}><span>{item._group ? `${item._group} • ` : ''}{describe(item)}</span></div>)}
        </div>
      </section>
    </div>
  );
}
