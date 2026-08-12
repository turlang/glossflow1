# Marco 24 — Matriz de Validação da Release Comercial

Data-base: 2026-08-12.

Issue canônica: #19 — **Marco 24 — Release comercial estável**.

## Objetivo

Transformar o estado técnico do GlossFlow em uma decisão de go-live rastreável. Este documento separa evidência automatizada, homologação manual por tenant e integrações externas para impedir que uma release seja declarada comercial apenas porque compilou.

## Baseline de entrada — Marco 23 validado em produção

O Marco 24 iniciou somente após a validação estrita do Marco 23 em produção.

| Evidência | Estado | Prova |
|---|---|---|
| Merge Marco 23 | PASS | PR #17 integrado ao `main` |
| Smoke com SHA exato | PASS | workflow run `31639887820`, rerun verde |
| SHA esperado | PASS | `afc22563d54645a8555cbafc53b1a9b6b31f2713` |
| Build ID Render | PASS | `afc22563d546` |
| `/health` | PASS | `ok=true`, body e `X-GlossFlow-Build` iguais a `afc22563d546` |
| `/ready` | PASS | `ok=true`, build `afc22563d546`, `database.ok=true` |
| Frontend produção | PASS | `https://glossflow1.vercel.app` respondeu ao smoke |
| Endpoints públicos | PASS | salão, serviços, profissionais, portfólio e Agenda read model |
| Backend automatizado | PASS | 100/100 testes |
| Frontend automatizado | PASS | 61/61 testes |
| Issue do Marco 23 | PASS | #14 fechada como completed |

Essa baseline não substitui a validação do SHA final do Marco 24. Qualquer commit promovido depois dela precisa passar novamente pelos gates e pelo smoke de build exato.

---

## Matriz de release

Legenda:

- **PASS**: evidência já disponível e rastreável.
- **PENDENTE**: será produzida durante o Marco 24.
- **MANUAL**: depende de homologação humana/tenant.
- **SANDBOX**: depende de provider externo autorizado.
- **N/A**: opcional e fora do escopo comercial ativado.

| Domínio | Critério | Classe | Estado inicial | Evidência / ação |
|---|---|---|---|---|
| CI | Quality Gate verde | AUTO-BLOCKER | PASS baseline | revalidar no SHA final do Marco 24 |
| CI | Production Gate verde | AUTO-BLOCKER | PASS baseline | revalidar no SHA final |
| Deploy | Vercel READY | AUTO-BLOCKER | PASS baseline | revalidar no SHA final |
| Deploy | Render no SHA exato | AUTO-BLOCKER | PASS baseline | smoke estrito exige os 12 chars do SHA |
| Banco | `/ready` + MongoDB | AUTO-BLOCKER | PASS baseline | revalidar no SHA final |
| Segurança | sessões/refresh/RBAC | AUTO-BLOCKER | PASS | testes Marco 23 |
| LGPD | exportação + eliminação segura | AUTO-BLOCKER | PASS | testes com fixtures; sem apagar cliente real |
| Recuperação | backup assinado/restore guardado | AUTO-BLOCKER | PASS | teste automatizado; sem restore real em produção |
| Agenda | jornada comercial + conflitos | AUTO-BLOCKER | PASS | `agenda-commercial-journey.test.js` e suíte de appointments |
| Agenda | UI pública responsiva | AUTO-BLOCKER + MANUAL | PENDENTE | navegador real em viewports alvo + revisão visual |
| Estoque | entradas/saídas/ajustes/saldo | AUTO-BLOCKER | PASS | `inventory-operations.test.js` |
| CRM | CRUD/segmentação/consentimento | AUTO-BLOCKER | PASS | suíte client retention / CRM frontend |
| WhatsApp | regras, webhook, idempotência | AUTO-BLOCKER | PASS | suites WhatsApp, sem envio real nesta release |
| WhatsApp | provider/sender/callback real | SANDBOX | MANUAL/SANDBOX | executar somente com autorização explícita |
| IA | guards, confirmação e fallback | AUTO-BLOCKER | PASS | suites agent/WhatsApp |
| Super Admin | provisionamento/lifecycle | AUTO-BLOCKER | PASS | `saas-lifecycle.test.js` + provisioning frontend |
| White-label | marca e domínio do tenant | MANUAL | PENDENTE por tenant | checklist de implantação |
| Billing | Stripe/Mercado Pago | SANDBOX/N/A | N/A por padrão | bloquear apenas se cobrança automática for vendida |
| Observabilidade | Build ID/request ID/metrics | AUTO-BLOCKER | PASS | Marco 22 + smoke estrito |
| Sentry | provider externo | N/A/hardening | N/A | não está conectado; não é declarar como ativo |
| P0/P1 | regressão crítica aberta | AUTO-BLOCKER | PASS na entrada | Issue #19 é evolução, não regressão; consultar issues antes do go-live |
| Docs | implantação/operação/suporte | AUTO/MANUAL | PENDENTE | revisar documentação no Marco 24 |

