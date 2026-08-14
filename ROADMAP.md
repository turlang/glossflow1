# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-13.

Este documento é a fonte canônica da evolução do GlossFlow. A execução e evidências do ciclo atual são registradas na **Issue #28 — Marco 35: Consolidação e homologação dos 19 módulos**.

## Estado do produto

O GlossFlow está em **produção ativa**. Os Marcos 1–24 consolidaram a fundação comercial; os Marcos 25–34 ampliaram o catálogo operacional; o **Marco 35** integra, endurece e homologa os 19 módulos antes de qualquer nova expansão de domínio.

A produção foi comprovada com exact-build smoke até a Etapa 5 do Marco 35. As Etapas 6–7 estão no `main` e aguardam o deploy final único do backend no Render para o fechamento oficial.

---

# Ciclo 1 — Fundação comercial — Marcos 1–24

## Marcos 1–15 — Fundação, higiene e modularização — CONCLUÍDOS

- base full-stack higienizada;
- rotas e serviços modularizados;
- Admin, Agenda e operação comercial;
- WhatsApp/IA inicial;
- gates permanentes;
- documentação e runbooks.

## Marco 16 — Homologação funcional por papel — CONCLUÍDO

RBAC para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`.

## Marco 17 — Agenda comercial — CONCLUÍDO

Agenda operacional, Smart Fit, lista de espera, conflitos, reagendamento, confirmação e comunicação.

## Marco 18 — Estoque — CONCLUÍDO

Entradas, saídas, ajustes, conciliação, mínimo/ruptura, histórico e reposição.

## Marco 19 — CRM e retenção — CONCLUÍDO

Cadastro, histórico, segmentação, consentimento, opt-out, follow-up e retenção.

## Marco 20 — IA e WhatsApp — CONCLUÍDO NA BASE FUNCIONAL

Base factual, confirmação server-side, handoff, política de janela/template, webhook, métricas e guards. A homologação de sender definitivo continua dependente do provider de cada tenant.

## Marco 21 — Super Admin e ciclo de vida SaaS — CONCLUÍDO

Provisionamento, `TRIAL/ACTIVE/PAST_DUE/CANCELED`, módulos/entitlements, white-label, billing preparado e auditoria.

## Marco 22 — Observabilidade e confiabilidade — CONCLUÍDO

`X-Request-Id`, Build ID, `/health`, `/ready`, MongoDB readiness, métricas, Prometheus, painel global, índices e budgets de performance.

## Marco 23 — Segurança e LGPD — CONCLUÍDO E VALIDADO

Sessões revogáveis, refresh rotation, RBAC, rate limit, auditoria, LGPD export/anonymization, retenção controlada, backup assinado e restore guardado.

## Marco 24 — Release comercial estável — CONCLUÍDO

O ciclo de release foi promovido e validado; o fluxo permanente passou a exigir:

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

A antiga condição de Release Candidate/PR #20 não é mais o estado atual do produto.

---

# Ciclo 2 — Expansão comercial — Marcos 25–34

## Marco 25 — PDV / Checkout — IMPLEMENTADO

- vendas e itens;
- múltiplos pagamentos;
- estoque e financeiro;
- estorno;
- integração posterior com Agenda/Pacotes no Marco 35.

## Marco 26 — Pacotes, Assinaturas e Gift Cards — IMPLEMENTADO

- ofertas de pacote;
- créditos e validade;
- memberships;
- gift cards;
- consumo de crédito integrado ao checkout no Marco 35.

## Marco 27 — Compras e Fornecedores — IMPLEMENTADO

- fornecedores;
- pedidos;
- recebimento;
- estoque/custo;
- integração segura com contas a pagar consolidada no Marco 35.

## Marco 28 — Equipe, Ponto, Metas e Folha — IMPLEMENTADO

- ponto;
- metas;
- folha operacional;
- validação de sequência de ponto e períodos sobrepostos consolidada no Marco 35.

## Marco 29 — Clínico / Prontuário — IMPLEMENTADO

- anamnese;
- tratamento/evolução;
- alergias;
- consentimento;
- vínculo ao atendimento;
- hardening de segurança/LGPD no Marco 35.

## Marco 30 — Marketing 360 — IMPLEMENTADO / EVOLUÇÃO PENDENTE

- campanhas;
- cupons;
- avaliações;
- audiência baseada em consentimento;
- preview/preparação para provider.

Ainda depende de worker/provider real, scheduler, gatilhos automáticos e métricas de conversão para sair de `EVOLUTION_REQUIRED`.

## Marco 31 — Portal do Cliente — IMPLEMENTADO

- token aleatório com SHA-256 persistido;
- expiração/revogação;
- visão tenant/client-scoped;
- rotação de link ativo e hardening no Marco 35.

## Marco 32 — Multiunidade / Redes — IMPLEMENTADO / EVOLUÇÃO PENDENTE

- convite HMAC direcionado;
- expiração;
- aceite por ADMIN do tenant correto;
- saída/revogação;
- zero compartilhamento operacional implícito.

Dashboards corporativos e qualquer compartilhamento de CRM/Agenda/Estoque/Financeiro exigem política explícita antes da implementação.

## Marco 33 — Recursos Físicos — IMPLEMENTADO

Salas, cadeiras, macas, equipamentos, capacidade, reservas e integração com Agenda/checkout no Marco 35.

## Marco 34 — Financeiro Avançado / Fiscal — IMPLEMENTADO / EVOLUÇÃO PENDENTE

- centros de custo;
- caixa;
- contas a pagar/receber;
- liquidação;
- conciliação;
- sincronização de compras;
- metadados/evidência fiscal.

NFS-e real continua dependente de provider fiscal autorizado.

---

# Marco 35 — Consolidação e Homologação dos 19 módulos — EM FECHAMENTO

Issue canônica: **#28**.

## Objetivo

Não adicionar novos domínios. Consolidar integração, consistência transacional, isolamento multi-tenant, diagnósticos, UX necessária à homologação e documentação real do produto.

## Etapa 1 — Matriz canônica de maturidade — CONCLUÍDA

`backend/src/services/module-readiness.service.ts` tornou-se a fonte tipada para estado e maturidade dos 19 módulos.

## Etapa 2 — Homologação transacional — CONCLUÍDA

`GET /admin/homologation/transactional`

Cobertura: PDV, Estoque, Compras, Financeiro e Pacotes.

Detecta, entre outros casos:

- venda sem receita;
- produto vendido sem saída de estoque;
- estorno sem financeiro/devolução;
- compra recebida sem estoque/financeiro;
- inconsistências de saldo/validade de pacote.

## Etapa 3 — Homologação operacional — CONCLUÍDA

`GET /admin/homologation/operations`

Cobertura: Equipe, Clínico, Portal e Recursos.

Inclui verificações de referência, vínculo, consentimento, token/expiração e capacidade/overbooking.

## Etapa 4 — Evolução controlada — CONCLUÍDA NO ESCOPO DO MARCO

`GET /admin/homologation/evolution`

Entregue:

- Marketing: preparação de audiência tenant-safe com consentimento;
- Multiunidade: saída/revogação e vínculo sem compartilhamento operacional;
- Financeiro Avançado: compras → contas a pagar e evidência fiscal obrigatória antes de `ISSUED`.

Os três continuam `EVOLUTION_REQUIRED` porque dependem de capacidades externas/políticas que não devem ser simuladas.

## Etapa 5 — Checkout integrado — CONCLUÍDA E VALIDADA EM PRODUÇÃO

Fluxo:

```text
Agenda
  ↓
