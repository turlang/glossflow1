# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-12.

Este documento é a fonte canônica para a evolução do GlossFlow.

## Estado do produto

O GlossFlow está em **piloto comercial com produção ativa**.

Os **Marcos 1–21 estão concluídos e validados em produção**. O **Marco 22 — Observabilidade, performance e confiabilidade** está **CONCLUÍDO FUNCIONALMENTE NO PR #10**, aguardando merge e `Production Smoke Validation` para receber a marca oficial de produção.

Estado automatizado do head funcional do Marco 22:

- backend: **83/83 testes**;
- frontend: **58/58 testes**;
- `npm audit` backend/frontend: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- GlossFlow Quality Gate: **success**;
- Production Gate: **success**;
- bundle principal JS: aproximadamente **192,67 kB**, contra ~405,82 kB antes do Marco 22;
- budget de bundle: **success**.

---

# Ciclo concluído em produção — Marcos 1–21

## Marco 1 — Higienização estrutural inicial — CONCLUÍDO
Artefatos legados removidos, schema Prisma canônico, documentação e repository hygiene.

## Marco 2 — Decomposição do Admin — CONCLUÍDO
Dashboard dividido por domínio, lint e base técnica atualizados.

## Marco 3 — Agenda Enterprise e regras de data — CONCLUÍDO
Calendário isolado, datas locais e capacidade mensal corrigidas.

## Marco 4 — Componentização da Agenda — CONCLUÍDO
Toolbar, cards e visões separados.

## Marco 5 — Reagendamento acessível — CONCLUÍDO
Formulário explícito, persistência unificada e feedback de conflito/sucesso.

## Marco 6 — Tipagem e serviço de reagendamento backend — CONCLUÍDO
Serviço dedicado, payload estrito e sobreposição correta.

## Marco 7 — Fastify testável — CONCLUÍDO
`buildApp()` testável e bootstrap isolado.

## Marco 8 — Rotas de Agenda modularizadas — CONCLUÍDO
Público, gestão, lista de espera, admin, contratos e acesso separados.

## Marco 9 — Agente WhatsApp modularizado — CONCLUÍDO
Contratos, repositório, ferramentas, orquestrador e fallback seguro.

## Marco 10 — CSS administrativo + contratos do agente — CONCLUÍDO
Estilos extraídos e contratos protegidos por testes.

## Marco 11 — Webhook Twilio modularizado — CONCLUÍDO
Segurança, tenant, status e inbound separados.

## Marco 12 — Cobertura de regressão ampliada — CONCLUÍDO
Estoque, CRM, Twilio e agente protegidos.

## Marco 13 — Domínio comercial modularizado — CONCLUÍDO
CRM, financeiro, comissões, fidelidade, assinatura, templates e IA separados.

## Marco 14 — Documentação de usuário — CONCLUÍDO
Manuais, FAQ, curso, implantação e boas práticas.

## Marco 15 — Hygiene final — CONCLUÍDO
Gates permanentes e limpeza final da base.

