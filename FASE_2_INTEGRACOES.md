# Fase 2 — Integrações prontas para credenciais reais

Esta versão deixa o GlossFlow preparado para receber as informações externas que faltam. Nenhuma credencial real é versionada. Enquanto as chaves não forem preenchidas, as rotas operam em `dry-run` ou em modo diagnóstico.

## Rotas adicionadas

### Status das integrações

```http
GET /admin/ecosystem/integrations
```

Retorna quais integrações estão conectadas, prontas ou com variáveis pendentes.

### Teste de WhatsApp

```http
POST /admin/whatsapp/send-test
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "5511999999999",
  "message": "Teste GlossFlow",
  "dryRun": true
}
```

Com `dryRun: true`, não envia mensagem real. Para envio real, configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e use `dryRun: false`.

### Checkout/Pagamento

```http
POST /admin/payments/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider": "mercadopago",
  "amount": 150,
  "description": "Reserva de horário",
  "payerEmail": "cliente@email.com",
  "dryRun": true
}
```

Providers aceitos:

- `mercadopago`: base para PIX.
- `stripe`: base para assinatura SaaS recorrente.

## Variáveis principais

### WhatsApp Cloud API

```env
WHATSAPP_PROVIDER="meta"
WHATSAPP_DRY_RUN="true"
WHATSAPP_API_VERSION="v20.0"
WHATSAPP_ACCESS_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
```

### Mercado Pago

```env
PAYMENTS_DRY_RUN="true"
MERCADO_PAGO_ACCESS_TOKEN=""
DEFAULT_PAYER_EMAIL="cliente@example.com"
```

### Stripe

```env
STRIPE_SECRET_KEY=""
STRIPE_PRICE_ID=""
STRIPE_SUCCESS_URL="https://seu-front.vercel.app/sucesso"
STRIPE_CANCEL_URL="https://seu-front.vercel.app/cancelado"
```

### OpenAI

```env
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

### Sentry

```env
SENTRY_DSN=""
VITE_SENTRY_DSN=""
```

## Validação

Ambiente mínimo:

```bash
cd backend
npm run check:env
npm run deploy:verify
```

Ambiente completo da Fase 2:

```bash
cd backend
STRICT_INTEGRATIONS=true npm run check:env
```

## O que ainda depende de você

Para sair do modo demonstrativo, você precisa criar/fornecer:

- Token e Phone Number ID da Meta para WhatsApp.
- Access token do Mercado Pago.
- Secret key e Price ID da Stripe.
- DSN do Sentry.
- Chave da OpenAI.
- URLs reais do Render/Vercel.

Depois disso, basta trocar `*_DRY_RUN` para `false` e testar as rotas.
