# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza presença pública, Agenda, CRM, Estoque, financeiro, fidelidade, WhatsApp/IA e módulos operacionais avançados em uma única plataforma.

## Estado atual

O produto está em **produção ativa** e o desenvolvimento entrou no **Marco 36 — Homologação comercial e higiene pós-Marco 35**.

Os Marcos 1–24 formam a base comercial estável. Os Marcos 25–34 ampliaram o catálogo com PDV, pacotes, compras, equipe, clínico, marketing, portal do cliente, multiunidade, recursos e financeiro avançado. O **Marco 35 foi oficialmente concluído** no SHA `42804f4d9e047684f2d84c5fb5e3e82f5ed7059e`, com Quality Gate, Production Gate, Vercel, Render e Production Smoke exact-SHA verdes. A Issue #28 foi encerrada como `completed`.

O Marco 36 não reabre domínios concluídos. Seu foco inicial é remover estado documental stale, organizar branches históricas e conduzir a homologação comercial dos módulos que continuam `VALIDATION_REQUIRED`, sem transformar dependências externas em falso `READY`.

## Stack

### Frontend

- React 18;
- Vite 8.2.1;
- ESLint 9;
- Vitest 4.1.10;
- Testing Library;
- CSS próprio / Design System por domínio;
- PWA;
- Vercel.

### Backend

- Node.js `>=20.19 <23`;
- Fastify 5.11.3;
- TypeScript `strict`;
- Zod;
- JWT + sessões revogáveis + RBAC;
- Prisma 5.22;
- Render.

### Dados e integrações

- MongoDB Atlas;
- Prisma ORM;
- Groq como provider principal de IA;
- OpenAI como fallback/opção;
- Twilio / Meta / provider HTTP para WhatsApp;
- Mercado Pago / Stripe preparados como providers opcionais;
- Prometheus e observabilidade interna.

## Catálogo comercial — 19 módulos

A classificação é controlada por `backend/src/services/module-readiness.service.ts`.

### READY — 8

| Módulo | Maturidade | Estado |
|---|---:|---|
| Site & Marca | 95% | READY |
| Agenda | 95% | READY |
| Estoque | 93% | READY |
| CRM | 92% | READY |
| Financeiro | 90% | READY |
| Fidelidade | 90% | READY |
| IA | 92% | READY |
| Analytics | 90% | READY |

### VALIDATION_REQUIRED — 8

| Módulo | Maturidade | Pendência principal |
|---|---:|---|
| WhatsApp | 90% | sender definitivo autorizado; Twilio Trial não é homologação comercial final |
| PDV | 91% | homologação humana do checkout integrado |
| Pacotes | 89% | homologação do consumo automático de créditos/benefícios |
| Compras | 91% | homologação do recebimento completo; recebimento parcial exige evolução explícita do modelo |
| Equipe | 89% | homologação operacional; folha legal/fiscal brasileira está fora do escopo atual |
| Clínico | 89% | homologação dedicada de UX, segurança, auditoria e LGPD |
| Portal do Cliente | 90% | homologação ponta a ponta da jornada self-service |
| Recursos | 89% | homologação Agenda → reserva → atendimento → liberação |

### EVOLUTION_REQUIRED — 3

| Módulo | Maturidade | Evolução necessária |
|---|---:|---|
| Marketing 360 | 78% | worker/provider de entrega, scheduler, gatilhos e métricas de conversão |
| Multiunidade | 78% | políticas corporativas e dashboards antes de qualquer compartilhamento operacional explícito |
| Financeiro Avançado/Fiscal | 82% | provider fiscal/NFS-e real e homologado |

Nenhum módulo é promovido apenas porque existe código parcial ou integração preparada.

## Marco 35 — consolidado e validado

### Diagnósticos canônicos

- `GET /admin/homologation/transactional` — PDV, Estoque, Compras, Financeiro e Pacotes;
- `GET /admin/homologation/operations` — Equipe, Clínico, Portal e Recursos;
- `GET /admin/homologation/evolution` — Marketing, Multiunidade e Financeiro Avançado/Fiscal;
- `GET /admin/homologation/checkout-flow` — Agenda → Recursos → Pacotes → PDV → Financeiro;
- `GET /admin/homologation/validation-suite` — WhatsApp, Compras, Equipe, Clínico e Portal do Cliente.

### Checkout integrado

O fechamento de atendimento cobre Agenda → Recursos → Pacotes → PDV → Estoque/Financeiro com preview server-side, preços calculados no backend, consumo de crédito elegível, múltiplos pagamentos, baixa de estoque, lançamento financeiro, conclusão do atendimento, liberação de recursos e idempotência dentro do fluxo transacional.

