# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-12.

Este documento é a fonte canônica para a evolução do GlossFlow.

## Estado do produto

O GlossFlow está em **piloto comercial com produção ativa**.

Os **Marcos 1–19 estão concluídos e validados em produção**. O **Marco 20 — Assistente IA e WhatsApp em produção** está **CONCLUÍDO NO PR**, com código, documentação e gates funcionais verdes. A validação oficial de produção será registrada somente depois do merge, deploy e `Production Smoke Validation`.

Estado automatizado do head funcional do Marco 20:

- backend: **68/68 testes**;
- frontend: **54/54 testes**;
- `npm audit` backend/frontend: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- confirmação de mutações de Agenda validada no servidor;
- política de janela/template validada por testes;
- falha de provider sem sucesso falso;
- handoff com contexto;
- métricas operacionais de IA/WhatsApp.

---

# Ciclo concluído em produção — Marcos 1–19

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

---

# Marco 20 — Assistente IA e WhatsApp em produção — CONCLUÍDO NO PR

Objetivo cumprido no código: transformar o agente em atendimento comercial controlado por fatos e regras do servidor, impedindo que o modelo execute mutações sensíveis ou declare sucesso de provider sem evidência.

## Base factual do tenant

- contexto institucional por salão;
- serviços ativos, preço, duração e descrição;
- disponibilidade e profissionais consultados por ferramentas;
- informação ausente tratada como não cadastrada, sem completar lacunas por suposição.

## Confirmação server-side de Agenda

Criar, cancelar e reagendar seguem o fluxo:

```text
Pedido do cliente
   ↓
IA consulta/valida
   ↓
Proposta pendente
   ↓
NOVA mensagem do cliente
   ├─ CONFIRMAR      → revalida Agenda → executa
   ├─ CANCELAR AÇÃO  → cancela proposta
   └─ ambígua        → mantém pendente, sem mutação
```

Entregue:

- `confirmed=true` removido do contrato exposto ao modelo;
- ação pendente persistida em AuditLog;
- TTL configurável;
- parser de confirmação conservador;
- revalidação de serviço, profissional, jornada e conflito antes da execução;
- proposta encerrada imediatamente no turno de tool calling para impedir encadeamento proposta + execução;
- estados auditados `PENDING`, `COMPLETED`, `CANCELED`, `FAILED` e `EXPIRED`.

## Handoff humano

- motivo persistido;
- telefone normalizado;
- até seis mensagens recentes anexadas quando disponíveis;
- falha de leitura do contexto não impede o handoff.

## Política de envio WhatsApp

A decisão de canal é do servidor, não da IA:

- janela de atendimento aberta → mensagem livre;
- janela fechada → template oficial do provider obrigatório;
- ausência de template → bloqueio antes da chamada externa;
- falha do provider → `WHATSAPP_PROVIDER_FAILED`, sem `WHATSAPP_SENT` falso;
- outbound persistido somente após sucesso confirmado pela API do provider.

O CRM ganhou `POST /admin/clients/:id/follow-up/send` com:

- tenant e módulo WhatsApp revalidados;
- opt-out preservado;
- confirmação explícita do operador no frontend;
- política de janela/template;
- follow-up registrado somente depois de sucesso do provider.

## Templates

O CRUD interno aceita também:

- `RETENTION_BIRTHDAY`;
- `RETENTION_INACTIVE`;
- `RETENTION_FREQUENT`;
- `RETENTION_FOLLOWUP`.

O ambiente documenta os identificadores de template oficial correspondentes para o provider.

## Métricas

Novo read model `/admin/whatsapp/metrics` com:

- mensagens inbound/outbound;
- falhas do provider;
- handoffs abertos/fechados;
- ações propostas, concluídas, canceladas, falhas e expiradas;
- contatos inbound únicos;
- taxa operacional de resolução automática;
- taxa de sucesso do provider.

A taxa de resolução automática é um proxy operacional — resposta outbound sem handoff no período — e não uma prova de satisfação do cliente.

## Interface

- `WhatsAppAgentTester` mostra status e métricas de 30 dias;
- playground continua sem enviar mensagem real ao provider;
- CRM oferece fluxo manual e envio controlado por provider;
- presets de retenção adicionados à Central de Automações.

## Configuração

`backend/.env.example` documenta:

- `WHATSAPP_ACTION_CONFIRMATION_TTL_MINUTES`;
- templates de retenção do provider;
- relação entre dry-run, sender, webhook e templates.

## Documentação

- `docs/usuario/13_IA_WHATSAPP_PRODUCAO.md`.

## Validação automatizada do head funcional

- repository hygiene: **success**;
- `npm audit` backend/frontend: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- backend: **68/68 testes**;
- frontend: **54/54 testes**;
- builds backend/frontend: **success**.

Critério de saída funcional atingido:

- o agente não recebe autoridade para inventar fatos fora da base/tooling;
- qualquer mutação de Agenda exige confirmação explícita posterior validada pelo servidor;
- mensagem ambígua não altera Agenda;
- falha do provider não produz sucesso falso;
- handoff preserva contexto recente;
- follow-up respeita opt-out e política de janela/template;
- operação possui métricas de automação, handoff e provider.

**Pendência para conclusão oficial:** merge no `main`, deploy de produção e `Production Smoke Validation` verdes.

---

# Próximo ciclo — Evolução comercial

## Marco 21 — Super Admin, planos e ciclo de vida SaaS — PRÓXIMO

Objetivo: permitir operação comercial multi-tenant sem intervenção técnica manual.

Escopo:

- onboarding de novo cliente;
- planos e módulos contratados;
- estados `TRIAL`, `ACTIVE`, `PAST_DUE` e `CANCELED`;
- ativação/desativação segura;
- white-label e domínio;
- custos externos por tenant;
- preparação de billing real;
- auditoria de alterações sensíveis.

Critério de saída: um novo salão pode ser provisionado, configurado e administrado pelo Super Admin sem edição manual de banco.

## Marco 22 — Observabilidade, performance e confiabilidade — PLANEJADO

- métricas de API e latência;
- erros por rota/provider;
- monitoramento de webhooks;
- tarefas assíncronas quando necessário;
- índices MongoDB;
- paginação e redução de N+1;
- performance de frontend;
- alertas operacionais.

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
Marco 21 — Super Admin / planos / ciclo de vida SaaS
   ↓
Marco 22 — Observabilidade e performance
   ↓
Marco 23 — Segurança / LGPD
   ↓
Marco 24 — Release comercial estável
```

## Regra de avanço

Um marco somente é considerado concluído quando:

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
- [`docs/usuario/12_CRM_RETENCAO.md`](docs/usuario/12_CRM_RETENCAO.md)
- [`docs/usuario/13_IA_WHATSAPP_PRODUCAO.md`](docs/usuario/13_IA_WHATSAPP_PRODUCAO.md)
