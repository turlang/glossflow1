# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza vitrine pública, Agenda, CRM, Estoque, financeiro, fidelidade, automações, WhatsApp, IA e operação comercial da própria plataforma.

## Estado atual

O projeto está em **produção ativa e Release Candidate comercial do Marco 24**.

Os **Marcos 1–23 estão concluídos e validados em produção**. O **Marco 24 — Release comercial estável** está **CONCLUÍDO FUNCIONALMENTE / PENDENTE SOMENTE DA VALIDAÇÃO FINAL DE PRODUÇÃO** na Issue #19 e no PR #20.

A Issue #19 é a evidência canônica de encerramento. Quando o merge final estiver no Vercel/Render, o `Production Smoke Validation` confirmar o **Build ID exato do merge** e a Issue #19 for fechada como `completed`, o Marco 24 é considerado oficialmente validado em produção **sem exigir um commit documental adicional que alteraria novamente o SHA da release**.

### Validação final do Marco 23

O Marco 23 foi homologado somente depois que o smoke passou a exigir o SHA exato de `main` no Render.

- build/commit validado: `afc22563d54645a8555cbafc53b1a9b6b31f2713`;
- Build ID servido pelo Render: `afc22563d546`;
- `/health`: `ok=true`, Build ID no body e em `X-GlossFlow-Build`;
- `/ready`: mesmo Build ID e `database.ok=true`;
- frontend de produção: **success**;
- endpoints públicos: **success**;
- `Production Smoke Validation` estrito: **success** no rerun do workflow `31639887820`;
- Issue #14 encerrada como `completed`.

### Release Candidate do Marco 24

Evidência funcional já concluída antes do merge:

- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- `npm audit --audit-level=high`: sem vulnerabilidade bloqueadora nas dependências do produto;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- `GlossFlow Quality Gate`: **success** no candidato;
- `Production Gate`: **success** no candidato;
- homologação pública real em Chromium: **15/15 PASS**;
- páginas homologadas: vitrine, booking e landing comercial;
- viewports: 1366×768, 1920×1080, 768×1024, 430×932 e 360×800;
- 0 overflow horizontal bloqueador;
- 0 `pageerror` nas 15 combinações;
- nenhum erro visível de API/agendamento indisponível;
- runtime isolado de navegador auditado antes da execução;
- nenhuma issue P0/P1 conhecida aberta;
- documentação de produção, implantação, suporte, incidente e recuperação revisada.

A única pendência de promoção é operacional: **merge do PR #20 → Vercel/Render no SHA exato → `/ready` com MongoDB → Production Smoke final verde → fechamento da Issue #19**.

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
- OpenAI como fallback/opção de IA
- Twilio / Meta / provider HTTP para WhatsApp
- Mercado Pago / Stripe preparados como providers opcionais
- métricas Prometheus e observabilidade interna

## Agenda comercial

O domínio de Agenda cobre:

- agendamento público;
- capacidade por profissional/serviço;
- jornada, pausa e bloqueio;
- detecção de conflito no backend;
- reagendamento com revalidação;
- Agenda Operacional;
- Smart Fit;
- lista de espera;
- confirmação, cancelamento e comunicação.

A jornada comercial permanece protegida por testes dedicados, inclusive conflito e reagendamento.

## Estoque operacional

O sistema mantém:

- entradas, saídas e ajustes;
- bloqueio de saldo negativo;
- histórico de movimentação;
- mínimo/ruptura;
- conciliação e reposição;
- desativação lógica quando o histórico precisa ser preservado.

## CRM, retenção e automações

O CRM inclui:

- cadastro e histórico por cliente;
- segmentação;
- consentimento e opt-out;
- follow-ups;
- automações de retenção;
- isolamento por tenant e RBAC.

## IA e WhatsApp

O agente usa base factual do salão, confirmação server-side para ações de negócio, handoff humano, política de janela/template e guards/fallbacks.

Durante homologações automáticas, **nenhuma mensagem real é enviada**. Provider/sender/callback devem ser validados apenas em sandbox ou ambiente autorizado quando fizerem parte do escopo do tenant.

## Super Admin e ciclo de vida SaaS

A plataforma mantém:

- provisionamento de tenants;
- estados `TRIAL`, `ACTIVE`, `PAST_DUE` e `CANCELED`;
- módulos/entitlements;
- planos e billing preparado;
- white-label;
- auditoria;
- separação entre `SUPER_ADMIN` e operação do salão.

## Segurança e sessões — Marco 23

### Access token vinculado à sessão

O login cria `UserSession` revogável e inclui `sessionId` no JWT. Em produção, o backend só aceita o token quando a sessão existe, não foi revogada, não expirou e o usuário continua ativo. `role`, `email` e `salonId` são revalidados a partir do usuário persistido.

### Refresh token de uso único

Cada `/auth/refresh` rotaciona o refresh token. O token anterior deixa de funcionar, inclusive em replay concorrente.

### Resposta a incidente

O ADMIN pode encerrar sessão específica ou demais sessões do tenant. Auditoria correlaciona `requestId` e `sessionId` sem armazenar conteúdo sensível do body.