## Marco 16 — Homologação funcional por papel — CONCLUÍDO
RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`.

## Marco 17 — Agenda comercial e jornada do cliente — CONCLUÍDO
Central de operação diária, Smart Fit, lista de espera, confirmações e comunicação.

## Marco 18 — Estoque operacional e reposição — CONCLUÍDO
Movimentação, conciliação, ruptura, histórico, capital e plano de reposição.

## Marco 19 — CRM, retenção e automações — CONCLUÍDO
Segmentação, histórico, consentimento, opt-out e follow-up.

## Marco 20 — Assistente IA e WhatsApp em produção — CONCLUÍDO
Base factual, confirmação server-side, handoff, política de janela/template e métricas.

## Marco 21 — Super Admin, planos e ciclo de vida SaaS — CONCLUÍDO
Provisionamento canônico, estados `TRIAL/ACTIVE/PAST_DUE/CANCELED`, módulos, billing preparado, white-label e auditoria. Merge de produção `8b8aa0f2a07061b84aaa72db96c1511dae62a369`; Quality Gate, Production Gate, Vercel e smoke verdes.

---

# Marco 22 — Observabilidade, performance e confiabilidade — CONCLUÍDO FUNCIONALMENTE NO PR

Objetivo funcional atingido: detectar e diagnosticar falhas de API, banco e providers com baixa cardinalidade, reduzir o custo inicial do frontend e preparar consultas multi-tenant para crescimento sem introduzir dependência obrigatória de serviço pago.

## Observabilidade HTTP

Entregue:

- correlação `X-Request-Id` em todas as respostas;
- janela bounded-memory para evitar crescimento irrestrito;
- normalização de ObjectId, UUID e IDs numéricos para `:id`;
- p50, p95, p99, média e máximo;
- taxa 4xx/5xx;
- requisições lentas;
- requisições ativas;
- memória RSS/heap;
- ranking de rotas por p95;
- erros recentes;
- exportação Prometheus.

## Readiness real

`/health` permanece liveness. `/ready` agora exige configuração mínima e `ping` real no MongoDB, retornando `503` se a aplicação não estiver pronta para tráfego.

O smoke permanente foi ampliado para exigir:

```text
/health -> ok=true
/ready  -> ok=true + database.ok=true
```

## Super Admin operacional

Novo read model protegido:

```text
GET /platform-admin/observability/overview
```

Consolida health score, SLOs, MongoDB, latência HTTP, erros, memória, contratos, sessões, auditorias, backups, dependências, providers e recomendações, sem expor tokens ou conteúdo sensível.

## Dependências e webhooks

Métricas adicionadas para:

- `mongodb/ping`;
- `ai-groq/responses` ou `ai-openai/responses`;
- `twilio-webhook/inbound-processing`;
- `twilio-webhook/status-callback`.

O ACK HTTP do Twilio continua rápido; processamento assíncrono é medido separadamente.

## Índices MongoDB

O bootstrap usa `createIndexes` idempotente e não destrutivo para consultas compostas críticas de sessões, serviços, profissionais, CRM, Agenda, lista de espera, estoque, financeiro, auditoria e backups.

Não há `prisma db push` automático no deploy. Falha isolada na criação de índice é registrada sem derrubar a API.

## Paginação

Novo contrato multi-tenant:

```text
GET /admin/clients/paginated?page=1&limit=50
```

Usa `skip/take`, count e metadados de navegação. O endpoint legado foi preservado para evitar quebra da UI atual.

## Performance frontend

Backoffice pesado separado com `React.lazy` + `Suspense`.

Resultado medido no CI:

- bundle principal anterior: ~405,82 kB;
- bundle principal atual: ~192,67 kB;
- redução aproximada: **52,5%**;
- `AdminDashboard`: ~89,77 kB em chunk próprio;
- `PlatformAdmin`: ~62,70 kB em chunk próprio.

Budget permanente de build:

```text
JS <= 320 kB por chunk
CSS <= 180 kB por arquivo
```

## SLOs iniciais

```text
OBSERVABILITY_SLOW_REQUEST_MS=750
OBSERVABILITY_SLO_P95_MS=750
OBSERVABILITY_SLO_ERROR_RATE_PCT=2
OBSERVABILITY_DEPENDENCY_SUCCESS_RATE_PCT=98
SYNC_MONGO_INDEXES=true
```

São limites operacionais do piloto, não SLA comercial.

## Runbook

Novo `docs/engineering/OBSERVABILITY.md` define liveness/readiness, métricas, correlação de request, severidade, incident response, índices e limitações.

## Limitações intencionais

- métricas bounded reiniciam com o processo;
- histórico de longo prazo exige coletor externo;
- Grafana/Datadog não são dependências obrigatórias;
- `SENTRY_DSN` continua opcional e não é apresentado como integração efetiva sem SDK externo;
- nenhuma mensagem WhatsApp real, cobrança ou mutação de cliente foi necessária para validação do marco.

## Cobertura funcional

- backend: **83/83 testes**;
- frontend: **58/58 testes**;
- audits: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- builds: **success**;
- Quality Gate: **success**;
- Production Gate: **success**.

Critério funcional atingido. A marca **validado em produção** depende do merge, Vercel/Render convergidos e `Production Smoke Validation` do `main` com readiness MongoDB.

---

# Próximo ciclo após a validação do Marco 22

## Marco 23 — Segurança e LGPD comercial — PRÓXIMO

Objetivo: fechar os controles de segurança e privacidade necessários para operação comercial repetível.

Escopo planejado:

- revisão final de RBAC e superfícies administrativas;
- trilha de auditoria e eventos sensíveis;
- retenção de dados;
- exportação e eliminação LGPD;
- sessões e refresh tokens;
- rate limits por superfície/tenant;
- secrets e configuração de produção;
- backup e restore testados;
- procedimento de incidente de segurança.

Critério de saída: a plataforma consegue responder a acesso, exportação, eliminação, incidente e recuperação sem intervenção improvisada no banco.

## Marco 24 — Release comercial estável — PLANEJADO

Critérios mínimos:

- Marcos 16–23 encerrados;
- checklist de produção completo;
- homologação desktop/mobile;
- Agenda, Estoque, CRM e WhatsApp reais validados;
- backup e recuperação documentados;
- Quality Gate verde;
- Production Gate verde;
- Production Smoke Validation verde;
- implantação e suporte atualizados.

Resultado esperado:

**GlossFlow apto a ser vendido e operado como SaaS multi-tenant com implantação repetível.**

---

# Prioridade de execução

```text
Marco 22 — fechamento de produção
   ↓
Marco 23 — Segurança / LGPD
   ↓
Marco 24 — Release comercial estável
```

## Regra de avanço

Um marco somente é considerado concluído em produção quando:

1. código e documentação estão atualizados;
2. testes relevantes estão verdes;
3. `GlossFlow Quality Gate` está verde;
4. `Production Gate` está verde quando houver impacto de produção;
5. smoke/homologação específica foi executada;
6. nenhuma regressão crítica conhecida permanece aberta.

## Referências

- [`README.md`](README.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/OBSERVABILITY.md`](docs/engineering/OBSERVABILITY.md)
- [`docs/usuario/14_SUPER_ADMIN_SAAS.md`](docs/usuario/14_SUPER_ADMIN_SAAS.md)
