# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-14.

Este documento é a fonte canônica da evolução do GlossFlow. O ciclo atual é acompanhado na **Issue #29 — Marco 36: Homologação comercial e higiene pós-Marco 35**.

## Estado do produto

O GlossFlow está em **produção ativa**. Os Marcos 1–24 consolidaram a fundação comercial; os Marcos 25–34 ampliaram o catálogo operacional; o **Marco 35 foi concluído e validado em produção** no SHA `42804f4d9e047684f2d84c5fb5e3e82f5ed7059e`.

O fechamento do Marco 35 confirmou Quality Gate, Production Gate, Vercel, Render no SHA exato, `/ready` com MongoDB e Production Smoke integralmente verde. A Issue #28 foi encerrada como `completed`.

O **Marco 36** começa sem alterar essa baseline de produção: primeiro sincroniza documentação e higiene do repositório em branch própria; depois conduz homologação comercial dos módulos que continuam `VALIDATION_REQUIRED`.

---

# Ciclo 1 — Fundação comercial — Marcos 1–24

## Marcos 1–15 — Fundação, higiene e modularização — CONCLUÍDOS

Base full-stack higienizada, rotas e serviços modularizados, Admin/Agenda estruturados, testes, gates permanentes, documentação, manuais e redução da dívida estrutural inicial.

## Marco 16 — Homologação funcional por papel — CONCLUÍDO

RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`, com Agenda read-only para PROFESSIONAL e separação explícita de permissões de operação.

## Marco 17 — Agenda comercial — CONCLUÍDO

Agenda operacional, Smart Fit, lista de espera, conflitos, reagendamento, confirmação, comunicação e jornada diária da equipe.

## Marco 18 — Estoque — CONCLUÍDO

Entradas, saídas, ajustes, conciliação, mínimo/ruptura, histórico e reposição.

## Marco 19 — CRM e retenção — CONCLUÍDO

Cadastro, histórico, segmentação, consentimento, opt-out, follow-up e retenção.

## Marco 20 — IA e WhatsApp — BASE FUNCIONAL CONCLUÍDA

Base factual, confirmação server-side, handoff, janela/template, webhook, métricas e guards. Sender definitivo continua dependente de provider homologado por tenant.

## Marco 21 — Super Admin e ciclo de vida SaaS — CONCLUÍDO

Provisionamento, `TRIAL/ACTIVE/PAST_DUE/CANCELED`, módulos/entitlements, white-label, billing preparado e auditoria.

## Marco 22 — Observabilidade e confiabilidade — CONCLUÍDO

`X-Request-Id`, Build ID, `/health`, `/ready`, readiness MongoDB, métricas, Prometheus, painel global, índices e budgets de performance.

## Marco 23 — Segurança e LGPD — CONCLUÍDO E VALIDADO

Sessões revogáveis, refresh rotation, RBAC, rate limit, auditoria, LGPD export/anonymization, retenção controlada, backup assinado e restore guardado.

## Marco 24 — Release comercial estável — CONCLUÍDO

A release consolidou o fluxo permanente:

```text
Quality Gate
  ↓
Production Gate
  ↓
Vercel + Render no SHA exato
  ↓
/ready + MongoDB no mesmo build
  ↓
