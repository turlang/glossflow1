# GlossFlow — Arquitetura Atual

## Visão geral

O GlossFlow é um SaaS multi-tenant white-label. O frontend React/Vite é publicado separadamente da API Fastify/TypeScript. O MongoDB é acessado via Prisma e cada tenant é isolado por `salonId`.

```text
Cliente / equipe
      |
      v
React + Vite (Vercel)
      |
      v
Fastify + TypeScript (Render)
      |
      +--> MongoDB Atlas / Prisma
      +--> Groq (IA)
      +--> Twilio WhatsApp
```

## Backend

```text
backend/
  prisma/              schema e seed canônicos
  scripts/             tarefas operacionais explícitas
  src/
    lib/                clientes técnicos compartilhados
    middlewares/        autenticação e concerns HTTP transversais
    routes/             contratos HTTP e composição de endpoints
    services/           regras de negócio e integrações
    server.ts           bootstrap da aplicação
  tests/                testes automatizados
```

### Fluxo HTTP

`server.ts` configura parsers, CORS, segurança, observabilidade e tratamento de erro. `routes/appRoutes.ts` registra as rotas públicas e cria escopos de autorização para Super Admin e operação de tenant.

### Multi-tenant

- tenant público: slug/subdomínio/custom domain;
- tenant autenticado: `salonId` do JWT;
- consultas privadas devem incluir `salonId`;
- `SUPER_ADMIN` administra a plataforma e não deve assumir implicitamente um tenant.

## Frontend

```text
frontend/src/
  components/
    admin/              experiência administrativa
    commercial/         landing/comercial
    public/             vitrine e agendamento
    ui/                 componentes compartilhados
  config/               configuração estática de navegação/aplicação
  services/             acesso HTTP e loaders de dados
  utils/                funções puras e utilitários
  App.jsx               composição principal
  main.jsx              bootstrap React/PWA
```

A meta de organização é impedir que `App.jsx` e componentes de painel acumulem autenticação, autorização, acesso a dados, regra de negócio e apresentação no mesmo arquivo.

## Agenda

A disponibilidade pública e administrativa deve passar pelas mesmas regras de serviço, capacidade profissional, jornada, bloqueios e conflitos. Alterações de horário são validadas novamente no backend.

## WhatsApp

O provider ativo é configurável. O fluxo atual usa Twilio:

```text
WhatsApp -> Twilio -> /webhooks/whatsapp/twilio -> GlossFlow
GlossFlow -> Twilio Messages API -> WhatsApp
                         |
                         +-> /webhooks/whatsapp/twilio/status
```

O webhook de entrada valida `X-Twilio-Signature`. O callback de status diferencia solicitação aceita de entrega real (`sent`, `delivered`, `read`, `failed`, `undelivered`).

## IA

`AI_PROVIDER` define o provider; Groq é o principal na configuração atual. O código de negócio chama uma camada de provider em vez de acoplar cada fluxo diretamente ao SDK/API externa.

## Infraestrutura canônica

- `render.yaml`: blueprint canônico do backend.
- `frontend/vercel.json`: configuração do frontend.
- `Dockerfile` e `docker-compose.yml`: execução reproduzível local/alternativa.
- `backend/.env.example` e `frontend/.env.example`: contratos de configuração.

Arquivos históricos, duplicados ou restauradores antigos não devem ficar na raiz nem substituir código atual.
