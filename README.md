# GlossFlow Enterprise

SaaS para salões de beleza, barbearias e clínicas de estética, com foco em gestão operacional, relacionamento com clientes, agendamento online, financeiro, automações e estrutura multiempresa.

## Visão geral

O GlossFlow foi criado para centralizar a rotina de negócios de beleza em uma única plataforma: vitrine pública, agenda, serviços, profissionais, clientes, estoque, financeiro, comissões, fidelidade, templates de WhatsApp, automações e painéis administrativos.

Este projeto demonstra construção de produto SaaS Full Stack, com arquitetura pensada para múltiplos estabelecimentos, autenticação, regras de negócio e experiência premium.

## Principais funcionalidades

- Vitrine pública do salão.
- Agendamento online.
- Login administrativo.
- Cadastro de serviços.
- Gestão de profissionais.
- Portfólio do salão.
- CRM de clientes.
- Controle de estoque.
- Financeiro.
- Comissão por profissional.
- Programa de fidelidade.
- Planos e assinatura SaaS.
- Templates de WhatsApp.
- Central de automações.
- Dashboard executivo.
- Multiempresa via `salonId`.
- Observabilidade e health score.
- Integrações preparadas para OpenAI, WhatsApp, Mercado Pago, Stripe, Google Calendar, Cloudinary, Sentry e Meta Ads.

## Stack

### Front-end

- React
- Vite
- CSS próprio / Design System
- PWA básico

### Back-end

- Node.js
- Fastify
- TypeScript
- JWT
- Zod

### Banco de dados

- MongoDB
- Prisma ORM

### Infraestrutura e integrações

- Render
- Vercel
- MongoDB Atlas
- OpenAI opcional
- WhatsApp API opcional
- Mercado Pago / Stripe preparados
- Google Calendar preparado

## Arquitetura resumida

```text
frontend/
  src/
  public/
  .env.example

backend/
  src/
  prisma/
  scripts/
  .env.example
```

O sistema é separado em front-end e back-end, com API própria, autenticação por token, persistência em MongoDB e estrutura preparada para múltiplos salões.

## Como executar

### Back-end

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

### Front-end

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Login de teste

```text
E-mail: admin@glossflow.com
Senha: 123456
```

> Troque a senha antes de qualquer uso real.

## Qualidade e produção

Arquivos importantes:

- `QUALITY_GATE.md`
- `PRODUCTION_CHECKLIST.md`
- `QA_TEST_PLAN.md`
- `COMO_USAR_GLOSSFLOW.md`

## Diferenciais técnicos

- Arquitetura SaaS com multiempresa.
- Backend em TypeScript.
- Prisma com MongoDB.
- Autenticação com perfis de acesso.
- Módulos de negócio reais.
- Dashboard executivo.
- Preparação para integrações externas.
- Documentação de uso, QA e produção.

## Status

Candidato de produção para piloto comercial e demonstração profissional.

## Próximas melhorias

- Conectar envio real de WhatsApp.
- Finalizar integrações externas.
- Ampliar testes automatizados.
- Adicionar screenshots ao README.
- Publicar demonstração estável.

## Posicionamento no portfólio

Este é o principal projeto de empregabilidade do portfólio, por demonstrar domínio de produto SaaS Full Stack, arquitetura, UX, back-end, banco de dados e regras de negócio reais.
