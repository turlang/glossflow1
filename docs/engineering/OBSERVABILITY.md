# GlossFlow — Runbook de Observabilidade e Confiabilidade

Este documento define a operação técnica do Marco 22. O objetivo é detectar degradações antes do relato do cliente e oferecer evidência suficiente para diagnosticar API, banco, IA e webhooks sem registrar segredos ou conteúdo sensível.

## Sinais principais

### Liveness

`GET /health`

Confirma que o processo Node está aceitando requisições. Não consulta MongoDB e não deve ser usado sozinho para decidir se a aplicação está pronta para tráfego.

### Readiness

`GET /ready`

Valida configuração mínima e executa `ping` real no MongoDB. Retorna `503` quando `DATABASE_URL`, `JWT_SECRET` ou o banco impedem a operação.

### Prometheus

`GET /metrics`

Expõe métricas de baixa cardinalidade, entre elas:

- uptime;
- requisições ativas;
- total e erros 5xx na janela atual;
- p95/p99 global;
- RSS do processo;
- volume, erros e p95 por rota normalizada;
- volume, falhas e p95 por dependência medida.

IDs MongoDB, UUIDs e segmentos numéricos longos são convertidos para `:id` antes da agregação. Isso impede explosão de séries por recurso individual.

## Painel global do Super Admin

`GET /platform-admin/observability/overview`

Requer JWT `SUPER_ADMIN`. A resposta consolida:

- health score e estado operacional;
- probe do MongoDB;
- p50/p95/p99 e taxa 5xx;
- rotas mais lentas;
- erros recentes com request ID;
- memória do processo;
- salões, contratos, sessões, auditorias e backups;
- dependências medidas;
- configuração pública de IA/WhatsApp sem tokens;
- alertas e recomendações.

## Correlação de requisição

Toda resposta recebe `X-Request-Id`. Em incidente, registre esse valor e procure o mesmo identificador nos logs do Render. Erros 5xx e slow requests incluem request ID, método, rota e latência.

Nunca adicionar ao log:

- JWT ou refresh token;
- senha;
- API key;
- `TWILIO_AUTH_TOKEN`;
- conteúdo completo de conversas;
- payload LGPD de cliente.

## SLOs iniciais

Defaults configuráveis:

```text
OBSERVABILITY_SLOW_REQUEST_MS=750
OBSERVABILITY_SLO_P95_MS=750
OBSERVABILITY_SLO_ERROR_RATE_PCT=2
OBSERVABILITY_DEPENDENCY_SUCCESS_RATE_PCT=98
```

Estes números são limites operacionais iniciais para o piloto, não uma promessa contratual de SLA. Devem ser recalibrados com tráfego real.

## Severidade

### Crítico

- `/ready` retorna `503` por indisponibilidade do MongoDB;
- taxa 5xx acima do SLO;
- falha contínua que impede Agenda, autenticação ou canal de atendimento.

Ação: correlacionar request IDs, verificar Render/MongoDB e impedir mudanças não relacionadas até estabilização.

### Atenção

- p95 acima do SLO;
- provider abaixo da taxa de sucesso configurada;
- crescimento persistente de memória;
- processamento assíncrono Twilio falhando.

Ação: identificar rota/dependência dominante, confirmar repetição e atacar consulta, índice ou provider antes de adicionar cache.

## Dependências medidas

### MongoDB

O `/ready` registra `mongodb/ping` com latência e resultado.

### IA

Chamadas Groq/OpenAI registram latência, status e falha sem gravar prompt, chave ou raciocínio privado.

### Webhooks Twilio

O ACK HTTP continua rápido. O processamento assíncrono de inbound e callback de status é medido separadamente como `twilio-webhook`.

## Índices MongoDB

O bootstrap executa `createIndexes` idempotente para consultas compostas frequentes:

- sessões por tenant/estado/expiração;
- serviços/profissionais ativos por tenant;
- cliente por tenant/telefone;
- Agenda por tenant/data, profissional/data e status/data;
- lista de espera por tenant/status/data;
- estoque e movimentos;
- financeiro por data;
- auditoria e backup por data.

`SYNC_MONGO_INDEXES=false` desativa somente a sincronização automática para diagnóstico. Não é recomendado em produção normal.

A criação de índice não apaga dados e uma falha isolada é registrada sem impedir o processo de iniciar.

## Frontend

Áreas administrativas são carregadas via `React.lazy`, separando a vitrine/booking do backoffice pesado. O build executa orçamento permanente:

```text
BUNDLE_MAX_JS_KB=320
BUNDLE_MAX_CSS_KB=180
```

Qualquer chunk que ultrapasse o limite faz `npm run build` falhar no CI. Os limites podem ser reduzidos de forma deliberada conforme a base for otimizada.

## Resposta a incidente

1. confirmar `/health` e `/ready`;
2. coletar `X-Request-Id` de uma falha reproduzível;
3. consultar o overview global e `/metrics`;
4. verificar se o problema é API, MongoDB ou provider;
5. identificar p95/5xx da rota envolvida;
6. revisar o deploy/commit atual;
7. aplicar correção mínima e validar Quality Gate + Production Gate;
8. confirmar `Production Smoke Validation` após merge.

## Limitações intencionais

- métricas HTTP/dependência ficam em memória bounded e reiniciam junto com o processo;
- o endpoint Prometheus permite coleta externa, mas o Marco 22 não obriga contratação de Grafana/Datadog;
- `SENTRY_DSN` continua opcional e só deve ser considerado integração real quando o SDK externo estiver efetivamente configurado;
- para histórico de longo prazo, um coletor externo deve consumir `/metrics` e logs da plataforma.
