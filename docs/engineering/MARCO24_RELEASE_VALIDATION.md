# Marco 24 — Matriz de Validação da Release Comercial

Data-base: 2026-08-12.

Issue canônica de encerramento: #19 — **Marco 24 — Release comercial estável**.
PR de promoção: #20 — **release: Marco 24 commercial stable validation**.

## Decisão atual

**GO FUNCIONAL PARA PROMOÇÃO.**

O Release Candidate do Marco 24 está funcionalmente fechado. Não existe bloqueio P0/P1 conhecido e a homologação pública real passou. A única etapa restante é operacional: merge do PR #20, convergência Vercel/Render para o SHA exato do merge e `Production Smoke Validation` final verde.

Quando a Issue #19 for fechada como `completed` com essa evidência, o Marco 24 é considerado oficialmente **VALIDADO EM PRODUÇÃO**. Não deve ser criado um commit documental adicional apenas para trocar a palavra “pendente” por “concluído”, pois isso produziria outro SHA e exigiria um novo deploy sem alteração funcional.

---

## Baseline de entrada — Marco 23 validado em produção

| Evidência | Estado | Prova |
|---|---|---|
| Merge Marco 23 | PASS | PR #17 integrado |
| Strict smoke | PASS | workflow `31639887820`, rerun verde |
| SHA validado | PASS | `afc22563d54645a8555cbafc53b1a9b6b31f2713` |
| Build ID Render | PASS | `afc22563d546` |
| `/health` | PASS | `ok=true`, body e `X-GlossFlow-Build` = `afc22563d546` |
| `/ready` | PASS | mesmo build e `database.ok=true` |
| Frontend produção | PASS | Vercel respondeu ao smoke |
| Endpoints públicos | PASS | salão, serviços, profissionais, portfólio e Agenda read model |
| Backend | PASS | 100/100 testes |
| Frontend | PASS | 61/61 testes |
| Marco 23 | PASS | Issue #14 closed/completed |

---

## Gate comercial do Marco 24

Legenda:

- **PASS**: evidência rastreável disponível.
- **PENDENTE-PROD**: somente pode ser concluído depois do merge.
- **MANUAL-TENANT**: depende do cliente/tenant e não bloqueia a release base quando não aplicável.
- **SANDBOX**: depende de provider externo autorizado.
- **N/A**: opcional e fora do plano/módulo vendido.

| Domínio | Critério | Classe | Estado | Evidência |
|---|---|---|---|---|
| CI | Quality Gate candidato | AUTO-BLOCKER | PASS | workflow do head candidato verde |
| CI | Production Gate candidato | AUTO-BLOCKER | PASS | workflow do head candidato verde |
| Deploy | Quality/Production Gate pós-merge | AUTO-BLOCKER | PENDENTE-PROD | executar no SHA de `main` após merge |
| Deploy | Vercel no SHA final | AUTO-BLOCKER | PENDENTE-PROD | confirmar deployment production |
| Deploy | Render no SHA exato | AUTO-BLOCKER | PENDENTE-PROD | strict smoke compara 12 chars do SHA |
| Banco | `/ready` + MongoDB no build final | AUTO-BLOCKER | PENDENTE-PROD | `database.ok=true` no mesmo build |
| Segurança | sessões/refresh/RBAC | AUTO-BLOCKER | PASS | suíte Marco 23 |
| LGPD | exportação + eliminação segura | AUTO-BLOCKER | PASS | testes com fixtures; sem apagar cliente real |
| Recuperação | backup assinado/restore guardado | AUTO-BLOCKER | PASS | testes automatizados; restore real não executado |
| Agenda | jornada comercial + conflitos | AUTO-BLOCKER | PASS | suíte Agenda/appointments |
| Agenda | UI pública responsiva | AUTO-BLOCKER | PASS | Chromium 15/15 |
| Estoque | entradas/saídas/ajustes/saldo | AUTO-BLOCKER | PASS | suíte de estoque |
| CRM | CRUD/segmentação/consentimento | AUTO-BLOCKER | PASS | suítes CRM/retention |
| WhatsApp | webhook/idempotência/guards | AUTO-BLOCKER | PASS | testes automatizados, sem envio real |
| WhatsApp | sender/callback definitivo do cliente | SANDBOX/MANUAL-TENANT | POR TENANT | somente quando módulo for vendido e autorizado |
| IA | guards, confirmação e fallback | AUTO-BLOCKER | PASS | suítes agente/WhatsApp |
| Super Admin | provisionamento/lifecycle | AUTO-BLOCKER | PASS | SaaS lifecycle + provisioning |
| White-label | marca/domínio | MANUAL-TENANT | POR TENANT | checklist de implantação |
| Billing | Stripe/Mercado Pago | SANDBOX/N/A | N/A BASE | obrigatório apenas quando billing automático for vendido |
| Observabilidade | Build ID/request ID/metrics | AUTO-BLOCKER | PASS | Marcos 22/23 + strict smoke |
| Sentry | provider externo | N/A/HARDENING | N/A BASE | não está conectado; não é apresentado como ativo |
| P0/P1 | regressão crítica conhecida | AUTO-BLOCKER | PASS | somente Issue #19 e PR #20 estão abertos |
| Docs | implantação/operação/suporte | AUTO/MANUAL | PASS | conjunto Marco 24 revisado |

---

## Homologação pública real em Chromium

Workflow endurecido:

`Marco 24 Public Responsive Validation`

Run final endurecido do candidato:

