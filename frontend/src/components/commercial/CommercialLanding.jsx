import React, { useEffect, useState } from 'react';
import { request } from '../../services/api';
import { currency } from '../../utils/format';
import { Input, Select, SectionTitle, Textarea } from '../ui/Forms.jsx';

export function CommercialLanding() {
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', businessName: '', plan: 'PRO', message: '' });

  useEffect(() => {
    request('/commercial/plans').then((data) => setPlans(data.plans || [])).catch(() => setPlans([]));
  }, []);

  async function requestTrial(event) {
    event.preventDefault();
    setMessage('');
    try {
      await request('/commercial/trial', { method: 'POST', body: JSON.stringify(form) });
      setMessage('Trial solicitado com sucesso. O funil comercial está pronto para receber atendimento real.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível enviar o pedido de trial.');
    }
  }

  async function checkout(plan) {
    setMessage('');
    try {
      const result = await request('/commercial/checkout', { method: 'POST', body: JSON.stringify({ ...form, plan: plan.code }) });
      setMessage(result.checkout?.checkoutUrl || result.checkout?.data?.url || 'Checkout criado em modo dry-run. Configure Stripe para URL real.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível criar checkout.');
    }
  }

  return (
    <main>
      <section className="commercial-hero">
        <div className="container commercial-grid">
          <div>
            <span className="eyebrow">GlossFlow SaaS</span>
            <h1>Gestão premium para salões venderem mais, atenderem melhor e crescerem com dados.</h1>
            <p>Agenda, clientes, estoque, financeiro, WhatsApp, pagamentos, IA e painel executivo em uma única plataforma pronta para configuração comercial.</p>
            <div className="hero-actions"><a className="primary" href="#trial">Começar trial</a><a className="secondary" href="#planos">Ver planos</a></div>
          </div>
          <div className="commercial-panel">
            <strong>Pronto para SaaS</strong>
            <span>Trial de 7 dias</span>
            <span>Checkout configurável</span>
            <span>Afiliados e captura de leads</span>
            <span>WhatsApp e IA em modo dry-run</span>
          </div>
        </div>
      </section>

      <section id="planos" className="container section-grid">
        <SectionTitle label="Planos" title="Modelo comercial pronto para vender" text="Os valores e recursos podem ser conectados ao Stripe, Mercado Pago ou outro provedor." />
        <div className="cards three">
          {plans.map((plan) => (
            <article className="card" key={plan.code}>
              <span className="eyebrow">{plan.name}</span>
              <h3>{currency(plan.price)} / mês</h3>
              <p>Até {plan.maxUsers} usuários. Trial de {plan.trialDays} dias.</p>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <button className="primary full" type="button" onClick={() => checkout(plan)}>Assinar {plan.name}</button>
            </article>
          ))}
        </div>
      </section>

      <section id="trial" className="container compact section-grid">
        <SectionTitle label="Trial" title="Receber interessados no SaaS" text="Este formulário já envia os dados para a API comercial e pode notificar sua equipe pelo WhatsApp." />
        <form className="form-card" onSubmit={requestTrial}>
          <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
          <Input label="WhatsApp" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <Input label="Nome do salão" value={form.businessName} onChange={(businessName) => setForm({ ...form, businessName })} />
          <Select label="Plano de interesse" value={form.plan} onChange={(plan) => setForm({ ...form, plan })} options={plans.map((plan) => ({ value: plan.code, label: plan.name }))} />
          <Textarea label="Mensagem" value={form.message} onChange={(message) => setForm({ ...form, message })} />
          <button className="primary full" type="submit">Solicitar trial</button>
          {message && <p className="feedback">{message}</p>}
        </form>
      </section>
    </main>
  );
}
