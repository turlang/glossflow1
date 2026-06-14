# Fase 3 — Comercial SaaS

Esta etapa deixa o GlossFlow preparado para operação comercial: planos, captura de leads, trial, checkout e afiliados.

## Rotas públicas adicionadas

```txt
GET  /commercial/plans
POST /commercial/leads
POST /commercial/trial
POST /commercial/checkout
POST /commercial/affiliate/referral
```

## O que já funciona

- Listagem pública de planos.
- Captura de lead comercial.
- Solicitação de trial de 7 dias.
- Checkout em modo dry-run ou Stripe real quando configurado.
- Registro de indicação de afiliado.
- Notificação interna via WhatsApp quando `COMMERCIAL_NOTIFY_WHATSAPP_TO` estiver preenchido.

## Variáveis necessárias

```env
APP_PUBLIC_URL="https://seu-dominio.com"
PUBLIC_API_URL="https://api.seu-dominio.com"
COMMERCIAL_NOTIFY_WHATSAPP_TO="5511999999999"
AFFILIATE_COMMISSION_PERCENT=20
TRIAL_DAYS=7
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PRICE_ID="price_..."
PAYMENTS_DRY_RUN="false"
```

## Fluxo comercial recomendado

1. Cliente acessa landing page.
2. Escolhe plano.
3. Solicita trial ou checkout.
4. Equipe recebe lead no WhatsApp.
5. Cliente finaliza assinatura.
6. Onboarding configura salão, serviços e profissionais.
7. Após trial, cobrança recorrente é ativada.

## Observação importante

As rotas estão prontas para receber as chaves reais, mas checkout, WhatsApp e cobrança só são validados completamente em conta real ou sandbox dos provedores.
