# GlossFlow Smart — Checklist de Produção e Release Comercial

Use este checklist antes de cada implantação relevante, novo tenant comercial ou promoção de release.

## Classes de evidência

- **[AUTO-BLOCKER]**: deve ser comprovado automaticamente e bloqueia a release se falhar.
- **[MANUAL-TENANT]**: depende do tenant, credenciais, conteúdo ou dispositivo real; precisa de validação humana antes do go-live daquele cliente.
- **[SANDBOX-EXTERNO]**: depende de provider externo e deve ser validado em sandbox/trial/ambiente autorizado, sem usar dados reais desnecessariamente.
- **[N/A]**: recurso opcional não vendido/ativado para o tenant; registrar explicitamente a justificativa.

Nenhum item pode ser marcado como aprovado por suposição.

---

## 1. Release base e rastreabilidade

- [ ] **[AUTO-BLOCKER]** `GlossFlow Quality Gate` verde no SHA da release.
- [ ] **[AUTO-BLOCKER]** `Production Gate` verde no SHA da release.
- [ ] **[AUTO-BLOCKER]** Vercel em `READY` no SHA esperado.
- [ ] **[AUTO-BLOCKER]** Render responde em `/health` com `ok=true` e Build ID igual aos 12 primeiros caracteres do SHA esperado.
- [ ] **[AUTO-BLOCKER]** `X-GlossFlow-Build` é igual ao Build ID do body de `/health`.
- [ ] **[AUTO-BLOCKER]** `/ready` responde com o mesmo Build ID e `database.ok=true`.
- [ ] **[AUTO-BLOCKER]** `Production Smoke Validation` verde exigindo o build exato de `main`.
- [ ] **[AUTO-BLOCKER]** nenhum issue P0/P1 conhecido permanece aberto.

### Baseline comprovada antes do Marco 24

- build de produção validado: `afc22563d54645a8555cbafc53b1a9b6b31f2713`;
- Build ID servido: `afc22563d546`;
- frontend de produção: OK;
- `/health`: OK;
- `/ready` + MongoDB: OK;
- catálogo público e read model de Agenda: OK;
- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- `npm audit --audit-level=high`: sem vulnerabilidade bloqueadora conhecida.

Essa baseline é evidência de entrada do Marco 24 e deve ser substituída pelo SHA final da release antes da promoção comercial.

---

## 2. Segurança, autenticação e LGPD

- [ ] **[AUTO-BLOCKER]** `.env` e credenciais reais não estão versionados.
- [ ] **[AUTO-BLOCKER]** `JWT_SECRET` inválido/curto/placeholder é rejeitado pelo `check-env`.
- [ ] **[AUTO-BLOCKER]** sessão revogada invalida access token no servidor.
- [ ] **[AUTO-BLOCKER]** refresh token é rotacionado e replay é rejeitado.
- [ ] **[AUTO-BLOCKER]** matriz RBAC `SUPER_ADMIN` / `ADMIN` / `RECEPTION` / `PROFESSIONAL` permanece coberta por testes.
- [ ] **[AUTO-BLOCKER]** exportação LGPD permanece tenant-safe.
- [ ] **[AUTO-BLOCKER]** eliminação/anônimização LGPD permanece protegida por confirmação e teste de transação.
- [ ] **[AUTO-BLOCKER]** backup lógico assinado valida integridade/tenant.
- [ ] **[AUTO-BLOCKER]** restore permanece bloqueado por `BACKUP_RESTORE_ENABLED=false` na operação normal.
- [ ] **[MANUAL-TENANT]** cada operador possui usuário próprio; não compartilhar login.
- [ ] **[MANUAL-TENANT]** `SUPER_ADMIN` não é compartilhado com equipe do salão.
- [ ] **[MANUAL-TENANT]** política de retenção do cliente foi explicada e aceita operacionalmente.

