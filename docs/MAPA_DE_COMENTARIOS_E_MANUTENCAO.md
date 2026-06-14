# Mapa de comentários e manutenção

O projeto recebeu comentários nos pontos mais importantes para orientar outro programador sem poluir cada linha do código.

## Onde olhar primeiro

| Arquivo | O que explica |
|---|---|
| `backend/src/server.ts` | CORS, rate limit, headers de segurança, métricas e captura de erro |
| `backend/src/routes/appRoutes.ts` | Organização entre rotas públicas e rotas administrativas protegidas |
| `backend/src/middlewares/auth.ts` | JWT, RBAC e contexto multi-tenant |
| `backend/src/routes/admin-crud.routes.ts` | CRUD administrativo isolado por `salonId` |
| `backend/src/routes/integrations.routes.ts` | Central de conectores em modo dry-run/real |
| `backend/src/services/whatsapp.service.ts` | Envio WhatsApp simulado ou real |
| `backend/src/services/payments.service.ts` | PIX Mercado Pago e checkout Stripe |
| `backend/src/services/sentry.service.ts` | Ponto de captura de erro para observabilidade |
| `backend/src/services/openapi.service.ts` | Contrato básico OpenAPI |
| `backend/prisma/schema.prisma` | Modelos de dados do SaaS |
| `frontend/src/App.jsx` | Interface principal e telas SaaS |

## Padrão de comentário usado

Os comentários foram escritos para explicar decisões de arquitetura, segurança e operação. Não foram adicionados comentários óbvios como "incrementa contador" ou "retorna array", porque isso piora a manutenção.

## Quando adicionar novos comentários

Adicione comentários quando houver:

- Regra de negócio importante.
- Decisão de segurança.
- Integração externa.
- Fallback temporário.
- Código que pode parecer estranho para outro dev.
- Dependência de variável de ambiente.

Evite comentários quando o próprio nome da função já explica o comportamento.

## Exemplo de comentário bom

```ts
/**
 * Todas as consultas administrativas precisam usar salonId.
 * Isso impede que um salão acesse dados de outro salão no mesmo banco.
 */
```

## Exemplo de comentário ruim

```ts
// cria variável id
const id = request.params.id;
```
