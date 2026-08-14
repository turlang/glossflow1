# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza presença pública, Agenda, CRM, Estoque, financeiro, fidelidade, WhatsApp/IA e módulos operacionais avançados em uma única plataforma.

## Estado atual

O produto está em **produção ativa** e o desenvolvimento está no **Marco 35 — Consolidação e Homologação dos 19 módulos**.

Os Marcos 1–24 formam a base comercial estável. Os Marcos 25–34 ampliaram o produto com PDV, pacotes, compras, equipe, clínico, marketing, portal do cliente, multiunidade, recursos e financeiro avançado. O Marco 35 não abre novos domínios: ele integra, endurece, diagnostica e homologa o que já existe.

A produção já foi comprovada com exact-build smoke até a Etapa 5 do Marco 35. As Etapas 6–7 estão no `main` e devem receber um único deploy final no Render antes do encerramento oficial do marco.

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

Esses três módulos não são apresentados como completos onde existe dependência externa ou decisão corporativa ainda não homologada.

## Marco 35 — o que foi consolidado

### Diagnósticos canônicos

- `GET /admin/homologation/transactional` — PDV, Estoque, Compras, Financeiro e Pacotes;
- `GET /admin/homologation/operations` — Equipe, Clínico, Portal e Recursos;
- `GET /admin/homologation/evolution` — Marketing, Multiunidade e Financeiro Avançado/Fiscal;
- `GET /admin/homologation/checkout-flow` — Agenda → Recursos → Pacotes → PDV → Financeiro;
- `GET /admin/homologation/validation-suite` — WhatsApp, Compras, Equipe, Clínico e Portal do Cliente.

Os diagnósticos administrativos são tenant-scoped e exigem `ADMIN` quando manipulam/expõem estado sensível.

### Checkout integrado

O fluxo de atendimento pode fechar Agenda → Recursos → Pacotes → PDV → Financeiro com:

- preview server-side;
- preço de serviço/produto calculado no backend;
- consumo de crédito de pacote elegível;
- reserva e liberação de recursos;
- venda e pagamentos;
- baixa e movimento de estoque;
- lançamento financeiro;
- conclusão do atendimento;
- idempotência por atendimento;
- transação Prisma única para a mutação crítica.

### Compras

O recebimento seguro integra, na mesma operação:

- atualização de quantidade;
- atualização de custo;
- movimento `IN`;
- conta a pagar;
- mudança do pedido para `RECEIVED`.

O schema atual representa recebimento completo. **Recebimento parcial não é simulado**: se entrar no escopo comercial, deve receber uma evolução explícita do modelo de dados.

### Equipe

- máquina de estados para ponto;
- rejeição de transições inválidas;
- metas e folha operacional;
- bloqueio de períodos de folha sobrepostos.

O GlossFlow não reivindica cálculo trabalhista/legal brasileiro completo nesta fase.

### Clínico

- prontuário tenant-safe;
- vínculo opcional ao atendimento;
- verificação de compatibilidade cliente ↔ atendimento;
- consentimento com texto, responsável e data/hora;
- respostas administrativas sensíveis com `Cache-Control: no-store`;
- interface para registrar vínculo e consentimento completo.

### Portal do Cliente

- token aleatório; somente SHA-256 persistido;
- expiração e revogação;
- rotação do link ativo ao gerar novo acesso para o cliente;
- consultas públicas sempre derivadas do tenant/client do token persistido;
- dados administrativos do portal sem cache.

### Multiunidade

O vínculo entre unidades exige:

- convite HMAC assinado;
- tenant de destino explícito;
- expiração;
- aceite por `ADMIN` da unidade correta;
- `timingSafeEqual` na assinatura;
- proteção contra vínculo duplicado;
- saída/revogação explícitas.

A associação **não concede acesso a CRM, Agenda, Estoque ou Financeiro de outra unidade**. Qualquer compartilhamento futuro depende de política corporativa explícita e nova autorização técnica.

## Segurança e multi-tenancy

A plataforma mantém:

- JWT e sessão revogável;
- refresh token de uso único/rotativo;
- RBAC (`SUPER_ADMIN`, `ADMIN`, `RECEPTION`, `PROFESSIONAL`);
- isolamento por `salonId`;
- entitlements de módulo;
- rate limit;
- auditoria;
- lifecycle `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELED`;
- LGPD export/anonymization;
- backup assinado e restore guardado;
- observabilidade com Build ID rastreável.

### Operações destrutivas

Reset/limpeza de dados não deve ser executado em produção. O endpoint de clean reset continua sendo uma superfície que merece hardening adicional por feature flag/env guard antes de qualquer uso operacional mais amplo.

## Integrações externas

- WhatsApp possui suporte a Twilio/Meta/provider HTTP; a baseline conhecida usa Twilio Trial, que é sandbox/trial e não sender definitivo de cliente.
- Mercado Pago/Stripe permanecem opcionais enquanto cobrança automática não fizer parte do plano vendido.
- NFS-e real depende de provider fiscal autorizado; o GlossFlow não simula um documento como `ISSUED` sem evidência de provider.
- Sentry permanece opcional enquanto não fizer parte de SLA contratado.

## CI/CD e rastreabilidade

Gates permanentes:

- `GlossFlow Quality Gate`;
- `Production Gate`;
- `Production Smoke Validation`;
- validação pública responsiva do Marco 24 quando aplicável.

O Production Smoke exige que o Render sirva exatamente os 12 primeiros caracteres do SHA que disparou o gate, verifica `/health`, `/ready`, MongoDB e endpoints públicos.

### Render

O repositório não possui atualmente workflow GitHub que faça deploy do backend no Render, e o auto-deploy do serviço não tem acompanhado cada commit de `main`. No fechamento do Marco 35, deve ser feito um único deploy manual do SHA final ou configurado Auto-Deploy/deploy hook de forma explícita.

## Documentação principal

- [`ROADMAP.md`](ROADMAP.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`DEPLOY_RENDER_VERCEL.md`](DEPLOY_RENDER_VERCEL.md)
- [`docs/RUNBOOK_OPERACIONAL.md`](docs/RUNBOOK_OPERACIONAL.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/SECURITY_LGPD.md`](docs/engineering/SECURITY_LGPD.md)
- [`docs/engineering/MARCOS25_34_IMPLEMENTATION.md`](docs/engineering/MARCOS25_34_IMPLEMENTATION.md)
- [`docs/engineering/MARCOS25_34_VALIDATION.md`](docs/engineering/MARCOS25_34_VALIDATION.md)
- [`docs/engineering/MARCO35_ETAPA5_CHECKOUT.md`](docs/engineering/MARCO35_ETAPA5_CHECKOUT.md)
- [`docs/engineering/MARCO35_ETAPA6_VALIDATION.md`](docs/engineering/MARCO35_ETAPA6_VALIDATION.md)

## Marco atual

**Marco 35 — Consolidação e Homologação dos 19 módulos.**

Condição para encerramento oficial: gates do SHA final verdes, deploy do mesmo SHA no Vercel/Render, `/ready` com MongoDB no mesmo build, Production Smoke exact-SHA verde e registro final da Issue #28. Homologações humanas e providers externos continuam explicitamente separados da evidência automatizada.
