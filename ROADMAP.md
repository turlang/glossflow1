# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-12.

Este documento é a fonte canônica para a evolução do GlossFlow.

## Estado do produto

O GlossFlow está em **piloto comercial com produção ativa**.

Os **Marcos 1–21 estão concluídos e validados em produção**. O próximo marco oficial é o **Marco 22 — Observabilidade, performance e confiabilidade**.

Estado automatizado após o Marco 21:

- backend: **76/76 testes**;
- frontend: **58/58 testes**;
- `npm audit` backend/frontend: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- merge de produção: `8b8aa0f2a07061b84aaa72db96c1511dae62a369`;
- GlossFlow Quality Gate pós-merge: **success**;
- Production Gate pós-merge: **success**;
- checks Vercel: **success**;
- Production Smoke Validation: **success**;
- provisionamento completo sem edição manual no banco;
- ciclo `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELED` aplicado pelo servidor;
- cancelamento revogando sessões sem destruir tenant;
- billing preparado por tenant sem executar cobrança externa;
- alterações sensíveis com auditoria dedicada.

---

# Ciclo concluído em produção — Marcos 1–21

## Marco 1 — Higienização estrutural inicial — CONCLUÍDO

Artefatos legados removidos, schema Prisma canônico, documentação de engenharia e repository hygiene.

## Marco 2 — Decomposição do Admin — CONCLUÍDO

Dashboard dividido por domínio, ESLint real e atualização da base Fastify/Vite.

## Marco 3 — Agenda Enterprise e regras de data — CONCLUÍDO

Calendário isolado, datas locais corrigidas, capacidade mensal real e Vitest.

## Marco 4 — Componentização da Agenda — CONCLUÍDO

Toolbar, cards, visões e navegação acessível separados.

## Marco 5 — Reagendamento acessível — CONCLUÍDO

Formulário explícito, persistência unificada e feedback de conflito/sucesso.

## Marco 6 — Tipagem e serviço de reagendamento backend — CONCLUÍDO

Serviço dedicado, payload estrito, sobreposição correta e zero `any` explícito em `backend/src`.

## Marco 7 — Fastify testável — CONCLUÍDO

`buildApp()` testável e `server.ts` restrito ao bootstrap.

## Marco 8 — Rotas de Agenda modularizadas — CONCLUÍDO

Público, gestão, lista de espera, admin, contratos e acesso separados.

## Marco 9 — Agente WhatsApp modularizado — CONCLUÍDO

Contratos, repositório, ferramentas, orquestrador e fallback seguro.

## Marco 10 — CSS administrativo + contratos do agente — CONCLUÍDO

Estilos extraídos e contratos/fallback/handoff cobertos.

## Marco 11 — Webhook Twilio modularizado — CONCLUÍDO

Segurança, tenant, status e pipeline inbound separados.

## Marco 12 — Cobertura de regressão ampliada — CONCLUÍDO

Estoque, CRM, Twilio e agente WhatsApp protegidos por testes.

## Marco 13 — Domínio comercial modularizado — CONCLUÍDO

CRM, financeiro, comissões, fidelidade, assinatura, templates e IA separados.

## Marco 14 — Documentação de usuário — CONCLUÍDO

Manuais por papel, FAQ, curso, implantação e boas práticas.

## Marco 15 — Hygiene final — CONCLUÍDO

Gates permanentes, zero `<style>` em JSX e zero `any` explícito no backend.

## Marco 16 — Homologação funcional completa por papel — CONCLUÍDO

RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`.

## Marco 17 — Agenda comercial e jornada do cliente — CONCLUÍDO

Agenda transformada em central de operação diária com Smart Fit, lista de espera, jornada, confirmações e comunicação. Merge de produção `84eac1541f722be4beef473281785eda09ba950e`; gates e smoke verdes.

## Marco 18 — Estoque operacional e reposição — CONCLUÍDO

Movimentação, conciliação, ruptura, histórico, capital e plano de reposição. Merge de produção `6eb20a878e5f55c9df5cf73348228b0ada4b610f`; gates e smoke verdes.

## Marco 19 — CRM, retenção e automações — CONCLUÍDO

CRM de retenção com aniversário, inatividade, frequência, histórico, consentimento, opt-out, follow-up e métrica de reativação.

Validação final do Marco 19:

- backend: **57/57 testes**;
- frontend: **53/53 testes**;
- merge em `main`: `87dba94852dadec4db0e7c27bbc56ceb905cbc6f`;
- Quality Gate: **success**;
- Production Gate: **success**;
- Vercel produção: **READY**;
- Production Smoke Validation: **success**.

## Marco 20 — Assistente IA e WhatsApp em produção — CONCLUÍDO

Objetivo cumprido: transformar o agente em atendimento comercial controlado por fatos e regras do servidor, impedindo que o modelo execute mutações sensíveis ou declare sucesso de provider sem evidência.

Principais entregas:

- base factual por tenant;
- ferramentas de consulta de serviços, profissionais e disponibilidade;
- criação/cancelamento/reagendamento transformados em propostas pendentes;
- confirmação explícita posterior validada no servidor;
- revalidação de Agenda antes da execução;
- handoff humano com contexto recente;
- política de janela de atendimento e template oficial;
- falha de provider sem `WHATSAPP_SENT` falso;
- follow-up CRM por provider com opt-out e confirmação do operador;
- métricas de automação, provider, handoff e ações;
- guia `docs/usuario/13_IA_WHATSAPP_PRODUCAO.md`.

Validação final de produção:

- backend: **68/68 testes**;
- frontend: **54/54 testes**;
- merge em `main`: `238fdd4c2401424f12af26e5feb660a6f1cb1e1c`;
- Quality Gate: **success**;
- Production Gate: **success**;
- checks Vercel: **success**;
- Production Smoke Validation: **success**.

## Marco 21 — Super Admin, planos e ciclo de vida SaaS — CONCLUÍDO

Objetivo cumprido: permitir que o `SUPER_ADMIN` provisione e administre um cliente SaaS completo sem editar documentos diretamente no MongoDB e sem destruir o tenant para suspender ou reativar o contrato.

### Provisionamento canônico

Novo fluxo **Provisionar salão completo** dividido em cinco etapas:

1. dados do salão;
2. administrador principal;
3. plano e estado inicial do contrato;
4. módulos contratados;
5. revisão e provisionamento.

A operação cria:

- `Salon` com slug único;
- primeiro usuário `ADMIN` com senha bcrypt;
- `SalonSubscription` ligada a plano ativo;
- módulos efetivamente contratados;
- perfil inicial de billing;
- eventos dedicados de auditoria.

Se uma etapa interna falhar depois da criação inicial, o backend executa limpeza compensatória de auditorias, sessões, usuários, assinatura e tenant criado, evitando provisionamento órfão.

### Ciclo de vida comercial

Estados canônicos:

```text
TRIAL
 ├─ ACTIVE
 ├─ PAST_DUE
 └─ CANCELED

ACTIVE
 ├─ PAST_DUE
 └─ CANCELED

PAST_DUE
 ├─ ACTIVE
 └─ CANCELED

CANCELED
 └─ ACTIVE
