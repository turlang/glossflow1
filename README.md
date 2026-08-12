# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza vitrine pública, Agenda, CRM, Estoque, financeiro, fidelidade, automações, WhatsApp, IA e operação comercial da própria plataforma.

## Estado atual

O projeto está em **piloto comercial com ambiente de produção ativo**.

Os **Marcos 1–21 estão concluídos e validados em produção**. O **Marco 22 — Observabilidade, performance e confiabilidade** está **concluído funcionalmente no PR #10**, aguardando merge e smoke pós-deploy para receber a validação oficial de produção.

Estado automatizado do Marco 22:

- backend: **83/83 testes**;
- frontend: **58/58 testes**;
- `npm audit --audit-level=high`: **0 vulnerabilidades** no backend e frontend;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- Quality Gate do head funcional: **success**;
- Production Gate do head funcional: **success**;
- bundle principal JS reduzido de aproximadamente **405,82 kB para 192,67 kB**;
- orçamento permanente de bundle aplicado no build.

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
- preparação de billing para Mercado Pago, Stripe, manual ou outro provider
- endpoint Prometheus para coleta opcional de métricas

## Marco 22 — Observabilidade, performance e confiabilidade

### Observabilidade HTTP

A API possui uma janela de métricas bounded-memory com baixa cardinalidade. IDs MongoDB, UUIDs e segmentos numéricos longos são normalizados antes da agregação.

São medidos:

- requisições ativas;
- respostas 4xx e 5xx;
- taxa de erro 5xx;
- latência média, p50, p95, p99 e máxima;
- requisições lentas;
- rotas mais lentas;
- consumo de memória;
- erros recentes;
- dependências externas e internas monitoradas.

Toda resposta recebe `X-Request-Id`, usado para correlacionar erro HTTP e logs do Render.

### Liveness e readiness

- `GET /health`: liveness do processo Node;
- `GET /ready`: valida configuração mínima e executa `ping` real no MongoDB;
- `GET /metrics`: exportação Prometheus de baixa cardinalidade.

O `Production Smoke Validation` do Marco 22 também verifica `/ready` e exige `database.ok=true` depois do deploy.

### Painel operacional do Super Admin

`GET /platform-admin/observability/overview` é exclusivo do `SUPER_ADMIN` e consolida:

- health score;
- probe MongoDB;
- p50/p95/p99;
- taxa 5xx;
- rotas lentas;
- memória do processo;
- contratos, sessões, auditorias e backups;
- estado público de IA/WhatsApp sem expor tokens;
- dependências degradadas;
- alertas e recomendações operacionais.

### Providers e webhooks

- Groq/OpenAI: latência, status e falha da chamada externa;
- MongoDB: resultado e latência do `ping` de readiness;
- Twilio: processamento assíncrono de inbound e status callback medido separadamente do ACK HTTP.

Prompts, API keys, tokens, conteúdo completo de conversas e dados sensíveis não são adicionados às métricas.

### Índices MongoDB

O bootstrap sincroniza índices compostos idempotentes com `createIndexes`, sem `db push` destrutivo, para caminhos críticos de:

- sessões;
- serviços e profissionais ativos;
- CRM;
- Agenda;
- lista de espera;
- estoque;
- financeiro;
- auditoria;
- backups.

`SYNC_MONGO_INDEXES=false` existe apenas para diagnóstico. Falha isolada na criação de índice é registrada sem derrubar a API.

### Paginação e crescimento de dados

O CRM ganhou o read model:

```text
GET /admin/clients/paginated?page=1&limit=50
```

Ele aplica `skip/take`, contagem total e isolamento por tenant, preservando o endpoint legado para compatibilidade com a interface atual.

### Performance frontend

As áreas pesadas do backoffice passaram a usar `React.lazy` + `Suspense`.

Medição no CI do Marco 22:

- bundle principal antes: aproximadamente **405,82 kB**;
- bundle principal após code splitting: aproximadamente **192,67 kB**;
- redução: aproximadamente **52,5%**;
- `AdminDashboard`: chunk próprio de aproximadamente 89,77 kB;
- `PlatformAdmin`: chunk próprio de aproximadamente 62,70 kB.

O build agora falha se um chunk JS ultrapassar 320 kB ou o CSS ultrapassar 180 kB, salvo alteração deliberada dos budgets.

### SLOs operacionais iniciais

Defaults documentados:

```text
OBSERVABILITY_SLOW_REQUEST_MS=750
OBSERVABILITY_SLO_P95_MS=750
OBSERVABILITY_SLO_ERROR_RATE_PCT=2
OBSERVABILITY_DEPENDENCY_SUCCESS_RATE_PCT=98
SYNC_MONGO_INDEXES=true
```

Esses valores são limites operacionais iniciais do piloto e não representam SLA comercial contratual.

## Limitações intencionais

- métricas HTTP/dependência ficam em memória bounded e reiniciam junto com o processo;
- histórico de longo prazo depende de coleta externa de `/metrics` e/ou logs;
- o projeto não cria dependência obrigatória de Grafana, Datadog ou serviço pago;
- `SENTRY_DSN` continua opcional e não é tratado como integração real enquanto não houver SDK externo efetivamente configurado;
- nenhuma mensagem WhatsApp real ou alteração de dados de cliente foi necessária para validar o Marco 22.

## Testes e qualidade

### Backend

**83/83 testes automatizados**, incluindo cobertura dedicada para métricas, percentis, normalização de rotas, request ID, RBAC da observabilidade, plano de índices e paginação CRM multi-tenant.

### Frontend

**58/58 testes automatizados**, com build incluindo orçamento de bundle.

Workflows permanentes:

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
- [`docs/usuario/14_SUPER_ADMIN_SAAS.md`](docs/usuario/14_SUPER_ADMIN_SAAS.md)

## Próximo marco após a validação de produção

**Marco 23 — Segurança e LGPD comercial**.

A sequência canônica está em [`ROADMAP.md`](ROADMAP.md).