---

## Integrações observadas na readiness de produção

Na validação estrita de entrada do Marco 24, `/ready` informou **3/6 integrações conectadas**:

- OpenAI: connected;
- WhatsApp via Twilio Trial: connected;
- Deploy validável: connected;
- Mercado Pago: missing;
- Stripe: missing;
- Sentry: missing.

Interpretação comercial:

- ausência de Mercado Pago/Stripe **não bloqueia** um plano que não venda cobrança automática integrada;
- ausência de Sentry **não bloqueia** a release base enquanto não fizer parte de SLA contratado, pois já existem health/readiness/métricas internas; continua sendo hardening recomendado;
- Twilio Trial deve ser tratado como trial/sandbox e não como linha definitiva de produção de um novo cliente;
- nenhum provider ausente pode ser exibido como “conectado”.

---

## Homologação responsiva

Viewports mínimos do plano de QA:

1. desktop 1366×768;
2. desktop 1920×1080;
3. tablet vertical;
4. celular grande;
5. celular pequeno.

O Marco 24 deve produzir evidência automatizada de carregamento/overflow para a vitrine pública, booking e landing comercial. A aprovação estética final permanece humana, pois não há credencial de backoffice disponível para uma homologação automatizada autenticada segura.

**Regra:** nunca inventar sessão ADMIN/SUPER_ADMIN para obter screenshot. O backoffice autenticado permanece coberto por testes de componentes/RBAC e por homologação manual autorizada.

---

## Operações proibidas durante a homologação

Sem autorização explícita, não executar em produção:

- criação/edição de cliente real;
- alteração de saldo de estoque real;
- criação de agendamento real só para teste;
- envio de WhatsApp real;
- eliminação LGPD;
- execução de retenção destrutiva;
- restore de backup;
- mudança de plano/lifecycle de tenant real.

Usar testes automatizados, mocks, fixtures, read-only smoke ou sandbox autorizado.

---

## Critério de GO comercial

O GlossFlow recebe a marca **Release Comercial Estável** somente quando:

1. o SHA final do Marco 24 passa Quality Gate e Production Gate;
2. Vercel publica o SHA final;
3. Render serve exatamente o Build ID do SHA final;
4. `/ready` confirma `database.ok=true` no mesmo build;
5. Production Smoke Validation final passa;
6. a homologação pública desktop/mobile não encontra regressão bloqueadora;
7. documentação de implantação, suporte e incidente está atualizada;
8. não existe issue P0/P1 conhecida aberta;
9. integrações vendidas como ativas possuem evidência aplicável;
10. nenhuma operação destrutiva foi usada indevidamente para homologar.

## Critério de NO-GO

Qualquer uma das condições abaixo bloqueia a promoção:

- smoke em build diferente do SHA final;
- readiness do banco falhando;
- gate vermelho;
- regressão crítica de Agenda/Estoque/CRM/RBAC/LGPD;
- vazamento/isolamento de tenant inconsistente;
- provider obrigatório ao plano vendido sem homologação;
- regressão visual que impeça uso em viewport alvo.

## Estado atual

**Marco 24: EM EXECUÇÃO.**

Baseline técnica de produção: **verde**. Próxima evidência obrigatória: homologação pública desktop/mobile e atualização do conjunto de documentação/go-live no branch `feature/marco24-release-commercial`.