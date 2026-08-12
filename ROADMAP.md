# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-12.

Este documento é a fonte canônica para a evolução do GlossFlow.

## Estado do produto

O GlossFlow está em **produção ativa e fechamento de release comercial estável**.

Os **Marcos 1–23 estão concluídos e validados em produção**. O **Marco 24 — Release comercial estável** está **EM EXECUÇÃO** na Issue #19 e na branch `feature/marco24-release-commercial`.

Baseline de entrada do Marco 24:

- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- `npm audit` backend/frontend: sem vulnerabilidade bloqueadora conhecida;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- Quality Gate: **success**;
- Production Gate: **success**;
- Vercel: **READY**;
- Render servindo exatamente `afc22563d546`;
- `/health`: Build ID correto no header e body;
- `/ready`: mesmo Build ID e `database.ok=true`;
- `Production Smoke Validation` estrito: **success** no workflow `31639887820` após rerun;
- Issue #14 do Marco 23: **closed/completed**.

---

# Ciclo concluído em produção — Marcos 1–23

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
RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`; Agenda do profissional permanece somente leitura enquanto não existe associação explícita `User ↔ Professional`.

## Marco 17 — Agenda comercial e jornada do cliente — CONCLUÍDO
Central de operação diária, Smart Fit, lista de espera, confirmações e comunicação.

## Marco 18 — Estoque operacional e reposição — CONCLUÍDO
Movimentação, conciliação, ruptura, histórico, capital e plano de reposição.

## Marco 19 — CRM, retenção e automações — CONCLUÍDO
Segmentação, histórico, consentimento, opt-out e follow-up.

## Marco 20 — Assistente IA e WhatsApp em produção — CONCLUÍDO
Base factual, confirmação server-side, handoff, política de janela/template e métricas.

## Marco 21 — Super Admin, planos e ciclo de vida SaaS — CONCLUÍDO
Provisionamento canônico, estados `TRIAL/ACTIVE/PAST_DUE/CANCELED`, módulos, billing preparado, white-label e auditoria.

## Marco 22 — Observabilidade, performance e confiabilidade — CONCLUÍDO

Entregue:

- `X-Request-Id` e Build ID rastreável;
- `/health` para liveness;
- `/ready` com ping real do MongoDB;
- p50/p95/p99, erros, slow requests, memória e métricas por dependência;
- exportação Prometheus;
- painel global de observabilidade para `SUPER_ADMIN`;
- instrumentação de IA, MongoDB e webhooks;
- índices MongoDB idempotentes;
- paginação CRM;
- `React.lazy`/`Suspense` para backoffice;
- bundle principal reduzido e budget permanente de bundle.

Validação final do Marco 22:

- backend: **83/83 testes**;
- frontend: **58/58 testes**;
- build servido: `f61ba1268bb135d1e5cab4f85bf28acfb011d196`;
- `/health` e `/ready` rastreáveis;
- MongoDB ready;
- gates e smoke verdes.

O incidente de deploy stale foi registrado na Issue #13 e encerrado somente depois do Render servir o build correto.

## Marco 23 — Segurança e LGPD comercial — CONCLUÍDO E VALIDADO EM PRODUÇÃO

Objetivo atingido: responder a revogação de acesso, direitos do titular, retenção, incidente e recuperação sem depender de edição improvisada no banco e sem operações destrutivas silenciosas.

### Sessões e autenticação

- access token vinculado a `UserSession` via `sessionId`;
- sessão revogada/expirada invalida o token imediatamente no servidor;
- usuário desativado deixa de autenticar;
- `role`, `email` e `salonId` são revalidados contra persistência;
- token legado sem `sessionId` é rejeitado em produção;
- refresh token é rotacionado a cada uso;
- replay do refresh anterior é rejeitado.

### RBAC

Contrato preservado:

- `SUPER_ADMIN`: plataforma e tenants;
- `ADMIN`: operação do próprio salão + Segurança/LGPD;
- `RECEPTION`: operação comercial sem superfície crítica de Segurança;
- `PROFESSIONAL`: escopo restrito e Agenda somente leitura.

### Auditoria sensível

Mutações administrativas registram ação, recurso, path, IP/user-agent, `requestId`, `sessionId`, status HTTP e outcome sem persistir valores sensíveis do body.

### LGPD

Exportação tenant-safe e eliminação/anônimização protegida por confirmação explícita. Atendimento histórico é preservado sem PII quando aplicável; fila, fidelidade, consentimentos e perfil são tratados conforme contrato do serviço.

### Retenção

Política explícita e manual/controlada:

```text
SESSION_RECORD_RETENTION_DAYS=30
WHATSAPP_CONTENT_RETENTION_DAYS=180
AUDIT_LOG_RETENTION_DAYS=730
BACKUP_METADATA_RETENTION_DAYS=180
```

Execução exige preview e `APLICAR RETENCAO`; nenhum cron destrutivo foi ativado silenciosamente.

### Rate limit

Limites por IP/superfície e por tenant autenticado, com `429`, `Retry-After` e código `RATE_LIMITED`.

### Backup e restore

Snapshot `glossflow-tenant-backup/v1` assinado por HMAC SHA-256. Restore valida schema/tenant/assinatura, fica bloqueado por `BACKUP_RESTORE_ENABLED=false` na operação normal e exige confirmação explícita quando habilitado.

### Validação final de produção

- PR #17 integrado;
- correção do smoke exato integrada pelo PR #18;
- commit atual validado: `afc22563d54645a8555cbafc53b1a9b6b31f2713`;
- Render: Build ID `afc22563d546`;
- `/health`: `ok=true`, header/body no mesmo Build ID;
- `/ready`: `ok=true`, Build ID idêntico, `database.ok=true`;
- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- Quality Gate: **success**;
- Production Gate: **success**;
- Production Smoke Validation estrito: **success**;
- Issue #14: **closed/completed**.

Nenhum cliente real foi apagado, nenhum restore real foi executado e nenhuma mensagem WhatsApp real foi enviada para obter essa evidência.

---

# Ciclo atual — Marco 24

## Marco 24 — Release comercial estável — EM EXECUÇÃO

Issue: #19.

Objetivo: fechar o GlossFlow para venda e implantação repetível como SaaS multi-tenant.

### Entregas obrigatórias

1. **Gate comercial formal**
   - `PRODUCTION_CHECKLIST.md` passa a diferenciar `AUTO-BLOCKER`, `MANUAL-TENANT`, `SANDBOX-EXTERNO` e `N/A`.
   - toda decisão GO/NO-GO precisa de evidência rastreável.

2. **Matriz de release**
   - `docs/engineering/MARCO24_RELEASE_VALIDATION.md` concentra baseline, riscos, integrações, proibições de homologação e critério de saída.

3. **Homologação pública desktop/mobile**
   - vitrine pública;
   - agendamento;
   - landing comercial;
   - 1366×768;
   - 1920×1080;
   - tablet vertical;
   - celular grande;
   - celular pequeno;
   - navegador real, sem login e sem escrita em produção.

4. **Revalidação dos domínios críticos**
   - Agenda;
   - Estoque;
   - CRM;
   - IA/WhatsApp;
   - Super Admin/provisionamento/lifecycle;
   - Segurança/LGPD/backup.

5. **Documentação de implantação e suporte**
   - deploy;
   - checklist por tenant;
   - operação;
   - incidente;
   - recuperação;
   - responsabilidades de sandbox/provider.

6. **Fechamento de produção**
   - Quality Gate verde;
   - Production Gate verde;
   - Vercel `READY` no SHA final;
   - Render no Build ID exato do SHA final;
   - `/ready` com MongoDB;
   - Production Smoke Validation verde;
   - nenhuma regressão P0/P1 aberta.

### Integrações opcionais

Mercado Pago e Stripe não bloqueiam a release base se cobrança automática não fizer parte do plano vendido. Sentry permanece hardening opcional enquanto não integrar SLA contratado. Providers ausentes nunca podem ser apresentados como conectados.

### Regra de segurança da homologação

Sem autorização explícita, não usar dados reais para:

- criar/editar cliente QA;
- alterar estoque;
- criar agendamento;
- enviar WhatsApp;
- executar LGPD erase;
- rodar retenção destrutiva;
- restaurar backup;
- mudar lifecycle/plano de tenant.

Usar automação, fixtures, mocks, read-only smoke e sandbox autorizado.

### Critério de saída

**GlossFlow apto a ser vendido e operado como SaaS multi-tenant com implantação repetível, sem regressão crítica conhecida e com evidência rastreável do build de produção.**

---

# Prioridade de execução

```text
Marco 23 — VALIDADO EM PRODUÇÃO
   ↓
