# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-12.

Este documento é a fonte canônica para a evolução do GlossFlow. A Issue #19 é a evidência canônica de encerramento de produção do Marco 24 para evitar que um commit documental posterior altere novamente o SHA já homologado.

## Estado do produto

O GlossFlow está em **produção ativa e Release Candidate comercial**.

Os **Marcos 1–23 estão concluídos e validados em produção**. O **Marco 24 — Release comercial estável** está **CONCLUÍDO FUNCIONALMENTE / RELEASE CANDIDATE**, pendente exclusivamente de:

```text
merge PR #20
  ↓
Vercel + Render no SHA exato do merge
  ↓
/ready com MongoDB no mesmo build
  ↓
Production Smoke Validation final verde
  ↓
Issue #19 closed/completed
```

Quando essa sequência for cumprida, o Marco 24 é considerado **VALIDADO EM PRODUÇÃO** sem necessidade de novo commit documental.

---

# Ciclo concluído em produção — Marcos 1–23

## Marcos 1–15 — Fundação, higiene e modularização — CONCLUÍDOS

A base foi higienizada, modularizada e protegida por gates permanentes. Inclui Admin, Agenda Enterprise, backend testável, rotas modulares, agente WhatsApp, webhook, domínio comercial, documentação e hygiene final.

## Marco 16 — Homologação funcional por papel — CONCLUÍDO

RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`; Agenda do profissional permanece somente leitura enquanto não existe associação explícita `User ↔ Professional`.

## Marco 17 — Agenda comercial e jornada do cliente — CONCLUÍDO

Central de operação diária, Smart Fit, lista de espera, confirmações, conflitos e comunicação.

## Marco 18 — Estoque operacional e reposição — CONCLUÍDO

Movimentação, conciliação, ruptura, histórico, capital e plano de reposição.

## Marco 19 — CRM, retenção e automações — CONCLUÍDO

Segmentação, histórico, consentimento, opt-out e follow-up.

## Marco 20 — Assistente IA e WhatsApp — CONCLUÍDO

Base factual, confirmação server-side, handoff, política de janela/template e métricas.

## Marco 21 — Super Admin e ciclo de vida SaaS — CONCLUÍDO

Provisionamento, estados `TRIAL/ACTIVE/PAST_DUE/CANCELED`, módulos, billing preparado, white-label e auditoria.

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
- code splitting e budget permanente de bundle.

O incidente de deploy stale foi registrado e o smoke foi posteriormente endurecido para rejeitar build antigo.

## Marco 23 — Segurança e LGPD comercial — CONCLUÍDO E VALIDADO EM PRODUÇÃO

### Sessões e autenticação

- access token vinculado a `UserSession` via `sessionId`;
- sessão revogada/expirada invalida o token no servidor;
- usuário desativado deixa de autenticar;
- `role`, `email` e `salonId` revalidados contra persistência;
- token legado sem `sessionId` rejeitado em produção;
- refresh token rotacionado a cada uso;
- replay do refresh anterior rejeitado.

### Segurança comercial

- RBAC por papel preservado;
- rate limit por superfície/IP e tenant;
- auditoria correlacionada por `requestId`/`sessionId` sem body sensível;
- exportação LGPD tenant-safe;
- eliminação/anônimização com confirmação explícita;
- retenção manual/controlada;
- snapshot de backup assinado;
- restore guardado e desligado na operação normal.

### Validação final de produção

- PR #17 integrado;
- correção strict-smoke PR #18 integrada;
- commit validado: `afc22563d54645a8555cbafc53b1a9b6b31f2713`;
- Render: Build ID `afc22563d546`;
- `/health`: `ok=true`, header/body no mesmo Build ID;
- `/ready`: `ok=true`, mesmo Build ID e `database.ok=true`;
- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- Quality Gate: **success**;
- Production Gate: **success**;
- Production Smoke Validation estrito: **success**;
- Issue #14: **closed/completed**.

---

# Marco 24 — Release comercial estável — RELEASE CANDIDATE

Issue: #19. PR: #20.

Objetivo: transformar o produto tecnicamente maduro em uma release vendável e implantável de forma repetível, com decisão GO/NO-GO baseada em evidência.

## 1. Gate comercial — CONCLUÍDO

`PRODUCTION_CHECKLIST.md` diferencia:

- `AUTO-BLOCKER`;
- `MANUAL-TENANT`;
- `SANDBOX-EXTERNO`;
- `N/A`.

A release não pode ser declarada aprovada por suposição.

## 2. Matriz canônica de release — CONCLUÍDO

`docs/engineering/MARCO24_RELEASE_VALIDATION.md` concentra:

- baseline técnica;
- evidências;
- integrações;
- riscos;
- operações proibidas em homologação;
- critério GO/NO-GO;
- fechamento de produção.

## 3. Homologação pública desktop/mobile — CONCLUÍDA

Navegador real Chromium, sem login e sem escrita em produção.

Páginas:

- vitrine pública;
- booking;
- landing comercial.

Viewports:

- 1366×768;
- 1920×1080;
- 768×1024;
- 430×932;
- 360×800.

Resultado:

- **15/15 PASS**;
- HTTP 200 nas 15 combinações;
- nenhum overflow horizontal bloqueador;
- nenhum `pageerror`;
- nenhum erro visível de API;
- booking disponível;
- screenshots + `report.json` preservados como artefato de CI;
- runtime isolado de navegador auditado e sem vulnerabilidade bloqueadora.

Workflow endurecido: `Marco 24 Public Responsive Validation`.

## 4. Domínios críticos — REVALIDADOS

Baseline automatizada:

- backend **100/100**;
- frontend **61/61**;
- Agenda comercial e conflitos: cobertos;
- Estoque operacional: coberto;
- CRM/consentimento: coberto;
- IA/WhatsApp: contratos, webhook, idempotência e guards cobertos;
- Super Admin/provisionamento/lifecycle: cobertos;
- Segurança/LGPD/backup: cobertos sem operação destrutiva em produção.

Nenhuma mensagem WhatsApp real, eliminação LGPD, retenção destrutiva, restore, alteração de estoque ou criação de cliente/agendamento real foi usada para homologar a release.

## 5. Documentação de implantação e suporte — CONCLUÍDA

Revisados/atualizados:

- `README.md`;
- `ROADMAP.md`;
- `PRODUCTION_CHECKLIST.md`;
- `DEPLOY_RENDER_VERCEL.md`;
- `docs/RUNBOOK_OPERACIONAL.md`;
- `docs/usuario/07_CHECKLIST_IMPLANTACAO.md`;
- `docs/engineering/MARCO24_RELEASE_VALIDATION.md`.

Implantação de tenant agora separa release base, dados do cliente, provider externo, homologação e treinamento.

## 6. Integrações opcionais

Na readiness da baseline de entrada:

- OpenAI: connected;
- WhatsApp via Twilio Trial: connected;
- Deploy validável: connected;
- Mercado Pago: missing;
- Stripe: missing;
- Sentry: missing.

Interpretação:

- Mercado Pago/Stripe não bloqueiam plano sem billing automático integrado;
- Sentry permanece hardening opcional enquanto não fizer parte de SLA contratado;
- Twilio Trial é sandbox/trial, não linha definitiva do cliente;
- provider ausente nunca deve ser exibido como conectado.

## 7. P0/P1 — SEM BLOQUEIO CONHECIDO

Na revisão final do candidato, os únicos itens abertos no repositório são:

- Issue #19 — execução/fechamento do próprio Marco 24;
- PR #20 — Release Candidate.

Não existe issue conhecida aberta classificada como regressão P0/P1.

## 8. Decisão funcional

**GO PARA PROMOÇÃO.**

A release candidate atende os critérios funcionais, de segurança, documentação, responsividade e automação necessários para seguir ao deploy final.

## 9. Única pendência de encerramento

Após o merge do PR #20:

1. Quality Gate do `main` precisa ficar verde;
2. Production Gate do `main` precisa ficar verde;
3. Vercel precisa publicar o SHA do merge;
4. Render precisa servir exatamente os 12 primeiros caracteres desse SHA;
5. `/ready` precisa responder no mesmo build com `database.ok=true`;
6. `Production Smoke Validation` precisa ficar verde;
7. Issue #19 é fechada como `completed` com as evidências.

### Critério de saída

Quando os sete itens acima estiverem satisfeitos:

**GlossFlow = Release Comercial Estável, apto a ser vendido e operado como SaaS multi-tenant com implantação repetível, sem regressão crítica conhecida e com evidência rastreável do build de produção.**