# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-12.

Este documento é a fonte canônica para a evolução do GlossFlow após o encerramento do ciclo de higienização estrutural.

## Estado do produto

O GlossFlow está em **piloto comercial com produção ativa**.

A base técnica, a homologação por papel e as evoluções comerciais dos **Marcos 1–19 estão concluídas no PR do Marco 19**. Os próximos marcos representam IA/WhatsApp, ciclo de vida SaaS, confiabilidade, performance, segurança e escala.

Estado automatizado no head funcional do Marco 19:

- backend: **57 testes**;
- frontend: **53 testes**;
- RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`;
- Agenda comercial validada em produção no Marco 17;
- Estoque operacional validado em produção no Marco 18;
- CRM com segmentação explicável, histórico, preferência de marketing, follow-up e métrica de reativação;
- GlossFlow Quality Gate do PR: **success**;
- Production Gate do PR: **success**;
- preview Vercel: **READY**;
- smoke de produção do Marco 19 será a última evidência após merge.

---

# Ciclo concluído — Marcos 1–19

## Marco 1 — Higienização estrutural inicial — CONCLUÍDO

- remoção de artefatos legados e duplicados;
- schema Prisma único;
- documentação de engenharia;
- repository hygiene;
- configuração e bootstrap separados.

## Marco 2 — Decomposição do Admin — CONCLUÍDO

- `AdminDashboard.jsx` reduzido a shell;
- módulos administrativos separados por domínio;
- ESLint real no frontend;
- Fastify 5 e Vite 8.

## Marco 3 — Agenda Enterprise e regras de data — CONCLUÍDO

- utilitários de calendário isolados;
- correções de UTC/data local;
- capacidade mensal real;
- Vitest introduzido.

## Marco 4 — Componentização da Agenda — CONCLUÍDO

- toolbar, cards e visões separados;
- navegação acessível por teclado;
- Testing Library e User Event.

## Marco 5 — Reagendamento acessível — CONCLUÍDO

- formulário explícito;
- persistência unificada com drag-and-drop;
- feedback de conflito e sucesso.

## Marco 6 — Tipagem e serviço de reagendamento backend — CONCLUÍDO

- serviço dedicado;
- regra correta de sobreposição;
- payload estrito;
- zero `any` explícito em `backend/src`.

## Marco 7 — Fastify testável — CONCLUÍDO

- `buildApp()` testável;
- `server.ts` apenas bootstrap;
- testes HTTP com `Fastify.inject()`.

## Marco 8 — Rotas de Agenda modularizadas — CONCLUÍDO

- público;
- gestão;
- lista de espera;
- admin;
- contratos e acesso separados.

## Marco 9 — Agente WhatsApp modularizado — CONCLUÍDO

- contratos;
- repositório;
- ferramentas;
- orquestrador;
- fallback seguro.

## Marco 10 — CSS administrativo + contratos do agente — CONCLUÍDO

- estilos extraídos dos componentes;
- testes de ferramenta, fallback e handoff.

## Marco 11 — Webhook Twilio modularizado — CONCLUÍDO

- segurança/HMAC;
- tenant;
- callbacks de status;
- pipeline inbound.

## Marco 12 — Cobertura de regressão ampliada — CONCLUÍDO

- Estoque;
- CRM;
- Twilio;
- agente WhatsApp.

## Marco 13 — Domínio comercial modularizado — CONCLUÍDO

- CRM;
- financeiro;
- comissões;
- fidelidade;
- assinatura;
- templates;
- IA e inteligência executiva.

## Marco 14 — Documentação de usuário — CONCLUÍDO

- proprietário;
- recepção;
- profissional;
- guia rápido;
- FAQ;
- curso;
- implantação;
- boas práticas.

## Marco 15 — Hygiene final — CONCLUÍDO

- bloqueio automático de regressões estruturais;
- zero `<style>` em componentes JSX;
- zero `any` explícito em `backend/src`;
- gates permanentes.

## Marco 16 — Homologação funcional completa por papel — CONCLUÍDO

- matriz canônica de UX por papel;
- `SUPER_ADMIN` isolado da operação tenant;
- `ADMIN` com operação completa dentro dos módulos contratados;
- `RECEPTION` limitada à operação autorizada;
- `PROFESSIONAL` com Agenda somente leitura;
- RBAC frontend/backend alinhado;
- backend: **41 testes** nessa etapa;
- frontend: **29 testes** nessa etapa;
- Quality Gate, Production Gate e smoke: **success**.

Observação arquitetural: ainda não existe vínculo persistente `User → Professional`; por isso o perfil `PROFESSIONAL` possui Agenda tenant somente leitura e não finge filtragem individual inexistente.

## Marco 17 — Agenda comercial e jornada do cliente — CONCLUÍDO

Objetivo cumprido: transformar a Agenda no principal ponto de operação diária e conectar planejamento, execução, encaixe e comunicação com o cliente.

Entregue:

- `AgendaCommercialHub`;
- Operação do Dia, Smart Fit, Lista de Espera e Jornada da Equipe;
- filtros por profissional, serviço e status;
- criação rápida, conflito, reagendamento e cancelamento cobertos por testes;
- confirmação, lembretes e presença consolidados;
- guia `docs/usuario/10_AGENDA_COMERCIAL.md`;
- backend: **46 testes**;
- frontend: **35 testes**;
- merge de produção: `84eac1541f722be4beef473281785eda09ba950e`;
- Quality Gate, Production Gate, deploy Vercel e Production Smoke: **success**.

Critério operacional atingido: a equipe possui os recursos necessários para operar a Agenda sem agenda paralela.

## Marco 18 — Estoque operacional e reposição — CONCLUÍDO

Objetivo cumprido: tornar o estoque confiável para uso diário, conciliação física e decisão de compra.

Entregue:

- central `InventoryOperations`;
- entrada, saída e ajuste físico;
- conciliação inclusive para saldo zero;
- saldo negativo bloqueado;
- read model `/admin/inventory/overview` por tenant;
- indicadores de estoque e valor econômico;
- filtros por busca, categoria, fornecedor e situação;
- painel **O que comprar agora**;
- reposição sugerida até `2 × estoque mínimo`;
- histórico por produto com até 100 eventos;
- guia `docs/usuario/11_ESTOQUE_OPERACIONAL.md`;
- backend: **51 testes**;
- frontend: **44 testes**;
- merge de produção: `6eb20a878e5f55c9df5cf73348228b0ada4b610f`;
- Quality Gate, Production Gate, Vercel e Production Smoke: **success**.

Critério operacional atingido: a equipe consegue identificar ruptura, justificar compra, registrar movimentos, reconciliar saldo físico e consultar a trilha sem planilha paralela.

## Marco 19 — CRM, retenção e automações — CONCLUÍDO NO PR

Objetivo cumprido no código: transformar o cadastro de clientes em uma fila operacional de retenção explicável, mensurável e compatível com preferência de comunicação.

Entregue:

- `CRMRetentionHub` como central do domínio Clientes;
- serviço `client-retention.service.ts` separado da camada HTTP;
- read model `GET /admin/clients/retention` por tenant;
- segmentação determinística por aniversário, inatividade e frequência;
- aniversário nos próximos **14 dias**;
- inatividade de **60+** e **120+ dias**;
- cliente frequente a partir de **3 atendimentos em 90 dias**;
- `CANCELLED` e `NO_SHOW` fora da contagem de visitas;
- múltiplas tags por cliente com segmento principal priorizado;
- motivo textual visível para cada classificação;
- busca e filtro por segmento/opt-out;
- histórico sob demanda em `GET /admin/clients/:id/history`, limitado a 50 atendimentos;
- `LgpdConsent` `MARKETING` reutilizado para registrar mudança de preferência sem apagar histórico anterior;
- follow-up bloqueado quando o consentimento mais recente indica opt-out;
- templates internos `RETENTION_BIRTHDAY`, `RETENTION_INACTIVE`, `RETENTION_FREQUENT` e `RETENTION_FOLLOWUP` reutilizados quando ativos;
- placeholders de cliente e salão no template;
- fallback local seguro quando não existe template configurado;
- preparação da mensagem separada do evento de contato iniciado;
- deep-link do WhatsApp sem afirmar envio ou entrega pelo GlossFlow;
- auditoria `RETENTION_FOLLOWUP_INITIATED` somente quando a equipe aciona **Abrir WhatsApp**;
- métrica de reativação baseada em retorno para atendimento válido em até **30 dias** depois de um follow-up iniciado;
- reativação calculada por qualquer follow-up elegível no período, sem depender apenas do evento mais recente;
- `ADMIN` e `RECEPTION` com acesso operacional; `PROFESSIONAL` permanece sem CRM;
- layout responsivo dedicado em `crm-retention.css`;
- guia `docs/usuario/12_CRM_RETENCAO.md`;
- backend totalizando **57 testes**;
- frontend totalizando **53 testes**.

Validação no PR:

- repository hygiene: **success**;
- `npm audit` backend/frontend: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- backend: **57/57 testes**;
- frontend: **53/53 testes**;
- builds backend/frontend: **success**;
- GlossFlow Quality Gate: **success**;
- Production Gate: **success**;
- preview Vercel: **READY**.

Critério operacional atingido no produto e coberto pelo guia: a equipe consegue identificar quem merece follow-up, entender por que o cliente foi classificado, consultar o histórico, respeitar opt-out, preparar a mensagem e iniciar a ação dentro do GlossFlow sem planilha paralela.

Limite intencional: o Marco 19 **não envia campanhas automaticamente por Meta/Twilio**. Abertura do deep-link não equivale a confirmação de envio ou entrega. Templates oficiais, janela de atendimento, execução automática pelo provider, confirmação de ações e métricas de resolução/entrega pertencem ao Marco 20.

Após o merge, o `Production Smoke Validation` fecha a evidência de produção do Marco 19.

---

# Homologação visual pós-higienização — CONCLUÍDA

- contraste correto de controles nativos no tema escuro;
- controles legados do Super Admin padronizados;
- correção de campos de plano, status, data e white-label;
- correção do stretch vertical do shell;
- telas com pouco conteúdo sem cabeçalhos gigantes;
- deploy validado por smoke automático.

---

# Próximo ciclo — Evolução comercial

## Marco 20 — Assistente IA e WhatsApp em produção — PRÓXIMO

Objetivo: evoluir o agente para atendimento comercial confiável e executar automações de WhatsApp sem inventar dados nem agir sem confirmação quando a ação for sensível.

Escopo:

- base de conhecimento por salão;
- respostas limitadas ao catálogo, disponibilidade e regras do tenant;
- qualificação de intenção;
- consulta de disponibilidade;
- criação/reagendamento/cancelamento com confirmação explícita;
- handoff humano com contexto completo;
- fallback de provider;
- templates oficiais e regras de janela do WhatsApp quando aplicáveis;
- execução segura de follow-ups/casos automatizados pelo provider;
- métricas de resolução automática, envio e falha;
- proteção contra alucinação e ação sem confirmação.

Critério de saída:

- o agente automatiza casos previstos sem inventar preço, serviço, horário ou política;
- qualquer ação que altere Agenda possui confirmação explícita do cliente;
- falha do provider não produz sucesso falso;
- handoff preserva o contexto necessário para a equipe humana;
- Quality Gate, Production Gate e smoke específicos ficam verdes.

## Marco 21 — Super Admin, planos e ciclo de vida SaaS — PLANEJADO

Objetivo: permitir operação comercial multi-tenant sem intervenção técnica manual.

Escopo planejado:

- onboarding de novo cliente;
- planos e módulos contratados;
- trial/active/past-due/canceled;
- ativação/desativação segura;
- white-label e domínio;
- custos externos por tenant;
- preparação de billing real;
- auditoria de alterações sensíveis.

Critério de saída: um novo salão pode ser provisionado e administrado pelo Super Admin sem edição manual de banco.

## Marco 22 — Observabilidade, performance e confiabilidade — PLANEJADO

Objetivo: operar múltiplos salões com diagnóstico rápido e comportamento previsível.

Escopo planejado:

- métricas de API e latência;
- erros por rota/provider;
- monitoramento de webhooks e WhatsApp;
- filas/tarefas assíncronas quando necessário;
- índices MongoDB;
- paginação;
- redução de N+1;
- bundle/performance frontend;
- alertas operacionais.

Critério de saída: falhas relevantes podem ser detectadas e diagnosticadas sem depender de relato do cliente.

## Marco 23 — Segurança e LGPD comercial — PLANEJADO

Objetivo: elevar proteção antes de escala comercial maior.

Escopo planejado:

- revisão final de RBAC;
- trilha de auditoria;
- retenção de dados;
- exportação/eliminação conforme contrato;
- sessões/refresh tokens;
- rate limits;
- secrets;
- backup/restore testado;
- procedimento de incidente.

Critério de saída: controles de segurança e privacidade possuem evidência técnica e procedimento operacional.

## Marco 24 — Release comercial estável — PLANEJADO

Objetivo: fechar o piloto e promover uma versão comercial estável.

Critérios mínimos:

- Marcos 16–23 avaliados e itens críticos encerrados;
- checklist de produção concluído;
- homologação desktop/mobile;
- Agenda, Estoque e CRM reais validados;
- WhatsApp real validado;
- backup e recuperação documentados;
- Quality Gate verde;
- Production Gate verde;
- Production Smoke Validation verde;
- documentação de implantação e suporte atualizada.

Resultado esperado:

**GlossFlow apto a ser vendido e operado como SaaS multi-tenant com processo de implantação repetível.**

---

# Prioridade de execução

```text
Marco 20 — IA + WhatsApp
   ↓
Marco 21 — Super Admin / planos / billing
   ↓
Marco 22 — Observabilidade e performance
   ↓
Marco 23 — Segurança/LGPD
   ↓
Marco 24 — Release comercial estável
```

## Regra de avanço

Um marco somente é considerado concluído quando:

1. código e documentação estão atualizados;
2. testes relevantes foram adicionados ou ajustados;
3. `GlossFlow Quality Gate` está verde;
4. `Production Gate` está verde quando houver impacto de produção;
5. smoke/homologação específica do fluxo foi executada;
6. nenhuma regressão crítica conhecida permanece aberta.

---

# Referências

- [`README.md`](README.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md`](docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md)
- [`docs/usuario/10_AGENDA_COMERCIAL.md`](docs/usuario/10_AGENDA_COMERCIAL.md)
- [`docs/usuario/11_ESTOQUE_OPERACIONAL.md`](docs/usuario/11_ESTOQUE_OPERACIONAL.md)
- [`docs/usuario/12_CRM_RETENCAO.md`](docs/usuario/12_CRM_RETENCAO.md)
