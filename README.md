# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza vitrine pública, agenda, CRM, estoque, financeiro, fidelidade, automações, WhatsApp e apoio operacional com IA.

## Estado atual

O projeto está em **piloto comercial com ambiente de produção ativo**.

A sequência estrutural dos **Marcos 1–16 foi concluída**. Os Marcos 1–15 encerraram a higienização técnica e o Marco 16 homologou o produto por papel (`SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`), alinhando a interface ao RBAC real do backend.

O código atual possui separação por domínio, gates de qualidade, testes automatizados, smoke pós-deploy e validação de produção.

Fluxos principais já operacionais:

```text
Agendamento público
      |
      v
Fastify / regras de Agenda
      |
      +--> MongoDB / Prisma
      |
      +--> Twilio WhatsApp
               |
               +--> status: sent / delivered / read / failed / undelivered
```

```text
WhatsApp inbound
      |
      v
Webhook Twilio
      |
      +--> Tenant / Entitlements
      +--> Persistência
      +--> Handoff humano
      +--> Agenda / Lista de espera / Agente IA
      +--> Guards / Fallback
      +--> Resposta ao cliente
```

A homologação visual pós-higienização corrigiu o contraste de controles nativos no tema escuro e o comportamento de telas administrativas com pouco conteúdo. A homologação funcional seguinte corrigiu permissões e affordances por papel, incluindo Agenda somente leitura para `PROFESSIONAL` e mutações operacionais restritas a `ADMIN`/`RECEPTION`.

## Stack atual

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
- Twilio para WhatsApp
- Sentry opcional
- Mercado Pago / Stripe preparados para evolução de billing

## Arquitetura

```text
frontend/
  src/
    components/
      admin/
      public/
      ui/
    config/
    services/
    utils/
    styles por domínio

backend/
  prisma/                  # schema canônico
  scripts/
  src/
    config/
    lib/
    middlewares/
    routes/
      appointments/
      business/
      twilio-whatsapp/
    services/
      whatsapp-agent/
    app.ts                 # buildApp() testável
    server.ts              # bootstrap/processo
  tests/

docs/
  engineering/
  usuario/
```

Documentação técnica:

- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/CODING_STANDARDS.md`](docs/engineering/CODING_STANDARDS.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`ROADMAP.md`](ROADMAP.md)

## Funcionalidades principais

- vitrine pública white-label;
- agendamento online;
- capacidades por profissional;
- jornada, pausas e bloqueios de equipe;
- Agenda Enterprise com visões dia/semana/mês/profissionais;
- reagendamento acessível e validação de conflitos no backend;
- Agenda Operacional e Smart Fit;
- lista de espera;
- confirmação, cancelamento e gerenciamento pelo cliente;
- lembretes automáticos;
- rastreamento de entrega do WhatsApp;
- agente WhatsApp com fallback e handoff humano;
- CRM de clientes;
- controle de estoque e movimentações;
- financeiro, comissões e fidelidade;
- dashboard executivo;
- Super Admin separado do tenant;
- módulos/entitlements por salão;
- Site & Marca white-label por cliente;
- agente de IA com Groq e fallback local;
- auditoria, segurança e observabilidade;
- PWA.

## Marcos 1–16 concluídos

Os Marcos 1–15 encerraram o ciclo estrutural de higienização. O Marco 16 encerrou a primeira homologação funcional por papel.

Principais resultados:

- `AdminDashboard.jsx` decomposto por domínio;
- Agenda frontend e backend modularizadas;
- `buildApp()` extraído para testes HTTP com `Fastify.inject()`;
- agente WhatsApp separado em contratos, repositório, ferramentas e orquestrador;
- webhook Twilio separado por segurança, tenant, status e inbound;
- domínio comercial separado em CRM, financeiro, comissões, fidelidade, assinatura, templates e IA;
- CSS administrativo e público distribuído por domínio;
- zero `<style>` dentro de componentes JSX;
- zero `any` explícito em `backend/src`;
- repository hygiene impedindo regressões estruturais;
- matriz frontend de acesso por papel alinhada ao backend;
- `SUPER_ADMIN` isolado da operação tenant;
- `RECEPTION` limitado aos módulos operacionais autorizados;
- `PROFESSIONAL` com Agenda somente leitura e sem affordances de mutação;
- mutações de Agenda, lista de espera e mesa operacional restritas a `ADMIN`/`RECEPTION`;
- documentação operacional e checklist de homologação por papel.

Relatórios e checklists:

- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md`](docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md)

## Testes e qualidade

### Backend

**41 testes automatizados**, cobrindo entre outros:

- autenticação e RBAC;
- isolamento multi-tenant;
- validação Zod;
- reagendamento e conflito de Agenda;
- mutações de agendamento;
- CRM;
- estoque e saldo negativo;
- assinatura HMAC do Twilio;
- agente WhatsApp, ferramentas, fallback e handoff humano;
- contratos específicos de `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`.

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build
```

### Frontend

**29 testes automatizados**, cobrindo:

- Agenda Enterprise e calendário;
- interação e reagendamento;
- Agenda somente leitura;
- matriz de menu por papel;
- navegação direta e normalização de página;
- matriz de endpoints carregados por papel.

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
```

## Gates de CI/CD

A integração contínua valida:

1. repository hygiene;
2. `npm ci`;
3. `npm audit --audit-level=high`;
4. Prisma generate no backend;
5. lint / TypeScript;
6. testes;
7. build.

Workflows permanentes:

- `GlossFlow Quality Gate`;
- `Production Gate`;
- `Production Smoke Validation`.

O smoke pós-deploy valida de forma read-only:

- frontend de produção;
- health do backend;
- salão público;
- catálogo público;
- read model público de agendamentos.

## Como executar

### Backend

```bash
cd backend
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Nunca use credenciais de demonstração fixas em produção. Crie o Super Admin por variáveis de ambiente ou pelo processo de bootstrap documentado.

## Deploy canônico

- Backend: `render.yaml`
- Frontend: `frontend/vercel.json`
- Ambiente backend: `backend/.env.example`
- Ambiente frontend: `frontend/.env.example`

A raiz não deve conter cópias alternativas do schema Prisma, scripts restauradores antigos ou blueprints duplicados de infraestrutura.

## Segurança

- isolamento por `salonId` nas operações privadas;
- RBAC para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`;
- matriz visual de acesso alinhada ao RBAC do servidor;
- mutações operacionais de Agenda restritas por papel;
- validação Zod nas entradas HTTP;
- tokens e segredos somente em variáveis de ambiente;
- validação de assinatura em webhook Twilio;
- fallbacks controlados para providers externos;
- respostas 5xx sanitizadas em produção;
- hygiene gate contra `.env`, backups, arquivos grandes e artefatos legados.

## Documentação operacional

- [`COMO_USAR_GLOSSFLOW.md`](COMO_USAR_GLOSSFLOW.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`docs/usuario/`](docs/usuario/)

## Próxima fase

O próximo marco oficial é o **Marco 17 — Agenda comercial e jornada do cliente**. O objetivo é transformar a Agenda no principal motor operacional do salão, validando a jornada completa cliente → salão → WhatsApp em cenários reais.

A sequência oficial está em [`ROADMAP.md`](ROADMAP.md).

## Convenção de desenvolvimento

O GlossFlow prioriza comentários que expliquem contratos, regras de segurança, decisões e fallbacks. Comentários redundantes linha a linha não são adicionados, porque aumentam ruído e ficam desatualizados rapidamente.
