# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza vitrine pública, Agenda, CRM, Estoque, financeiro, fidelidade, automações, WhatsApp, IA e operação comercial da própria plataforma.

## Estado atual

O projeto está em **piloto comercial com ambiente de produção ativo**.

Os **Marcos 1–21 estão concluídos e validados em produção**. O Marco 21 fechou o provisionamento e o ciclo de vida comercial dos tenants no Super Admin, sem edição manual no banco e sem destruir dados para suspender ou reativar um cliente.

Validação final do Marco 21:

- merge em `main`: `8b8aa0f2a07061b84aaa72db96c1511dae62a369`;
- backend: **76/76 testes**;
- frontend: **58/58 testes**;
- `npm audit --audit-level=high`: **0 vulnerabilidades** no backend e frontend;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- GlossFlow Quality Gate pós-merge: **success**;
- Production Gate pós-merge: **success**;
- checks Vercel: **success**;
- Production Smoke Validation: **success**.

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
- Sentry opcional
- preparação de billing para Mercado Pago, Stripe, manual ou outro provider

## Arquitetura comercial SaaS

```text
SUPER_ADMIN
   |
   +--> Provisionar cliente
   |      +--> Salon
   |      +--> ADMIN
   |      +--> Plano / assinatura
   |      +--> Módulos contratados
   |      +--> Perfil de billing
   |      +--> Auditoria
   |
   +--> Ciclo do contrato
          TRIAL
            |
            +--> ACTIVE
            +--> PAST_DUE
            +--> CANCELED
                    |
                    +--> revoga sessões
                    +--> bloqueia nova operação
                    +--> preserva configuração/dados
                    +--> pode reativar como ACTIVE
```

O estado comercial é aplicado antes do entitlement de módulo. `SalonSubscription` continua sendo a fonte do estado operacional atual; informações de preparação de billing e histórico sensível são auditadas sem migração destrutiva do schema.

## Funcionalidades principais

- vitrine pública white-label;
- agendamento online;
- Agenda Enterprise e central comercial;
- Smart Fit, lista de espera e reaproveitamento de vagas;
- CRM com segmentação e retenção;
- Estoque operacional, reposição e conciliação;
- financeiro, comissões e fidelidade;
- WhatsApp/IA com confirmação server-side, handoff e política de janela/template;
- Super Admin isolado dos tenants;
- planos e módulos por salão;
- Site & Marca e domínio por cliente;
- custos externos por tenant;
- PWA, auditoria, segurança e observabilidade.

## Marco 21 — Super Admin, planos e ciclo de vida SaaS

### Provisionamento sem edição manual no banco

O fluxo **Provisionar salão completo** possui cinco etapas: Salão, Administrador, Contrato, Módulos e Revisão. Em uma única operação lógica, o backend cria:

- tenant `Salon`;
- primeiro usuário `ADMIN` com senha bcrypt;
- `SalonSubscription` vinculada a plano ativo;
- módulos efetivamente contratados;
- perfil inicial de billing;
- trilha de auditoria SaaS.

Se a sequência falhar depois da criação do tenant, o serviço executa limpeza compensatória para evitar cadastro órfão.

### Ciclo de assinatura

Estados suportados:

- `TRIAL`: acesso até o fim da avaliação;
- `ACTIVE`: operação liberada;
- `PAST_DUE`: janela de graça configurável e bloqueio depois do vencimento;
- `CANCELED`: operação bloqueada e sessões revogadas sem apagar o salão.

O servidor valida as transições. Um contrato `CANCELED` pode permanecer cancelado ou voltar para `ACTIVE`; ele não retorna para `TRIAL`.

### Enforcement contratual

O contrato é revalidado em:

- login;
- refresh de sessão;
- rotas operacionais autenticadas;
- rotas de negócio;
- rotas administrativas críticas do tenant;
- disponibilidade e criação de novos agendamentos públicos.

Tenants legados sem `SalonSubscription` permanecem compatíveis até migração comercial pelo Super Admin.

### ADMIN do cliente

O Super Admin pode atualizar nome, e-mail, estado ativo e senha do administrador principal. Rotação de senha ou desativação revoga as sessões desse usuário. A senha nunca é gravada em auditoria.

### Billing

O painel por tenant registra provider, Customer ID, referência de assinatura, próxima cobrança e observações. **O Marco 21 não cria nem cobra uma assinatura em gateway externo**: esta camada prepara o vínculo comercial para uma integração posterior de billing real.

### White-label, domínio e custos

Site & Marca continua exclusivo do Super Admin. Mudanças de domínio/template/cores/logo/hero são auditadas por tenant sem copiar imagens base64 para os metadados. O painel de custos externos continua registrando custos de WhatsApp, IA, domínio e outros itens por cliente.

### Auditoria dedicada

Eventos principais:

- `SAAS_TENANT_PROVISIONED`;
- `SAAS_SUBSCRIPTION_CHANGED`;
- `SAAS_MODULES_UPDATED`;
- `SAAS_ADMIN_ACCESS_UPDATED`;
- `SAAS_BILLING_PROFILE_UPDATED`;
- `SAAS_SITE_BRAND_UPDATED`.

## Testes e qualidade

### Backend

**76/76 testes automatizados**, incluindo oito testes específicos do ciclo SaaS para estados, período de graça, compatibilidade legada, matriz de transição, revogação de sessões, provisionamento, rollback compensatório e rotação segura da senha do ADMIN.

### Frontend

**58/58 testes automatizados**, incluindo quatro testes específicos do wizard de provisionamento do Super Admin.

### Gates

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build
```

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
```

Workflows permanentes:

- `GlossFlow Quality Gate`;
- `Production Gate`;
- `Production Smoke Validation`.

## Configuração do ciclo SaaS

Consulte `backend/.env.example`. Variáveis do Marco 21:

```text
SAAS_DEFAULT_TRIAL_DAYS=7
SAAS_PAST_DUE_GRACE_DAYS=3
```

Esses valores são defaults do servidor quando o Super Admin não informa datas explícitas para TRIAL ou PAST_DUE.

## Documentação

- [`ROADMAP.md`](ROADMAP.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md`](docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md)
- [`docs/usuario/10_AGENDA_COMERCIAL.md`](docs/usuario/10_AGENDA_COMERCIAL.md)
- [`docs/usuario/11_ESTOQUE_OPERACIONAL.md`](docs/usuario/11_ESTOQUE_OPERACIONAL.md)
- [`docs/usuario/12_CRM_RETENCAO.md`](docs/usuario/12_CRM_RETENCAO.md)
- [`docs/usuario/13_IA_WHATSAPP_PRODUCAO.md`](docs/usuario/13_IA_WHATSAPP_PRODUCAO.md)
- [`docs/usuario/14_SUPER_ADMIN_SAAS.md`](docs/usuario/14_SUPER_ADMIN_SAAS.md)

## Próximo marco oficial

**Marco 22 — Observabilidade, performance e confiabilidade**.

A sequência canônica está em [`ROADMAP.md`](ROADMAP.md).