**Proibição de homologação:** não executar eliminação LGPD nem restore destrutivo em dados reais somente para “testar”. Usar fixtures/mocks/sandbox.

---

## 3. Banco, Prisma e isolamento multi-tenant

- [ ] **[AUTO-BLOCKER]** `backend/prisma/schema.prisma` é a fonte canônica.
- [ ] **[AUTO-BLOCKER]** `npm run prisma:generate` passa.
- [ ] **[AUTO-BLOCKER]** testes de rotas privadas preservam escopo por `salonId`.
- [ ] **[AUTO-BLOCKER]** `/ready` confirma conexão real com MongoDB.
- [ ] **[MANUAL-TENANT]** alterações de schema foram aplicadas conscientemente no ambiente alvo.
- [ ] **[MANUAL-TENANT]** `npm run seed` não será executado em banco com dados reais.
- [ ] **[MANUAL-TENANT]** política/serviço de backup do MongoDB Atlas está configurado conforme o plano contratado.

---

## 4. Frontend e responsividade

- [ ] **[AUTO-BLOCKER]** build Vite passa e bundle budget permanece verde.
- [ ] **[AUTO-BLOCKER]** vitrine pública carrega sem login.
- [ ] **[AUTO-BLOCKER]** fluxo público de booking carrega sem overflow horizontal em viewport homologado.
- [ ] **[AUTO-BLOCKER]** página comercial carrega sem overflow horizontal em viewport homologado.
- [ ] **[MANUAL-TENANT]** desktop 1366×768 validado visualmente.
- [ ] **[MANUAL-TENANT]** desktop 1920×1080 validado visualmente.
- [ ] **[MANUAL-TENANT]** tablet vertical validado visualmente.
- [ ] **[MANUAL-TENANT]** celular grande validado visualmente.
- [ ] **[MANUAL-TENANT]** celular pequeno validado visualmente.
- [ ] **[MANUAL-TENANT]** marca, logo, textos, preços e contatos do tenant conferidos.

---

## 5. Agenda e jornada do cliente

- [ ] **[AUTO-BLOCKER]** compatibilidade serviço/profissional coberta.
- [ ] **[AUTO-BLOCKER]** conflito de horário impedido no backend.
- [ ] **[AUTO-BLOCKER]** reagendamento revalida disponibilidade e conflito.
- [ ] **[AUTO-BLOCKER]** Smart Fit não inventa horários.
- [ ] **[AUTO-BLOCKER]** lista de espera mantém `WAITING` quando WhatsApp falha.
- [ ] **[AUTO-BLOCKER]** jornada comercial create → conflito → reschedule → status permanece verde em teste automatizado.
- [ ] **[MANUAL-TENANT]** serviços, durações, preços, jornadas, pausas e bloqueios foram conferidos no tenant.
- [ ] **[MANUAL-TENANT]** agendamento público foi homologado com registro QA autorizado, quando aplicável.
- [ ] **[MANUAL-TENANT]** política real de cancelamento/reagendamento foi conferida com o cliente.

---

## 6. Estoque

- [ ] **[AUTO-BLOCKER]** entrada, saída e ajuste permanecem cobertos.
- [ ] **[AUTO-BLOCKER]** saldo negativo é bloqueado.
- [ ] **[AUTO-BLOCKER]** histórico e desativação lógica permanecem preservados.
- [ ] **[MANUAL-TENANT]** produtos, unidades, mínimos e saldo inicial foram conferidos na implantação.
- [ ] **[MANUAL-TENANT]** responsável pela reposição sabe operar alerta/plano de compra.

---

## 7. CRM, retenção e automações

- [ ] **[AUTO-BLOCKER]** CRUD/consulta de clientes respeita tenant e papel.
- [ ] **[AUTO-BLOCKER]** segmentação, consentimento e opt-out permanecem cobertos.
- [ ] **[AUTO-BLOCKER]** usuário sem permissão recebe 403 sem logout indevido.
- [ ] **[MANUAL-TENANT]** consentimentos/importações iniciais do cliente foram revisados.
- [ ] **[MANUAL-TENANT]** automações ativas possuem texto, público e gatilho aprovados pelo operador.

