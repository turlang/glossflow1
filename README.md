# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza vitrine pública, Agenda, CRM, Estoque, financeiro, fidelidade, automações, WhatsApp, IA e operação comercial da própria plataforma.

## Estado atual

O projeto está em **piloto comercial com ambiente de produção ativo**.

Os **Marcos 1–22 estão concluídos e validados em produção**. O **Marco 23 — Segurança e LGPD comercial** está **concluído funcionalmente no PR #17**, aguardando merge e `Production Smoke Validation` para receber a marca oficial de produção.

### Validação do Marco 22

O Marco 22 revelou que o backend do Render estava preso em um build antigo. Depois da correção do serviço, o smoke de produção passou exigindo rastreabilidade real do backend:

- commit/build validado: `f61ba1268bb135d1e5cab4f85bf28acfb011d196`;
- `/health`: `ok=true`, Build ID no body e em `X-GlossFlow-Build`;
- `/ready`: mesmo Build ID e `database.ok=true`;
- frontend e endpoints públicos: **success**;
- `Production Smoke Validation`: **success**.

### Estado automatizado do Marco 23

- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- `npm audit --audit-level=high`: **0 vulnerabilidades** no backend e frontend;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- Production Gate do head funcional: **success**.

## Stack

### Frontend

- React 18
- Vite 8.2.1
- ESLint 9
- Vitest 4.1.10
- Testing Library
- CSS próprio / Design System por domínio
- PWA
- Vercel

### Backend

- Node.js `>=20.19 <23`
- Fastify 5.11.3
- TypeScript `strict`
- Zod
- JWT / RBAC
- Prisma 5.22
- Render

### Dados e integrações

- MongoDB Atlas
- Prisma ORM
- Groq como provider principal de IA
- OpenAI como fallback opcional
- Twilio / Meta / provider HTTP para WhatsApp
- Mercado Pago / Stripe preparados como providers opcionais
- métricas Prometheus e observabilidade interna

## Segurança e sessões — Marco 23

### Access token vinculado à sessão

O login cria uma `UserSession` revogável e inclui `sessionId` no JWT. Em produção, o backend só aceita um access token quando a sessão ainda existe, não foi revogada, não expirou e o usuário continua ativo.

`role`, `email` e `salonId` usados na autorização são revalidados a partir do usuário persistido. Redução de privilégio ou revogação passa a valer sem aguardar o TTL do JWT antigo.

### Refresh token de uso único

Cada `/auth/refresh` rotaciona o refresh token. O token anterior deixa de funcionar, inclusive em tentativas concorrentes/replay.

### Resposta a incidente

O ADMIN pode:

- encerrar uma sessão específica;
- encerrar todas as demais sessões do tenant preservando a sessão atual por padrão;
- correlacionar auditoria com `requestId` e `sessionId`.

## LGPD operacional

### Exportação do titular

`GET /admin/security/lgpd/export/:clientId` gera um pacote isolado por tenant contendo perfil, atendimentos, lista de espera, fidelidade, consentimentos e eventos operacionais relacionados ao titular. A resposta usa `Cache-Control: no-store`.

### Eliminação/anônimização

`POST /admin/security/lgpd/erase/:clientId` exige a confirmação exata `EXCLUIR DADOS` e um motivo documentado.

A transação:

- redige eventos relacionados ao titular;
- anonimiza PII dos atendimentos históricos;
- remove fila, fidelidade, consentimentos e perfil do cliente;
- mantém uma trilha anônima `LGPD_SUBJECT_ERASED`.

Essa operação não deve ser usada como simples correção de cadastro.

## Retenção de dados

O Marco 23 introduz política explícita e **manual/controlada**, sem cron destrutivo silencioso:

```text
SESSION_RECORD_RETENTION_DAYS=30
WHATSAPP_CONTENT_RETENTION_DAYS=180
AUDIT_LOG_RETENTION_DAYS=730
BACKUP_METADATA_RETENTION_DAYS=180
```

Fluxo:

