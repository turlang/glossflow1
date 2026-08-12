# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza vitrine pública, agenda, CRM, estoque, financeiro, fidelidade, automações, WhatsApp e apoio operacional com IA.

## Estado atual

O projeto está em **piloto comercial com ambiente de produção ativo**.

A sequência estrutural e comercial dos **Marcos 1–19 está concluída no PR do Marco 19**. Os Marcos 1–15 encerraram a higienização técnica, o Marco 16 homologou o produto por papel, o Marco 17 consolidou a Agenda como central operacional, o Marco 18 transformou o Estoque em fluxo diário de reposição e conciliação, e o Marco 19 transformou o CRM em uma central de retenção acionável.

O código possui separação por domínio, gates de qualidade, testes automatizados, smoke pós-deploy e validação de produção.

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
Agenda comercial
      |
      +--> Planejamento Enterprise
      |      +--> Dia / Semana / Mês / Profissionais
      |      +--> filtros por profissional / serviço / status
      |
      +--> Operação do Dia
      +--> Smart Fit
      +--> Lista de Espera
      +--> Jornada da Equipe
      |
      +--> confirmação / lembretes / cancelamento / WhatsApp
```

```text
Estoque operacional
      |
      +--> Produtos / mínimo / custo / fornecedor
      +--> Entrada / Saída / Ajuste físico
      +--> Histórico por produto
      +--> Ruptura e estoque baixo
      +--> Plano de reposição
      +--> Capital imobilizado / venda potencial
```

```text
CRM e retenção
      |
      +--> Aniversário / Inatividade / Frequência
      +--> Motivos explicáveis por cliente
      +--> Histórico de atendimentos
      +--> Opt-in / Opt-out de marketing
      +--> Template ou fallback de follow-up
      +--> Abrir WhatsApp
              |
              +--> Auditoria de follow-up iniciado
              +--> Métrica de reativação em até 30 dias
```

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
        agenda/
        inventory/
        crm/
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
      inventory-operations.routes.ts
      twilio-whatsapp/
    services/
      whatsapp-agent/
      client-retention.service.ts
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
- capacidades, jornada, pausas e bloqueios de profissionais;
- central de Agenda comercial para `ADMIN`/`RECEPTION`;
- Agenda Enterprise com filtros combinados;
- criação rápida, reagendamento e validação de conflitos;
- Smart Fit, lista de espera e reaproveitamento de vagas;
- confirmação, cancelamento, lembretes e rastreamento WhatsApp;
- agente WhatsApp com fallback e handoff humano;
- CRM de clientes;
- **CRM de retenção** com segmentos explicáveis de aniversário, inatividade e frequência;
- histórico de até 50 atendimentos por cliente sob demanda;
- preferência de marketing registrada por `LgpdConsent`;
- opt-out bloqueando preparação de follow-up;
- templates de retenção com fallback local seguro;
- preparação de contato via deep-link do WhatsApp sem alegar envio automático;
- auditoria somente quando a equipe inicia o contato;
- métrica de reativação em até 30 dias após follow-up iniciado;
- **Estoque operacional** com entrada, saída e ajuste físico;
- bloqueio de saldo negativo e conciliação até zero;
- filtros, alertas de estoque baixo e ruptura;
- painel de reposição com quantidade e custo estimados;
- capital imobilizado, venda potencial e histórico por produto;
- financeiro, comissões e fidelidade;
- dashboard executivo;
- Super Admin separado do tenant;
- módulos/entitlements por salão;
- Site & Marca white-label por cliente;
- agente de IA com Groq e fallback local;
- auditoria, segurança e observabilidade;
- PWA.

## Marcos 1–19 concluídos

Os Marcos 1–15 encerraram o ciclo estrutural de higienização. O Marco 16 encerrou a primeira homologação funcional por papel. O Marco 17 tornou a Agenda o principal fluxo operacional. O Marco 18 tornou o Estoque utilizável para operação diária. O Marco 19 tornou o CRM utilizável para decisão de retenção e follow-up com consentimento e rastreabilidade.

Principais resultados acumulados:

- `AdminDashboard.jsx` decomposto por domínio;
- Agenda, Estoque e CRM de retenção em módulos operacionais dedicados;
- `buildApp()` extraído para testes HTTP com `Fastify.inject()`;
- agente WhatsApp e webhook Twilio modularizados;
- domínio comercial separado em CRM, financeiro, comissões, fidelidade, assinatura, templates e IA;
- zero `<style>` dentro de componentes JSX;
- zero `any` explícito em `backend/src`;
- repository hygiene impedindo regressões estruturais;
- RBAC alinhado entre frontend e backend;
- `SUPER_ADMIN` isolado da operação tenant;
- `PROFESSIONAL` sem acesso às mutações de Agenda, Estoque e CRM;
- Agenda comercial com jornada cliente → salão → WhatsApp;
- Estoque com trilha de movimentações, reposição e indicadores econômicos;
- CRM com segmentação explicável, consentimento, histórico, follow-up e reativação;
- documentação operacional por papel e por domínio.

Relatórios e guias:

- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md`](docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md)
- [`docs/usuario/10_AGENDA_COMERCIAL.md`](docs/usuario/10_AGENDA_COMERCIAL.md)
- [`docs/usuario/11_ESTOQUE_OPERACIONAL.md`](docs/usuario/11_ESTOQUE_OPERACIONAL.md)
- [`docs/usuario/12_CRM_RETENCAO.md`](docs/usuario/12_CRM_RETENCAO.md)

## Testes e qualidade

### Backend

**57 testes automatizados**, cobrindo entre outros:

- autenticação, RBAC e isolamento multi-tenant;
- validação Zod;
- Agenda comercial e conflitos;
- estoque operacional, reposição e conciliação;
- segmentação de retenção;
- aniversário, inatividade e frequência;
- histórico de cliente tenant-scoped;
- opt-out e evidência de consentimento;
- bloqueio de follow-up em opt-out;
- separação entre mensagem preparada e follow-up iniciado;
- Twilio e agente WhatsApp;
- fallbacks e handoff humano.

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build
```

### Frontend

**53 testes automatizados**, cobrindo:

- Agenda Enterprise e calendário;
- central comercial e filtros da Agenda;
- matriz de menu e endpoints por papel;
- Estoque operacional, filtros, reposição e histórico;
- filtros e indicadores do CRM de retenção;
- explicação de segmentação;
- bloqueio visual de follow-up em opt-out;
- preparação de mensagem;
- registro de follow-up somente ao abrir o WhatsApp;
- histórico de atendimentos sob demanda.

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

O smoke pós-deploy valida de forma read-only frontend, saúde do backend, salão público, catálogo e read model público de agendamentos.

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

## Segurança

- isolamento por `salonId` nas operações privadas;
- RBAC para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`;
- módulos contratados aplicados por tenant;
- validação Zod nas entradas HTTP;
- preferência de marketing persistida sem apagar histórico anterior;
- follow-up bloqueado quando o consentimento mais recente é opt-out;
- preparação de mensagem não é contabilizada como contato iniciado;
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

Após integração e smoke do Marco 19, o próximo marco oficial é o **Marco 20 — Assistente IA e WhatsApp em produção**, voltado a atendimento comercial confiável, ações confirmadas e automação segura por provider.

A sequência oficial está em [`ROADMAP.md`](ROADMAP.md).

## Convenção de desenvolvimento

O GlossFlow prioriza comentários que expliquem contratos, regras de segurança, decisões e fallbacks. Comentários redundantes linha a linha não são adicionados, porque aumentam ruído e ficam desatualizados rapidamente.
