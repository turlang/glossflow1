import React, { useMemo, useState } from 'react';
import { request } from '../../services/api.js';

function optionsFrom(items = [], label = (item) => item.name || item.description || item.number || item.id) {
  return items.map((item) => ({ value: item.id, label: label(item) }));
}

function ActionCard({ title, description, fields, submitLabel = 'Executar', path, buildPayload, onChanged, setStatus }) {
  const initial = useMemo(() => Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? ''])), [fields]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = buildPayload ? buildPayload(form) : form;
      await request(typeof path === 'function' ? path(form) : path, { method: 'POST', body: JSON.stringify(payload) });
      setStatus(`${title}: concluído com sucesso.`);
      setForm(initial);
      await onChanged?.();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel-card form-grid" onSubmit={submit}>
      <h3 className="full-span">{title}</h3>
      {description && <p className="panel-help full-span">{description}</p>}
      {fields.map((field) => {
        if (field.type === 'select') return (
          <label key={field.key}>{field.label}
            <select required={field.required !== false} value={form[field.key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}>
              <option value="">Selecione</option>
              {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        );
        if (field.type === 'textarea') return <label key={field.key}>{field.label}<textarea required={field.required} value={form[field.key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} /></label>;
        return <label key={field.key}>{field.label}<input required={field.required} type={field.type || 'text'} value={form[field.key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} /></label>;
      })}
      <button className="secondary full" type="submit" disabled={busy}>{busy ? 'Processando...' : submitLabel}</button>
    </form>
  );
}

function ActionButtons({ title, items, actionLabel, actionPath, onChanged, setStatus }) {
  const [busyId, setBusyId] = useState('');
  if (!items?.length) return null;

  async function run(item) {
    setBusyId(item.id);
    try {
      await request(actionPath(item), { method: 'POST' });
      setStatus(`${actionLabel}: concluído.`);
      await onChanged?.();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="panel-card">
      <h3>{title}</h3>
      <div className="editable-list">
        {items.map((item) => <div className="editable-row" key={item.id}><span>{item.number || item.description || item.name || item.id}</span><button type="button" className="ghost-button" disabled={busyId === item.id} onClick={() => run(item)}>{busyId === item.id ? '...' : actionLabel}</button></div>)}
      </div>
    </section>
  );
}

export function BusinessExpansionActions({ module, data, clients = [], professionals = [], services = [], inventory = [], appointments = [], onChanged, setStatus }) {
  const clientOptions = optionsFrom(clients);
  const professionalOptions = optionsFrom(professionals);
  const serviceOptions = optionsFrom(services);
  const inventoryOptions = optionsFrom(inventory, (item) => `${item.name} • estoque ${item.quantity ?? 0}`);
  const appointmentOptions = optionsFrom(appointments, (item) => `${item.clientName || 'Cliente'} • ${new Date(item.startTime).toLocaleString('pt-BR')}`);

  if (module === 'pos') {
    const refundable = (Array.isArray(data) ? data : []).filter((sale) => sale.status === 'PAID');
    return <ActionButtons title="Estornos disponíveis" items={refundable} actionLabel="Estornar" actionPath={(sale) => `/admin/pos/sales/${sale.id}/refund`} onChanged={onChanged} setStatus={setStatus} />;
  }

  if (module === 'customer-plans') {
    const packageOptions = optionsFrom(data?.packages || []);
    const membershipOptions = optionsFrom(data?.plans || []);
    return <>
      <ActionCard title="Atribuir pacote" path="/admin/customer-plans/packages/assign" fields={[{ key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions }, { key: 'packageOfferId', label: 'Pacote', type: 'select', options: packageOptions }]} onChanged={onChanged} setStatus={setStatus} />
      <ActionCard title="Criar assinatura do cliente" path="/admin/customer-plans/memberships" fields={[{ key: 'name', label: 'Plano', required: true }, { key: 'description', label: 'Descrição' }, { key: 'monthlyPrice', label: 'Mensalidade', type: 'number', required: true }]} buildPayload={(form) => ({ ...form, monthlyPrice: Number(form.monthlyPrice) })} onChanged={onChanged} setStatus={setStatus} />
      <ActionCard title="Atribuir assinatura" path="/admin/customer-plans/memberships/assign" fields={[{ key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions }, { key: 'planId', label: 'Plano', type: 'select', options: membershipOptions }, { key: 'nextBillingAt', label: 'Próxima cobrança', type: 'date', required: false }]} onChanged={onChanged} setStatus={setStatus} />
      <ActionCard title="Emitir gift card" path="/admin/customer-plans/gift-cards" fields={[{ key: 'clientId', label: 'Cliente beneficiário', type: 'select', options: clientOptions, required: false }, { key: 'purchaserName', label: 'Comprador' }, { key: 'recipientName', label: 'Presenteado' }, { key: 'amount', label: 'Valor', type: 'number', required: true }, { key: 'expiresAt', label: 'Validade', type: 'date', required: false }]} buildPayload={(form) => ({ ...form, clientId: form.clientId || undefined, amount: Number(form.amount), expiresAt: form.expiresAt || undefined })} onChanged={onChanged} setStatus={setStatus} />
    </>;
  }

  if (module === 'procurement') {
    const supplierOptions = optionsFrom(data?.suppliers || []);
    const openOrders = (data?.purchaseOrders || []).filter((order) => order.status !== 'RECEIVED');
    return <>
      <ActionCard title="Criar pedido de compra" path="/admin/procurement/orders" fields={[{ key: 'supplierId', label: 'Fornecedor', type: 'select', options: supplierOptions }, { key: 'productId', label: 'Produto', type: 'select', options: inventoryOptions }, { key: 'description', label: 'Descrição do item', required: true }, { key: 'quantity', label: 'Quantidade', type: 'number', required: true, defaultValue: 1 }, { key: 'unitCost', label: 'Custo unitário', type: 'number', required: true }]} buildPayload={(form) => ({ supplierId: form.supplierId, items: [{ productId: form.productId, description: form.description, quantity: Number(form.quantity), unitCost: Number(form.unitCost) }] })} onChanged={onChanged} setStatus={setStatus} />
      <ActionButtons title="Pedidos aguardando recebimento" items={openOrders} actionLabel="Receber" actionPath={(order) => `/admin/procurement/orders/${order.id}/receive`} onChanged={onChanged} setStatus={setStatus} />
    </>;
  }

  if (module === 'team-management') return <>
    <ActionCard title="Criar meta" path="/admin/team-management/goals" fields={[{ key: 'professionalId', label: 'Profissional', type: 'select', options: professionalOptions }, { key: 'metric', label: 'Métrica', type: 'select', options: ['REVENUE', 'SERVICES', 'PRODUCT_SALES', 'RETENTION', 'OCCUPANCY'].map((value) => ({ value, label: value })) }, { key: 'target', label: 'Meta', type: 'number', required: true }, { key: 'periodStart', label: 'Início', type: 'date', required: true }, { key: 'periodEnd', label: 'Fim', type: 'date', required: true }]} buildPayload={(form) => ({ ...form, target: Number(form.target) })} onChanged={onChanged} setStatus={setStatus} />
    <ActionCard title="Fechar folha" path="/admin/team-management/payroll" fields={[{ key: 'professionalId', label: 'Profissional', type: 'select', options: professionalOptions }, { key: 'professionalName', label: 'Nome no demonstrativo', required: true }, { key: 'baseAmount', label: 'Base', type: 'number', defaultValue: 0 }, { key: 'commissionAmount', label: 'Comissão', type: 'number', defaultValue: 0 }, { key: 'bonusAmount', label: 'Bônus', type: 'number', defaultValue: 0 }, { key: 'deductions', label: 'Descontos', type: 'number', defaultValue: 0 }, { key: 'periodStart', label: 'Início', type: 'date', required: true }, { key: 'periodEnd', label: 'Fim', type: 'date', required: true }]} buildPayload={(form) => ({ periodStart: form.periodStart, periodEnd: form.periodEnd, entries: [{ professionalId: form.professionalId, professionalName: form.professionalName, baseAmount: Number(form.baseAmount), commissionAmount: Number(form.commissionAmount), bonusAmount: Number(form.bonusAmount), deductions: Number(form.deductions) }] })} onChanged={onChanged} setStatus={setStatus} />
  </>;

  if (module === 'marketing') return <>
    <ActionCard title="Criar cupom" path="/admin/marketing/coupons" fields={[{ key: 'code', label: 'Código', required: true }, { key: 'description', label: 'Descrição' }, { key: 'discountType', label: 'Tipo', type: 'select', options: [{ value: 'PERCENT', label: 'Percentual' }, { value: 'FIXED', label: 'Valor fixo' }] }, { key: 'discountValue', label: 'Desconto', type: 'number', required: true }, { key: 'expiresAt', label: 'Validade', type: 'date', required: false }]} buildPayload={(form) => ({ ...form, discountType: form.discountType || 'PERCENT', discountValue: Number(form.discountValue), expiresAt: form.expiresAt || undefined })} onChanged={onChanged} setStatus={setStatus} />
    <ActionCard title="Solicitar avaliação" path="/admin/marketing/reviews" fields={[{ key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions }, { key: 'channel', label: 'Canal', type: 'select', options: ['WHATSAPP', 'EMAIL', 'SMS'].map((value) => ({ value, label: value })) }, { key: 'reviewUrl', label: 'URL de avaliação', type: 'url', required: false }]} buildPayload={(form) => ({ ...form, channel: form.channel || 'WHATSAPP', reviewUrl: form.reviewUrl || '' })} onChanged={onChanged} setStatus={setStatus} />
  </>;

  if (module === 'client-portal') {
    const activeLinks = (Array.isArray(data) ? data : []).filter((link) => !link.revokedAt);
    return <ActionButtons title="Acessos ativos" items={activeLinks} actionLabel="Revogar" actionPath={(link) => `/admin/client-portal/access/${link.id}/revoke`} onChanged={onChanged} setStatus={setStatus} />;
  }

  if (module === 'resources') {
    const resourceOptions = optionsFrom(data?.resources || []);
    return <ActionCard title="Reservar recurso" path="/admin/resources/reservations" fields={[{ key: 'resourceId', label: 'Recurso', type: 'select', options: resourceOptions }, { key: 'appointmentId', label: 'Atendimento relacionado', type: 'select', options: appointmentOptions, required: false }, { key: 'startTime', label: 'Início', type: 'datetime-local', required: true }, { key: 'endTime', label: 'Fim', type: 'datetime-local', required: true }, { key: 'notes', label: 'Observações' }]} buildPayload={(form) => ({ ...form, appointmentId: form.appointmentId || undefined })} onChanged={onChanged} setStatus={setStatus} />;
  }

  if (module === 'finance-advanced') {
    const openCash = (data?.cashSessions || []).filter((cash) => cash.status === 'OPEN');
    return <>
      <ActionCard title="Criar centro de custo" path="/admin/finance-advanced/cost-centers" fields={[{ key: 'name', label: 'Nome', required: true }, { key: 'description', label: 'Descrição' }]} onChanged={onChanged} setStatus={setStatus} />
      <ActionCard title="Abrir caixa" path="/admin/finance-advanced/cash/open" fields={[{ key: 'openingAmount', label: 'Saldo inicial', type: 'number', defaultValue: 0 }, { key: 'notes', label: 'Observações' }]} buildPayload={(form) => ({ ...form, openingAmount: Number(form.openingAmount) })} onChanged={onChanged} setStatus={setStatus} />
      {openCash.map((cash) => <ActionCard key={cash.id} title="Fechar caixa aberto" path={`/admin/finance-advanced/cash/${cash.id}/close`} fields={[{ key: 'closingAmount', label: 'Saldo final', type: 'number', required: true }, { key: 'notes', label: 'Observações' }]} buildPayload={(form) => ({ ...form, closingAmount: Number(form.closingAmount) })} onChanged={onChanged} setStatus={setStatus} />)}
      <ActionCard title="Conciliar recebimentos" path="/admin/finance-advanced/reconciliations" fields={[{ key: 'provider', label: 'Provider', required: true }, { key: 'periodStart', label: 'Início', type: 'date', required: true }, { key: 'periodEnd', label: 'Fim', type: 'date', required: true }, { key: 'expected', label: 'Esperado', type: 'number', required: true }, { key: 'settled', label: 'Liquidado', type: 'number', required: true }]} buildPayload={(form) => ({ ...form, expected: Number(form.expected), settled: Number(form.settled) })} onChanged={onChanged} setStatus={setStatus} />
      <ActionCard title="Registrar documento fiscal" description="Registra o ciclo fiscal; emissão real exige provider autorizado." path="/admin/finance-advanced/fiscal-documents" fields={[{ key: 'amount', label: 'Valor', type: 'number', required: true }, { key: 'provider', label: 'Provider' }, { key: 'number', label: 'Número / referência' }]} buildPayload={(form) => ({ ...form, amount: Number(form.amount), status: 'PENDING' })} onChanged={onChanged} setStatus={setStatus} />
    </>;
  }

  if (module === 'clinical') {
    return <p className="panel-help">O prontuário principal já cobre anamnese, evolução, alergias e assinatura. Fotos e consentimentos avançados permanecem disponíveis no contrato da API para a homologação clínica.</p>;
  }

  if (module === 'organizations') {
    return <p className="panel-help">Vínculos de rede usam convite assinado e aceite explícito da unidade. Nenhum dado operacional é compartilhado automaticamente.</p>;
  }

  return null;
}