1. `GET /admin/security/retention/preview`;
2. revisar candidatos;
3. confirmar `APLICAR RETENCAO`;
4. executar `/admin/security/retention/run`.

Conteúdo antigo de WhatsApp é redigido antes da expiração final do audit log.

## Rate limit

O backend aplica limites por IP/superfície e por tenant autenticado. Defaults por minuto:

- login: 12;
- refresh: 60;
- escrita pública: 90;
- webhooks: 600;
- tráfego geral: 180;
- tenant autenticado: 600;
- operações de Segurança do tenant: 30.

Respostas excedentes usam HTTP `429`, `Retry-After`, `RATE_LIMITED` e a superfície atingida.

## Backup lógico assinado e restore controlado

A tela Segurança gera um snapshot `glossflow-tenant-backup/v1` assinado com HMAC SHA-256. O snapshot contém o domínio operacional do tenant, como serviços, profissionais, clientes, Agenda, estoque, financeiro, fidelidade, templates e consentimentos.

Não inclui usuários, senhas, sessões, lifecycle SaaS, domínio nem audit logs.

O restore:

- valida schema, tenant e assinatura;
- é `REPLACE` somente para o domínio operacional incluído;
- exige `BACKUP_RESTORE_ENABLED=true`;
- exige confirmação explícita `RESTAURAR BACKUP`;
- gera auditoria `TENANT_BACKUP_RESTORED`;
- deve voltar para `BACKUP_RESTORE_ENABLED=false` imediatamente após o procedimento.

## Auditoria sensível

Mutações administrativas registram ação, recurso, path, IP, user-agent, `requestId`, `sessionId`, status HTTP e outcome. O sistema não persiste valores do body e exclui até os nomes de campos sensíveis como senha, token, segredo, API key, refresh token e snapshot.

## Secrets de produção

`backend/scripts/check-env.js` bloqueia configurações inseguras, incluindo:

- `JWT_SECRET` ausente, curto ou placeholder;
- `BACKUP_SIGNING_SECRET` curto quando configurado;
- `DATABASE_URL` não MongoDB em produção;
- `FRONTEND_ORIGIN` ausente em produção;
- restore habilitado em produção sem `BACKUP_SIGNING_SECRET` explícito.

Segredos reais nunca devem ser versionados.

## Observabilidade — Marco 22

A API mantém:

- `X-Request-Id`;
- Build ID rastreável em `/health` e `/ready`;
- readiness com ping MongoDB;
- métricas p50/p95/p99, erros, slow requests, memória e dependências;
- endpoint Prometheus;
- observabilidade global para `SUPER_ADMIN`;
- índices MongoDB idempotentes;
- paginação CRM;
- code splitting e budget de bundle.

O bundle principal foi reduzido de aproximadamente 405,82 kB para 192,67 kB no Marco 22.

## Testes e qualidade

### Backend

**100/100 testes automatizados** no head funcional do Marco 23, incluindo autenticação, RBAC, Agenda, Estoque, CRM, IA/WhatsApp, observabilidade, lifecycle SaaS, sessões revogáveis, refresh rotation, LGPD, retenção, rate limit, auditoria e backup/restore.

### Frontend

**61/61 testes automatizados**, incluindo controles do painel Segurança/LGPD.

### Gates permanentes

- `GlossFlow Quality Gate`;
- `Production Gate`;
- `Production Smoke Validation`.

## Documentação

- [`ROADMAP.md`](ROADMAP.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/OBSERVABILITY.md`](docs/engineering/OBSERVABILITY.md)
- [`docs/engineering/SECURITY_LGPD.md`](docs/engineering/SECURITY_LGPD.md)
- [`docs/usuario/14_SUPER_ADMIN_SAAS.md`](docs/usuario/14_SUPER_ADMIN_SAAS.md)
- [`docs/usuario/15_SEGURANCA_LGPD.md`](docs/usuario/15_SEGURANCA_LGPD.md)

## Próximo marco após a validação de produção

**Marco 24 — Release comercial estável**.

A sequência canônica está em [`ROADMAP.md`](ROADMAP.md).