Recursos
  ↓
Pacote elegível
  ↓
PDV
  ↓
Estoque + Financeiro
  ↓
Atendimento concluído / recurso liberado
```

Entregue:

- preview server-side;
- preços calculados no backend;
- consumo automático de crédito;
- idempotência por atendimento;
- reserva/liberação de recurso;
- venda, pagamentos, estoque, pacote, financeiro e atendimento na mesma transação Prisma;
- UI de checkout na Agenda;
- `GET /admin/homologation/checkout-flow`.

O exact-build Production Smoke foi validado no build `3b6debc2814a`.

## Etapa 6 — Hardening dos módulos em validação — CONCLUÍDA NO CÓDIGO

`GET /admin/homologation/validation-suite`

### WhatsApp

- diagnóstico de provider/templates;
- provider incompleto = erro;
- Twilio Trial = aviso, nunca homologação comercial final.

### Compras

- recebimento completo em transação única;
- estoque + custo + movimento `IN` + conta a pagar + `RECEIVED`;
- rota legada da UI preservada via interceptação segura;
- rota `/receive-safe` disponível;
- recebimento parcial permanece decisão futura de schema.

### Equipe

- máquina de estados do ponto;
- bloqueio de transições inválidas;
- bloqueio de períodos de folha sobrepostos.

### Clínico

- `Cache-Control: no-store`;
- validação tenant/atendimento/cliente;
- consentimento exige texto, responsável e data/hora;
- UI atualizada para preencher o contrato completo.

### Portal do Cliente

- rotação automática do link ativo;
- `no-store` administrativo;
- diagnóstico de múltiplos links e expirados não revogados.

## Etapa 7 — Fechamento de isolamento e documentação — EM EXECUÇÃO

Entregas desta etapa:

- contrato final automatizado de isolamento tenant para a expansão;
- prova estática de que o portal deriva tenant/client do token persistido;
- prova de que multiunidade não consulta CRM/Agenda/Estoque/Financeiro de outra unidade;
- sincronização de README e ROADMAP;
- checklist final do Marco 35;
- um único SHA final para deploy no Render.

---

# Matriz atual de módulos

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

# Dependências externas e limites declarados

- Twilio Trial: conectado como sandbox/trial; sender final do tenant ainda precisa de homologação.
- Mercado Pago: opcional/ausente enquanto billing automático não fizer parte do escopo vendido.
- Stripe: opcional/ausente enquanto billing automático não fizer parte do escopo vendido.
- Sentry: opcional enquanto não fizer parte de SLA contratado.
- NFS-e: requer provider fiscal real; emissão legal não é simulada.
- Folha legal brasileira: fora do escopo atual; o módulo Equipe oferece folha operacional, não motor trabalhista completo.
- Recebimento parcial de compras: não representado pelo modelo atual e não é simulado.

---

# Hardening pendente fora do fechamento funcional

## Clean reset via browser

A rota de clean reset possui autenticação/guardas, mas ainda merece uma feature flag/env guard explícita para impedir disponibilidade acidental em produção, por exemplo:

```text
PLATFORM_CLEAN_RESET_ENABLED=false
```

Nunca executar reset/limpeza com dados reais de produção.

## Deploy do Render

O backend não está acompanhando automaticamente cada commit de `main`. Antes de encerrar o Marco 35 deve ser feito um deploy único do SHA final ou habilitado Auto-Deploy/deploy hook de forma controlada.

---

# Critério de saída do Marco 35

Para declarar o Marco 35 oficialmente concluído:

1. `GlossFlow Quality Gate` do SHA final = success;
2. `Production Gate` do SHA final = success;
3. Vercel publica o SHA final;
4. Render publica o mesmo SHA final;
5. `/health` retorna Build ID exato no body/header;
6. `/ready` retorna o mesmo Build ID e `database.ok=true`;
7. `Production Smoke Validation` = success;
8. contratos de isolamento cross-tenant = success;
9. README/ROADMAP/documentação final sincronizados;
10. Issue #28 recebe a evidência final e é encerrada quando os itens automatizáveis e a decisão de homologação estiverem registrados.

Homologação humana por tenant e providers externos permanecem separadas da CI. Nenhuma dependência externa deve ser declarada pronta por suposição.

## Próximo marco após o encerramento

Somente depois do Marco 35 fechado deve ser aberto novo ciclo. A prioridade recomendada é transformar os itens `EVOLUTION_REQUIRED` em entregas comerciais controladas, em vez de adicionar novos módulos sem consolidar Marketing, Multiunidade e Fiscal.