### Compras

O recebimento seguro integra atualização de quantidade/custo, movimento `IN`, conta a pagar e mudança para `RECEIVED`. O modelo atual representa recebimento completo; recebimento parcial não é simulado.

### Equipe

- máquina de estados do ponto;
- rejeição de transições inválidas;
- metas e folha operacional;
- bloqueio de períodos de folha sobrepostos.

O sistema não reivindica motor trabalhista/legal brasileiro completo.

### Clínico e Portal

O Clínico valida tenant, cliente e atendimento, suporta consentimento com texto/responsável/data e usa `Cache-Control: no-store` em respostas sensíveis. O Portal usa token aleatório com somente SHA-256 persistido, expiração/revogação, rotação de link e consultas sempre derivadas do tenant/client do token persistido.

### Multiunidade

Convites HMAC são direcionados ao tenant de destino, expiram, exigem ADMIN correto e não concedem acesso implícito a CRM, Agenda, Estoque ou Financeiro de outra unidade.

## Segurança e multi-tenancy

A plataforma mantém JWT, sessão revogável, refresh token rotativo de uso único, RBAC (`SUPER_ADMIN`, `ADMIN`, `RECEPTION`, `PROFESSIONAL`), isolamento por `salonId`, entitlements de módulo, rate limit, auditoria, lifecycle SaaS, LGPD, backup assinado, restore guardado e observabilidade com Build ID rastreável.

### Operações destrutivas

Reset/limpeza de dados não deve ser executado como homologação em produção. A superfície de clean reset continua registrada como dívida de hardening e deve receber feature flag/env guard explícita antes de qualquer ampliação de uso, por exemplo `PLATFORM_CLEAN_RESET_ENABLED=false` por padrão.

## Integrações externas

- WhatsApp: suporte a Twilio/Meta/provider HTTP; Twilio Trial é sandbox/trial, não sender definitivo de cliente.
- Mercado Pago/Stripe: opcionais enquanto billing automático não fizer parte do plano vendido.
- NFS-e: depende de provider fiscal autorizado; o GlossFlow não simula documento como `ISSUED` sem evidência de provider.
- Sentry: opcional enquanto não fizer parte de SLA contratado.

## CI/CD e rastreabilidade

Gates permanentes:

- `GlossFlow Quality Gate`;
- `Production Gate`;
- `Production Smoke Validation`;
- validação pública responsiva quando aplicável.

O Production Smoke exige que o Render sirva exatamente os 12 primeiros caracteres do SHA esperado e valida frontend, `/health`, `/ready`, MongoDB e endpoints públicos.

### Baseline de produção homologada

O encerramento do Marco 35 foi homologado no SHA:

```text
42804f4d9e047684f2d84c5fb5e3e82f5ed7059e
```

Esse SHA é a baseline de entrada do Marco 36. Alterações do Marco 36 são desenvolvidas em branch/PR antes de qualquer promoção para `main`, evitando quebrar desnecessariamente o sincronismo entre o `main` homologado e o backend de produção.

## Documentação principal

- [`ROADMAP.md`](ROADMAP.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`DEPLOY_RENDER_VERCEL.md`](DEPLOY_RENDER_VERCEL.md)
- [`docs/RUNBOOK_OPERACIONAL.md`](docs/RUNBOOK_OPERACIONAL.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/SECURITY_LGPD.md`](docs/engineering/SECURITY_LGPD.md)
- [`docs/engineering/MARCOS25_34_IMPLEMENTATION.md`](docs/engineering/MARCOS25_34_IMPLEMENTATION.md)
- [`docs/engineering/MARCOS25_34_VALIDATION.md`](docs/engineering/MARCOS25_34_VALIDATION.md)
- [`docs/engineering/MARCO35_FINAL_VALIDATION.md`](docs/engineering/MARCO35_FINAL_VALIDATION.md)
- [`docs/engineering/MARCO36_BRANCH_HYGIENE.md`](docs/engineering/MARCO36_BRANCH_HYGIENE.md)

## Marco atual

**Marco 36 — Homologação comercial e higiene pós-Marco 35.**

Issue canônica: **#29**.

Prioridades imediatas: documentação sincronizada, higiene segura de branches históricas e homologação dos oito módulos `VALIDATION_REQUIRED` em tenant QA/ambiente autorizado. Marketing, Multiunidade e Fiscal permanecem `EVOLUTION_REQUIRED` até que as capacidades declaradas sejam realmente entregues.