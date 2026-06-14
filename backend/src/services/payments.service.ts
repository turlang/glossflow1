/**
 * Serviço de pagamentos do GlossFlow.
 *
 * Mercado Pago é usado para cobranças PIX avulsas.
 * Stripe é usado para assinatura recorrente do SaaS.
 *
 * O modo dry-run permite testar checkout sem movimentar dinheiro.
 * Nunca desative PAYMENTS_DRY_RUN em produção antes de validar credenciais
 * e webhooks em ambiente sandbox/homologação.
 */
type CheckoutInput = {
  amount: number;
  description: string;
  payerEmail?: string;
  successUrl?: string;
  failureUrl?: string;
  dryRun?: boolean;
};

export async function createMercadoPagoPix(input: CheckoutInput) {
  if (input.amount <= 0) return { ok: false, provider: 'mercadopago', message: 'Valor deve ser maior que zero.' };

  if (input.dryRun || process.env.PAYMENTS_DRY_RUN === 'true') {
    return {
      ok: true,
      provider: 'mercadopago',
      mode: 'dry-run',
      amount: input.amount,
      description: input.description,
      pix: { qrCode: 'DRY_RUN_QR_CODE', copyPaste: '000201DRYRUN-GLOSSFLOW' }
    };
  }

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return { ok: false, provider: 'mercadopago', message: 'MERCADO_PAGO_ACCESS_TOKEN não configurado.' };

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': `glossflow-${Date.now()}-${Math.random().toString(36).slice(2)}`
    },
    body: JSON.stringify({
      transaction_amount: input.amount,
      description: input.description,
      payment_method_id: 'pix',
      payer: { email: input.payerEmail || process.env.DEFAULT_PAYER_EMAIL || 'cliente@example.com' }
    })
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, provider: 'mercadopago', statusCode: response.status, data };
}

export async function createStripeCheckout(input: CheckoutInput) {
  if (input.amount <= 0) return { ok: false, provider: 'stripe', message: 'Valor deve ser maior que zero.' };

  if (input.dryRun || process.env.PAYMENTS_DRY_RUN === 'true') {
    return { ok: true, provider: 'stripe', mode: 'dry-run', checkoutUrl: 'https://checkout.stripe.com/dry-run/glossflow' };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!secret || !priceId) return { ok: false, provider: 'stripe', message: 'STRIPE_SECRET_KEY ou STRIPE_PRICE_ID não configurado.' };

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', input.successUrl || process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/sucesso');
  params.set('cancel_url', input.failureUrl || process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/cancelado');
  if (input.payerEmail) params.set('customer_email', input.payerEmail);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, provider: 'stripe', statusCode: response.status, data };
}