## LGPD operacional

### Exportação

`GET /admin/security/lgpd/export/:clientId` gera pacote tenant-safe com perfil, atendimentos, lista de espera, fidelidade, consentimentos e eventos relacionados. A resposta usa `Cache-Control: no-store`.

### Eliminação/anônimização

`POST /admin/security/lgpd/erase/:clientId` exige `EXCLUIR DADOS` e motivo documentado. O histórico de atendimento é preservado sem PII e fila/fidelidade/consentimentos/perfil são removidos conforme o contrato implementado.

Essa operação não deve ser usada como simples correção cadastral nem como teste em cliente real.

## Retenção de dados

Política explícita e manual/controlada:

```text
SESSION_RECORD_RETENTION_DAYS=30
WHATSAPP_CONTENT_RETENTION_DAYS=180
AUDIT_LOG_RETENTION_DAYS=730
BACKUP_METADATA_RETENTION_DAYS=180
```

A execução exige preview e confirmação `APLICAR RETENCAO`. Não existe cron destrutivo habilitado silenciosamente.

## Backup lógico e restore controlado

O snapshot `glossflow-tenant-backup/v1` é assinado com HMAC SHA-256. O restore:

- valida schema, tenant e assinatura;
- fica bloqueado por `BACKUP_RESTORE_ENABLED=false` na operação normal;
- exige confirmação `RESTAURAR BACKUP` quando habilitado;
- restaura apenas o domínio operacional previsto;
- gera auditoria.

Usuários, senhas, sessões, lifecycle SaaS, domínio e audit logs ficam fora do snapshot operacional.

## Observabilidade e deploy rastreável

A API mantém:

- `X-Request-Id`;
- Build ID em `/health` e `/ready`;
- readiness com ping real do MongoDB;
- métricas p50/p95/p99, erros, slow requests, memória e dependências;
- exportação Prometheus;
- painel de observabilidade para `SUPER_ADMIN`;
- índices MongoDB idempotentes;
- paginação CRM;
- code splitting e budget de bundle.

O `Production Smoke Validation` **falha se o Render não estiver servindo exatamente os 12 primeiros caracteres do SHA de `main` que disparou o Production Gate**.

## Release comercial — Marco 24

O gate comercial separa:

- **AUTO-BLOCKER**: CI, build, testes, exact-build smoke, banco, isolamento e contratos críticos;
- **MANUAL-TENANT**: marca, conteúdo, dados iniciais e homologação humana por cliente;
- **SANDBOX-EXTERNO**: WhatsApp, billing e providers que dependem de ambiente autorizado;
- **N/A**: integrações opcionais não incluídas no plano vendido.

Mercado Pago/Stripe não bloqueiam a release base quando cobrança automática não faz parte do escopo vendido. Sentry permanece hardening opcional enquanto não fizer parte de SLA contratado; sua ausência nunca é apresentada como integração ativa.

## Testes e qualidade

### Backend

**100/100 testes automatizados**, incluindo autenticação, RBAC, Agenda, Estoque, CRM, IA/WhatsApp, observabilidade, lifecycle SaaS, sessões revogáveis, refresh rotation, LGPD, retenção, rate limit, auditoria e backup/restore.

### Frontend

**61/61 testes automatizados**, incluindo Agenda, CRM, estoque, navegação por papel, provisionamento e Segurança/LGPD.

### Gates permanentes

- `GlossFlow Quality Gate`;
- `Production Gate`;
- `Production Smoke Validation` com SHA exato.

### Gate responsivo do Marco 24

O workflow `Marco 24 Public Responsive Validation` usa Chromium real, audita o runtime isolado e valida vitrine, booking e landing comercial em cinco viewports. Screenshots e `report.json` são publicados como artefato de CI.

## Documentação

- [`ROADMAP.md`](ROADMAP.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`DEPLOY_RENDER_VERCEL.md`](DEPLOY_RENDER_VERCEL.md)
- [`docs/RUNBOOK_OPERACIONAL.md`](docs/RUNBOOK_OPERACIONAL.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/OBSERVABILITY.md`](docs/engineering/OBSERVABILITY.md)
- [`docs/engineering/SECURITY_LGPD.md`](docs/engineering/SECURITY_LGPD.md)
- [`docs/engineering/MARCO24_RELEASE_VALIDATION.md`](docs/engineering/MARCO24_RELEASE_VALIDATION.md)
- [`docs/usuario/07_CHECKLIST_IMPLANTACAO.md`](docs/usuario/07_CHECKLIST_IMPLANTACAO.md)
- [`docs/usuario/14_SUPER_ADMIN_SAAS.md`](docs/usuario/14_SUPER_ADMIN_SAAS.md)
- [`docs/usuario/15_SEGURANCA_LGPD.md`](docs/usuario/15_SEGURANCA_LGPD.md)

## Marco atual

**Marco 24 — Release comercial estável — RELEASE CANDIDATE.**

Decisão funcional: **GO para promoção**. Validação oficial de produção: **pendente exclusivamente do merge e do exact-build smoke final**.