---

## 8. WhatsApp e IA

- [ ] **[AUTO-BLOCKER]** assinatura inválida de webhook é rejeitada.
- [ ] **[AUTO-BLOCKER]** idempotência de mensagem/webhook permanece coberta.
- [ ] **[AUTO-BLOCKER]** guards/fallback da IA permanecem cobertos.
- [ ] **[AUTO-BLOCKER]** confirmação server-side impede ação inventada pelo modelo.
- [ ] **[SANDBOX-EXTERNO]** sender, webhook inbound e callback de status estão corretos no provider autorizado.
- [ ] **[SANDBOX-EXTERNO]** envio de mensagem de teste foi aceito pelo provider, somente quando houver autorização explícita.
- [ ] **[SANDBOX-EXTERNO]** callback `sent` e, quando disponível, `delivered`/`read` foi observado.
- [ ] **[MANUAL-TENANT]** tom, produtos/serviços, regras de handoff e templates foram aprovados.

Trial/Sandbox nunca deve ser apresentado como produção definitiva do cliente.

---

## 9. Super Admin, provisionamento e billing

- [ ] **[AUTO-BLOCKER]** provisionamento e lifecycle `TRIAL/ACTIVE/PAST_DUE/CANCELED` permanecem cobertos.
- [ ] **[AUTO-BLOCKER]** módulos/entitlements continuam restringindo UI e backend.
- [ ] **[AUTO-BLOCKER]** `SUPER_ADMIN` continua isolado da operação do tenant.
- [ ] **[MANUAL-TENANT]** plano, módulos, data de trial e identidade white-label conferidos para o tenant.
- [ ] **[SANDBOX-EXTERNO]** Stripe/Mercado Pago só bloqueiam a release quando cobrança automática fizer parte do escopo vendido.
- [ ] **[N/A]** se billing automático não for vendido/ativado, registrar isso no go-live; não marcar provider ausente como defeito.

---

## 10. Observabilidade e suporte

- [ ] **[AUTO-BLOCKER]** request ID e Build ID continuam presentes.
- [ ] **[AUTO-BLOCKER]** health/readiness e métricas internas permanecem operacionais.
- [ ] **[MANUAL-TENANT]** procedimento de suporte, responsável e canal de escalonamento definidos.
- [ ] **[MANUAL-TENANT]** runbook de incidente e recuperação está acessível à equipe técnica.
- [ ] **[N/A]** Sentry é hardening opcional enquanto não fizer parte do SLA contratado; sua ausência deve ficar explícita, nunca simulada como “conectado”.

---

## 11. Critério de GO / NO-GO

### GO

A release pode ser promovida quando:

1. todos os **[AUTO-BLOCKER]** estão verdes no SHA final;
2. o smoke confirma o **build exato** do `main` no Render;
3. Vercel está `READY` no mesmo ciclo de release;
4. não existe regressão P0/P1 conhecida;
5. itens **[MANUAL-TENANT]** aplicáveis ao cliente foram executados;
6. integrações **[SANDBOX-EXTERNO]** vendidas/ativadas foram homologadas em ambiente autorizado;
7. itens opcionais foram registrados como **[N/A]** com justificativa.

### NO-GO

Bloquear a release se houver:

- build de produção diferente do SHA esperado;
- database readiness falhando;
- gate automatizado vermelho;
- isolamento de tenant/RBAC inconsistente;
- perda/corrupção de dados conhecida;
- regressão P0/P1 aberta;
- integração vendida como ativa sem homologação mínima.

## Evidência canônica

A decisão comercial do Marco 24 deve ser registrada em `docs/engineering/MARCO24_RELEASE_VALIDATION.md`.