- workflow run: `31650136773`;
- head testado: `b8314771db68d0259cf5ffdc11366bbdc4be801f`;
- runtime isolado: Playwright `1.60.0`;
- `npm audit --audit-level=high` do runtime: PASS;
- validação de navegador: PASS;
- artefato: `marco24-responsive-evidence`, ID `9162271241`;
- digest do artefato: `sha256:bb5234d049d90d3ee4fa7f799f15ed8cfb67604840cff069f897bc054b340d8f`.

### Páginas

1. vitrine pública `/`;
2. booking `/?action=booking`;
3. landing comercial `/?action=commercial`.

### Viewports

1. 1366×768;
2. 1920×1080;
3. 768×1024;
4. 430×932;
5. 360×800.

### Resultado

**15/15 PASS.**

Em todas as combinações:

- HTTP 200;
- conteúdo carregado;
- `documentWidth == viewportWidth`;
- nenhum overflow horizontal bloqueador;
- nenhum `pageerror`;
- nenhum erro visível “Não foi possível conectar à API.”;
- nenhum estado “Agendamento online indisponível”.

Screenshots full-page e `report.json` foram produzidos como artefato.

A inspeção visual dos screenshots não encontrou bloqueio de uso: a vitrine mantém hierarquia e cards no mobile, o booking reorganiza os serviços sem corte horizontal e a landing comercial empilha conteúdo/formulário de modo utilizável.

---

## Documentação de release e implantação

Revisados/atualizados no Marco 24:

- `README.md`;
- `ROADMAP.md`;
- `PRODUCTION_CHECKLIST.md`;
- `DEPLOY_RENDER_VERCEL.md`;
- `docs/RUNBOOK_OPERACIONAL.md`;
- `docs/usuario/07_CHECKLIST_IMPLANTACAO.md`;
- este documento.

Principais ganhos:

- release base separada da homologação de cada tenant;
- exact-build smoke é critério formal;
- `seed`, restore e `prisma:push` não são troubleshooting genérico;
- dados QA e operações destrutivas têm regras explícitas;
- WhatsApp/provider real exige sandbox/autorização;
- billing opcional não cria falso NO-GO;
- incidentes P0/P1 têm regra de bloqueio e escalonamento.

---

## Integrações observadas na readiness da baseline

Conectadas: **3/6**.

- OpenAI: connected;
- WhatsApp via Twilio Trial: connected;
- Deploy validável: connected;
- Mercado Pago: missing;
- Stripe: missing;
- Sentry: missing.

Interpretação comercial:

- Mercado Pago/Stripe não bloqueiam plano sem cobrança automática integrada;
- Sentry permanece hardening opcional enquanto não fizer parte de SLA contratado;
- Twilio Trial é ambiente trial/sandbox e não substitui sender definitivo de um novo cliente;
- provider ausente nunca pode ser exibido como conectado.

---

## Revalidação dos domínios críticos

A release candidate preserva a baseline automatizada:

- backend **100/100**;
- frontend **61/61**;
- Agenda: conflito, reagendamento, disponibilidade, Smart Fit/lista de espera e jornada comercial cobertos;
- Estoque: entradas, saídas, ajustes, saldo negativo e histórico cobertos;
- CRM: cliente, segmentação, consentimento/opt-out e autorização cobertos;
- IA/WhatsApp: guards, idempotência, webhook, confirmação server-side e fallback cobertos;
- Super Admin: provisionamento, lifecycle, módulos/entitlements e isolamento cobertos;
- Segurança/LGPD: sessões, refresh rotation, exportação, erase, retenção, rate limit, auditoria e backup/restore cobertos.

Nenhuma mutação em dados reais foi necessária para esta revalidação.

---

## Operações proibidas durante homologação automática

Sem autorização explícita, não executar em produção:

- criação/edição de cliente real;
- alteração de estoque real;
- criação de agendamento real só para teste;
- envio de WhatsApp real;
- eliminação LGPD;
- retenção destrutiva;
- restore de backup;
- mudança de plano/lifecycle de tenant real.

A release foi homologada com testes, fixtures, mocks, navegador read-only e smoke read-only.

---

## P0/P1

Na consulta final de issues abertas, existem somente:

- Issue #19 — Marco 24;
- PR #20 — Release Candidate.

**Nenhuma regressão P0/P1 conhecida está aberta.**

---

## GO / NO-GO

### GO funcional — ATINGIDO

O candidato pode ser promovido porque:

1. suíte crítica está verde;
2. Quality/Production Gate do candidato estão verdes;
3. homologação Chromium 15/15 passou;
4. runtime de QA está auditado;
5. documentação operacional/implantação foi revisada;
6. não há P0/P1 conhecido;
7. nenhuma operação destrutiva foi usada para fabricar evidência.

### GO de produção — PENDENTE SOMENTE DO MERGE

Após merge do PR #20, exigir:

1. Quality Gate de `main`: PASS;
2. Production Gate de `main`: PASS;
3. Vercel: `READY` no SHA final;
4. `/health.build` e `X-GlossFlow-Build`: 12 primeiros caracteres do SHA final;
5. `/ready.build`: mesmo valor;
6. `/ready.database.ok=true`;
7. Production Smoke Validation: PASS;
8. Issue #19 fechada como `completed` com a evidência.

### NO-GO

Bloquear imediatamente se ocorrer:

- gate vermelho;
- build de produção diferente do SHA esperado;
- MongoDB not-ready;
- regressão crítica de Agenda/Estoque/CRM/RBAC/LGPD;
- vazamento/cross-tenant;
- perda/corrupção de dados conhecida;
- provider obrigatório ao plano vendido sem homologação;
- regressão visual impeditiva em viewport alvo.

---

## Estado congelado do candidato

**Marco 24: RELEASE CANDIDATE — GO PARA MERGE, pendente exclusivamente de exact-build production validation.**