Marco 24 — RELEASE COMERCIAL ESTÁVEL — EM EXECUÇÃO
```

## Regra de avanço

Um marco somente é considerado concluído em produção quando:

1. código e documentação estão atualizados;
2. testes relevantes estão verdes;
3. `GlossFlow Quality Gate` está verde;
4. `Production Gate` está verde quando houver impacto de produção;
5. deploy serve o Build ID esperado;
6. smoke/homologação específica foi executada;
7. nenhuma regressão crítica conhecida permanece aberta.

## Referências

- [`README.md`](README.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`DEPLOY_RENDER_VERCEL.md`](DEPLOY_RENDER_VERCEL.md)
- [`docs/RUNBOOK_OPERACIONAL.md`](docs/RUNBOOK_OPERACIONAL.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/OBSERVABILITY.md`](docs/engineering/OBSERVABILITY.md)
- [`docs/engineering/SECURITY_LGPD.md`](docs/engineering/SECURITY_LGPD.md)
- [`docs/engineering/MARCO24_RELEASE_VALIDATION.md`](docs/engineering/MARCO24_RELEASE_VALIDATION.md)
- [`docs/usuario/07_CHECKLIST_IMPLANTACAO.md`](docs/usuario/07_CHECKLIST_IMPLANTACAO.md)
- [`docs/usuario/14_SUPER_ADMIN_SAAS.md`](docs/usuario/14_SUPER_ADMIN_SAAS.md)
- [`docs/usuario/15_SEGURANCA_LGPD.md`](docs/usuario/15_SEGURANCA_LGPD.md)