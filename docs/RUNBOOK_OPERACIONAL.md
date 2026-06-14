# Runbook Operacional GlossFlow

## Incidente: API fora do ar

1. Acesse `/health`.
2. Se falhar, veja logs da plataforma.
3. Verifique variáveis `DATABASE_URL`, `JWT_SECRET` e `PORT`.
4. Rode `npm run deploy:verify` localmente.

## Incidente: API responde, mas integrações falham

1. Acesse `/ready`.
2. Acesse `/admin/ecosystem/integrations` autenticado.
3. Confirme tokens de WhatsApp, Stripe, Mercado Pago, Sentry e OpenAI.
4. Teste em dry-run antes de ativar produção.

## Incidente: build falhando

1. Confirme Node 20.
2. Apague `node_modules` e lockfile apenas se necessário.
3. Rode `npm ci` em vez de `npm install` em CI.
4. Rode Prisma generate antes do build.

## Incidente: dados cruzados entre salões

1. Verifique se a rota usa `salonId` do token.
2. Prefira `findFirst`, `updateMany` e `deleteMany` com `{ id, salonId }`.
3. Registre auditoria da operação.

## Checklist pós-deploy

- `/health` retorna 200.
- `/ready` retorna 200.
- Login administrativo funciona.
- Agendamento público funciona.
- Dashboard carrega.
- Checkout dry-run funciona.
- WhatsApp dry-run funciona.
- Logs aparecem na plataforma.