```

Regras:

- `TRIAL` usa `endsAt` ou `SAAS_DEFAULT_TRIAL_DAYS`;
- `ACTIVE` libera operação;
- `PAST_DUE` usa `endsAt` como período de graça ou `SAAS_PAST_DUE_GRACE_DAYS`;
- `CANCELED` bloqueia operação e revoga sessões do tenant;
- cancelamento não apaga dados, white-label, módulos ou histórico;
- contrato cancelado pode ser reativado como `ACTIVE`, sem recriar o salão;
- tenant legado sem `SalonSubscription` permanece compatível até migração comercial.

### Enforcement do contrato

A situação comercial é validada antes do entitlement de módulo em:

- `/auth/login`;
- `/auth/refresh`;
- rotas operacionais autenticadas;
- rotas de negócio autenticadas;
- rotas administrativas críticas do tenant;
- consulta de disponibilidade pública da Agenda;
- read model público de horários ocupados;
- criação de novo agendamento público.

O `SUPER_ADMIN` permanece fora desse bloqueio para conseguir corrigir o contrato.

### Acesso do administrador principal

O Super Admin pode alterar nome, e-mail, ativo/inativo e senha. Rotação de senha ou desativação revoga sessões do administrador. A senha não é incluída nos metadados de auditoria.

### Planos, módulos e billing

O plano representa a oferta comercial/preço; os módulos representam o entitlement efetivo. O fluxo canônico impede atribuir plano arquivado a um novo contrato.

O perfil de billing registra provider `MANUAL`, `MERCADO_PAGO`, `STRIPE` ou `OTHER`, Customer ID, referência externa, próxima cobrança e observações.

Limite intencional: **o Marco 21 não cria, cobra, cancela ou sincroniza uma assinatura no gateway externo**. O objetivo é preparar o vínculo para billing real posterior sem efeitos financeiros durante a implantação deste marco.

### White-label, domínio e custos

`Site & Marca` permanece exclusivo do Super Admin. Atualizações registram evento `SAAS_SITE_BRAND_UPDATED` com antes/depois de domínio, template e cores, mais indicadores de alteração de logo/hero. Imagens base64 não são copiadas integralmente para auditoria. Colisão de `customDomain` entre tenants continua bloqueada.

O painel de custos externos continua disponível por tenant e complementa o ciclo SaaS com custos de WhatsApp, IA, domínio e outros itens.

### Auditoria sensível

Eventos consolidados:

- `SAAS_TENANT_PROVISIONED`;
- `SAAS_SUBSCRIPTION_CHANGED`;
- `SAAS_MODULES_UPDATED`;
- `SAAS_ADMIN_ACCESS_UPDATED`;
- `SAAS_BILLING_PROFILE_UPDATED`;
- `SAAS_SITE_BRAND_UPDATED`.

### Interface e documentação

- `SaasProvisioningWizard` com cinco etapas;
- `TenantBillingProfile` dentro do gerenciamento do cliente;
- `PlatformAdmin` conectado ao contrato canônico;
- `backend/.env.example` com defaults de TRIAL e PAST_DUE;
- guia `docs/usuario/14_SUPER_ADMIN_SAAS.md`.

### Validação final de produção

- backend: **76/76 testes**;
- frontend: **58/58 testes**;
- oito testes específicos de lifecycle backend;
- quatro testes específicos do wizard frontend;
- `npm audit` backend/frontend: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- builds: **success**;
- merge em `main`: `8b8aa0f2a07061b84aaa72db96c1511dae62a369`;
- GlossFlow Quality Gate pós-merge: **success**;
- Production Gate pós-merge: **success**;
- checks Vercel: **success**;
- Production Smoke Validation: **success**.

Critério de saída atingido: um novo salão pode ser provisionado, receber ADMIN, plano, estado comercial, módulos e preparação de billing pelo Super Admin, além de ser suspenso ou reativado sem edição manual no banco.

---

# Próximo ciclo — Operação em escala

## Marco 22 — Observabilidade, performance e confiabilidade — PRÓXIMO

Objetivo: operar múltiplos salões com diagnóstico rápido, métricas confiáveis e comportamento previsível sob crescimento.

Escopo planejado:

- métricas de API e latência;
- erros por rota/provider;
- monitoramento de webhooks e WhatsApp;
- tarefas assíncronas quando necessário;
- índices MongoDB;
- paginação;
- redução de N+1;
- bundle/performance frontend;
- alertas operacionais.

Critério de saída: falhas relevantes podem ser detectadas e diagnosticadas sem depender de relato do cliente, e os principais read models permanecem previsíveis com crescimento de dados.

## Marco 23 — Segurança e LGPD comercial — PLANEJADO

- revisão final de RBAC;
- auditoria;
- retenção, exportação e eliminação de dados;
- sessões/refresh tokens;
- rate limits e secrets;
- backup/restore testado;
- procedimento de incidente.

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
Marco 22 — Observabilidade e performance
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
- [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/usuario/13_IA_WHATSAPP_PRODUCAO.md`](docs/usuario/13_IA_WHATSAPP_PRODUCAO.md)
- [`docs/usuario/14_SUPER_ADMIN_SAAS.md`](docs/usuario/14_SUPER_ADMIN_SAAS.md)