Production Smoke Validation
```

---

# Ciclo 2 — Expansão comercial — Marcos 25–34

## Marco 25 — PDV / Checkout — IMPLEMENTADO

Vendas, itens, múltiplos pagamentos, baixa de estoque, receita e estorno.

## Marco 26 — Pacotes, Assinaturas e Gift Cards — IMPLEMENTADO

Ofertas, créditos, validade, memberships e gift cards.

## Marco 27 — Compras e Fornecedores — IMPLEMENTADO

Fornecedores, pedidos, recebimento, estoque/custo e integração com contas a pagar.

## Marco 28 — Equipe, Ponto, Metas e Folha — IMPLEMENTADO

Ponto, metas, folha operacional e regras de período.

## Marco 29 — Clínico / Prontuário — IMPLEMENTADO

Anamnese, tratamento/evolução, alergias, consentimento e vínculo ao atendimento.

## Marco 30 — Marketing 360 — IMPLEMENTADO / EVOLUÇÃO PENDENTE

Campanhas, cupons, avaliações e audiência consentida. Worker/provider de entrega, scheduler, gatilhos e métricas de conversão ainda são evolução explícita.

## Marco 31 — Portal do Cliente — IMPLEMENTADO

Token aleatório com SHA-256 persistido, expiração, revogação, rotação e visão tenant/client-scoped.

## Marco 32 — Multiunidade / Redes — IMPLEMENTADO / EVOLUÇÃO PENDENTE

Convite HMAC, expiração, aceite por ADMIN, saída/revogação e ausência de compartilhamento operacional implícito. Dashboards corporativos dependem de política de acesso explícita.

## Marco 33 — Recursos Físicos — IMPLEMENTADO

Salas, cadeiras, macas, equipamentos, capacidade, reservas e integração com Agenda/checkout.

## Marco 34 — Financeiro Avançado / Fiscal — IMPLEMENTADO / EVOLUÇÃO PENDENTE

Centros de custo, caixa, contas, liquidação, conciliação, sincronização de compras e evidência fiscal. NFS-e legal continua dependente de provider autorizado.

---

# Marco 35 — Consolidação e Homologação dos 19 módulos — CONCLUÍDO

Issue canônica encerrada: **#28**.

SHA de produção homologado:

```text
42804f4d9e047684f2d84c5fb5e3e82f5ed7059e
```

## Etapa 1 — Matriz canônica de maturidade — CONCLUÍDA

`backend/src/services/module-readiness.service.ts` registra estado e maturidade dos 19 módulos.

## Etapa 2 — Homologação transacional — CONCLUÍDA

`GET /admin/homologation/transactional` cobre PDV, Estoque, Compras, Financeiro e Pacotes.

## Etapa 3 — Homologação operacional — CONCLUÍDA

`GET /admin/homologation/operations` cobre Equipe, Clínico, Portal e Recursos.

## Etapa 4 — Evolução controlada — CONCLUÍDA NO ESCOPO

`GET /admin/homologation/evolution` cobre Marketing, Multiunidade e Financeiro Avançado/Fiscal sem declarar completas as dependências ainda ausentes.

## Etapa 5 — Checkout integrado — CONCLUÍDA E VALIDADA

Fluxo Agenda → Recursos → Pacotes → PDV → Estoque/Financeiro, com preview server-side, preços no backend, consumo automático de crédito, idempotência e transação crítica integrada.

## Etapa 6 — Hardening dos módulos em validação — CONCLUÍDA

`GET /admin/homologation/validation-suite` consolida WhatsApp, Compras, Equipe, Clínico e Portal do Cliente. Foram endurecidos recebimento de compras, regras de ponto/folha, vínculo clínico/consentimento e rotação de links do portal.

## Etapa 7 — Isolamento e fechamento — CONCLUÍDA

Contrato automatizado cross-tenant, checklist final, README/ROADMAP preparados para transição e exact-build Production Smoke integralmente verde.

### Evidência final

- Quality Gate: success;
- Production Gate: success;
- Vercel: success;
- Render: SHA exato;
- `/ready`: `ok=true` e MongoDB pronto;
- Production Smoke: success;
- Issue #28: closed/completed.

---

# Matriz de módulos na entrada do Marco 36

## READY — 8

- SITE — 95%;
- AGENDA — 95%;
- ESTOQUE — 93%;
- CRM — 92%;
- FINANCEIRO — 90%;
- FIDELIDADE — 90%;
- IA — 92%;
- ANALYTICS — 90%.

## VALIDATION_REQUIRED — 8

- WHATSAPP — 90%;
- POS — 91%;
- PACOTES — 89%;
- COMPRAS — 91%;
- EQUIPE — 89%;
- CLINICO — 89%;
- PORTAL_CLIENTE — 90%;
- RECURSOS — 89%.

## EVOLUTION_REQUIRED — 3

- MARKETING — 78%;
- MULTIUNIDADE — 78%;
- FINANCEIRO_ADV — 82%.

---

# Marco 36 — Homologação comercial e higiene pós-Marco 35 — EM EXECUÇÃO

Issue canônica: **#29**.

## Objetivo

Transformar a baseline técnica consolidada em uma operação comercial repetível por tenant, sem adicionar módulos novos antes de homologar corretamente o que já existe.

## Etapa 1 — Sincronização documental e higiene de branches — EM EXECUÇÃO

- corrigir README/ROADMAP que ainda descreviam o Marco 35 como pendente;
- manter a baseline homologada de produção intacta enquanto a documentação evolui em branch/PR;
- inventariar branches históricas;
- classificar branches associadas a PRs já mesclados como candidatas à remoção;
- separar branches intermediárias/sem PR para revisão antes de qualquer limpeza;
- registrar tudo em `docs/engineering/MARCO36_BRANCH_HYGIENE.md`.

Critério de saída: documentação sincronizada, relatório de higiene versionado e gates verdes no candidato.

## Etapa 2 — Homologação comercial dos módulos VALIDATION_REQUIRED — PLANEJADA

Executar em tenant QA/ambiente autorizado:

- WhatsApp: sender/provider definitivo, inbound/outbound, templates e janela;
- PDV: pagamentos, estoque, estorno e idempotência;
- Pacotes: consumo de crédito, validade e elegibilidade;
- Compras: recebimento completo, estoque/custo, conta a pagar e duplicidade;
- Equipe: sequência de ponto e folha operacional;
- Clínico: UX, vínculo, consentimento, auditoria e LGPD;
- Portal: rotação, expiração/revogação e jornada mobile;
- Recursos: capacidade, conflito, Agenda e liberação pós-checkout.

Nenhuma homologação deve criar dados fictícios em tenant real de produção.

## Etapa 3 — Promoção seletiva de maturidade — PLANEJADA

Somente módulos com evidência humana/provider suficiente podem migrar de `VALIDATION_REQUIRED` para `READY`. A matriz tipada deve ser atualizada junto da evidência, nunca antes.

## Etapa 4 — Evoluções comerciais controladas — FUTURA

Marketing, Multiunidade e Financeiro Avançado/Fiscal só avançam quando as capacidades faltantes forem realmente implementadas e homologadas.

---

# Dependências externas e limites declarados

- Twilio Trial: sandbox/trial, não sender final.
- Mercado Pago/Stripe: opcionais enquanto billing automático não estiver contratado.
- Sentry: opcional enquanto não fizer parte de SLA.
- NFS-e: exige provider fiscal real e autorizado.
- Folha legal brasileira: fora do escopo atual; o módulo oferece folha operacional.
- Recebimento parcial de compras: não representado pelo modelo atual.

---

# Hardening pendente

## Clean reset via browser

A superfície de clean reset possui autenticação e confirmações fortes, mas ainda deve receber feature flag/env guard explícita antes de qualquer ampliação de uso:

```text
PLATFORM_CLEAN_RESET_ENABLED=false
```

Nunca executar reset/limpeza como teste em produção real.

## Deploy do Render

Alterações do Marco 36 só devem ir ao `main` após gates verdes. Quando houver alteração de `main`, o Production Smoke continua exigindo convergência do Render para o SHA exato antes de declarar a produção sincronizada.

---

# Critério de saída do Marco 36

1. documentação e branches históricas sob controle;
2. Quality Gate e Production Gate verdes nos candidatos;
3. módulos `VALIDATION_REQUIRED` homologados apenas com evidência real;
4. nenhuma promoção indevida de provider Trial ou capacidade parcial;
5. isolamento cross-tenant preservado;
6. `main`, Vercel e Render novamente convergentes no SHA final do marco;
7. Production Smoke exact-SHA verde;
8. Issue #29 encerrada com evidências.