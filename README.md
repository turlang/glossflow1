# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O produto reúne vitrine pública, agenda, CRM, estoque, financeiro, fidelidade, automações e WhatsApp em uma única operação.

## Estado atual

O projeto está em fase de piloto comercial, com a Agenda e o fluxo principal de confirmação por WhatsApp já integrados ao backend.

Fluxo validado:

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

## Stack

### Frontend

- React 18
- Vite 5
- CSS próprio / Design System
- PWA
- Vercel

### Backend

- Node.js 20
- Fastify 4
- TypeScript `strict`
- Zod
- JWT / RBAC
- Render

### Dados e integrações

- MongoDB Atlas
- Prisma ORM
- Groq como provider principal de IA
- Twilio para WhatsApp
- Sentry opcional
- Mercado Pago / Stripe preparados

## Arquitetura

```text
frontend/
  src/
    components/
    config/
    services/
    utils/

backend/
  prisma/              # schema canônico
  scripts/
  src/
    lib/
    middlewares/
    routes/
    services/
    server.ts
  tests/

docs/
  engineering/
  usuario/
```

Detalhes:

- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/CODING_STANDARDS.md`](docs/engineering/CODING_STANDARDS.md)
- [`docs/engineering/HYGIENE_REPORT.md`](docs/engineering/HYGIENE_REPORT.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Funcionalidades principais

- vitrine pública white-label;
- agendamento online;
- capacidades por profissional;
- jornada, pausas e bloqueios de equipe;
- agenda operacional dia/semana;
- Smart Fit para encaixes;
- lista de espera;
- confirmação, cancelamento e gerenciamento pelo cliente;
- lembretes automáticos;
- rastreamento de entrega do WhatsApp;
- CRM de clientes;
- controle de estoque e movimentações;
- financeiro, comissões e fidelidade;
- Super Admin separado do tenant;
- módulos/entitlements por salão;
- agente de IA com Groq;
- auditoria e observabilidade.

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

## Qualidade

Backend:

```bash
cd backend
npm run prisma:generate
npm run lint
npm test
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

Os mesmos passos principais são executados pelo GitHub Actions em `.github/workflows/quality.yml`.

## Deploy canônico

- Backend: `render.yaml`
- Frontend: `frontend/vercel.json`
- Ambiente backend: `backend/.env.example`
- Ambiente frontend: `frontend/.env.example`

A raiz não deve conter cópias alternativas do schema Prisma, scripts restauradores antigos ou blueprints duplicados de infraestrutura.

## Segurança

- isolamento por `salonId` nas operações privadas;
- RBAC para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`;
- validação Zod nas entradas HTTP;
- tokens e segredos apenas em variáveis de ambiente;
- webhooks externos validados quando o provider oferece assinatura;
- respostas 5xx sanitizadas em produção.

## Documentação operacional

- [`COMO_USAR_GLOSSFLOW.md`](COMO_USAR_GLOSSFLOW.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)

## Convenção de desenvolvimento

O GlossFlow prioriza comentários que expliquem contratos, regras de segurança, decisões e fallbacks. Comentários redundantes linha a linha não são adicionados, porque aumentam ruído e ficam desatualizados rapidamente.
