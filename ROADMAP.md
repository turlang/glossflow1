# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-11.

Este documento é a fonte canônica para a evolução do GlossFlow após o encerramento do ciclo de higienização estrutural.

## Estado do produto

O GlossFlow está em **piloto comercial com produção ativa**.

A base técnica e a primeira homologação funcional dos **Marcos 1–16 estão concluídas** e validadas por Quality Gate, Production Gate e smoke pós-deploy. A partir daqui, os próximos marcos representam evolução comercial, confiabilidade, performance e escala.

Estado automatizado após o Marco 16:

- backend: **41 testes**;
- frontend: **29 testes**;
- RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`;
- deploy Vercel e smoke de produção validados.

---

# Ciclo concluído — Marcos 1–16

## Marco 1 — Higienização estrutural inicial — CONCLUÍDO

- remoção de artefatos legados e duplicados;
- schema Prisma único em `backend/prisma/schema.prisma`;
- documentação de engenharia;
- repository hygiene;
- configuração e bootstrap separados.

## Marco 2 — Decomposição do Admin — CONCLUÍDO

- `AdminDashboard.jsx` reduzido a shell;
- módulos administrativos separados por domínio;
- ESLint real no frontend;
- atualização para Fastify 5 e Vite 8.

## Marco 3 — Agenda Enterprise e regras de data — CONCLUÍDO

- utilitários de calendário isolados;
- correções de UTC/data local;
- capacidade mensal real;
- Vitest introduzido.

## Marco 4 — Componentização da Agenda — CONCLUÍDO

- toolbar, cards e visões separadas;
- navegação acessível por teclado;
- Testing Library e User Event.

## Marco 5 — Reagendamento acessível — CONCLUÍDO

- formulário explícito de reagendamento;
- persistência unificada com drag-and-drop;
- feedback de conflito e sucesso.

## Marco 6 — Tipagem e serviço de reagendamento backend — CONCLUÍDO

- serviço dedicado;
- regra correta de sobreposição de horários;
- payload de atualização estrito;
- zero `any` explícito em `backend/src`.

## Marco 7 — Fastify testável — CONCLUÍDO

- `buildApp()` em `backend/src/app.ts`;
- `server.ts` apenas como bootstrap;
- testes HTTP com `Fastify.inject()`.

## Marco 8 — Rotas de Agenda modularizadas — CONCLUÍDO

- público;
- gestão;
- lista de espera;
- admin;
- contratos e acesso separados.

## Marco 9 — Agente WhatsApp modularizado — CONCLUÍDO

- contratos;
- tempo;
- repositório de conversa;
- ferramentas de agenda;
- orquestrador;
- fallback seguro.

## Marco 10 — CSS administrativo + contratos do agente — CONCLUÍDO

- estilos administrativos extraídos dos componentes;
- testes de ferramenta, fallback e handoff humano.

## Marco 11 — Webhook Twilio modularizado — CONCLUÍDO

- segurança/HMAC;
- resolução de tenant;
- callbacks de status;
- pipeline inbound separados.

## Marco 12 — Cobertura de regressão ampliada — CONCLUÍDO

- Estoque;
- CRM;
- Twilio;
- agente WhatsApp;
- backend passou a 30 testes nessa etapa.

## Marco 13 — Domínio comercial modularizado — CONCLUÍDO

- CRM;
- financeiro;
- comissões;
- fidelidade;
- assinatura;
- templates WhatsApp;
- IA;
- inteligência executiva retirada da camada HTTP.

## Marco 14 — Documentação de usuário — CONCLUÍDO

- proprietário;
- recepção;
- profissional;
- guia rápido;
- FAQ;
- curso completo;
- implantação;
- boas práticas.

## Marco 15 — Hygiene final — CONCLUÍDO

- bloqueio automático de regressões estruturais;
- zero `<style>` em componentes JSX;
- zero `any` explícito em `backend/src`;
- gates permanentes de qualidade e produção.

## Marco 16 — Homologação funcional completa por papel — CONCLUÍDO

Objetivo cumprido: alinhar o produto visível ao contrato real de autorização antes de ampliar funcionalidades.

Entregue:

- matriz canônica de UX por papel no frontend;
- `SUPER_ADMIN` direcionado à administração global e bloqueado na operação tenant;
- `ADMIN` com operação completa do salão dentro dos módulos contratados;
- `RECEPTION` com módulos operacionais e sem usuários, financeiro sensível, assinatura ou segurança;
- `PROFESSIONAL` com painel mínimo e Agenda em modo somente leitura;
- URLs diretas incompatíveis normalizadas por papel;
- Agenda sem drag-and-drop nem botão Reagendar para `PROFESSIONAL`;
- separação backend entre `agendaReadAccess` e `agendaManageAccess`;
- reagendamento, lista de espera administrativa e mesa operacional restritos a `ADMIN`/`RECEPTION`;
- checklist em `docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md`;
- backend totalizando **41 testes**;
- frontend totalizando **29 testes**.

Validação de saída:

- GlossFlow Quality Gate: **success**;
- Production Gate: **success**;
- Production Smoke Validation: **success**;
- deploy de produção: **READY**.

Observação arquitetural: nesta versão não existe vínculo persistente `User → Professional`; por isso, o perfil `PROFESSIONAL` possui Agenda tenant em modo somente leitura, sem alegar filtragem por profissional individual até que esse vínculo seja modelado explicitamente.

---

# Homologação visual pós-higienização — CONCLUÍDA

A primeira rodada visual em produção identificou inconsistências sistêmicas e foi corrigida.

Entregue:

- contraste correto de `<select>` e opções no tema escuro;
- padronização de controles legados do Super Admin;
- correção de campos de plano, status, data e white-label;
- correção do stretch vertical do shell administrativo;
- telas com pouco conteúdo deixam de exibir cabeçalhos gigantes;
- mesma correção aplicada aos controles do agendamento público;
- deploy de produção validado pelo smoke automático.

---

# Próximo ciclo — Evolução comercial

## Marco 17 — Agenda comercial e jornada do cliente — PRÓXIMO

Objetivo: transformar a Agenda no principal motor operacional do salão.

Escopo:

- revisar experiência de criação e reagendamento no admin;
- consolidar filtros por profissional, serviço e status;
- revisar Smart Fit e lista de espera em cenários reais;
- melhorar comunicação de conflito e indisponibilidade;
- reforçar lembretes, confirmação e cancelamento;
- validar jornada pública de agendamento ponta a ponta;
- validar transição cliente → salão → WhatsApp;
- ampliar testes de jornada completa;
- revisar experiência desktop/mobile dos fluxos de Agenda.

Critério de saída:

- criação, reagendamento e cancelamento operam sem inconsistência conhecida;
- conflito e indisponibilidade possuem mensagens acionáveis;
- confirmação/lembrete via WhatsApp preservam estado correto;
- Smart Fit e lista de espera são utilizáveis em operação real;
- um salão consegue operar o dia inteiro sem depender de planilha ou agenda paralela;
- Quality Gate, Production Gate e smoke específicos ficam verdes.

## Marco 18 — Estoque operacional e reposição — PLANEJADO

Objetivo: tornar o estoque confiável para uso diário e decisão de compra.

Escopo planejado:

- revisar entrada, saída e ajuste;
- histórico de movimentações por produto;
- filtros por categoria/fornecedor;
- alertas de estoque baixo;
- painel de reposição;
- custo total e valor imobilizado;
- ligação futura entre consumo de serviço e baixa automática, quando configurado.

Critério de saída:

- estoque físico e GlossFlow podem ser conciliados sem inconsistências conhecidas.

## Marco 19 — CRM, retenção e automações — PLANEJADO

Objetivo: aumentar retorno de clientes e reduzir trabalho manual.

Escopo planejado:

- segmentação de clientes;
- aniversário;
- inatividade;
- frequência de retorno;
- histórico de atendimentos;
- campanhas e templates;
- métricas de reativação;
- opt-out e regras de comunicação.

Critério de saída:

- o salão consegue identificar quem deve receber follow-up e executar a ação dentro do produto.

## Marco 20 — Assistente IA e WhatsApp em produção — PLANEJADO

Objetivo: evoluir o agente para atendimento comercial confiável.

Escopo planejado:

- base de conhecimento por salão;
- respostas limitadas ao catálogo e regras do tenant;
- qualificação de intenção;
- consulta de disponibilidade;
- criação/reagendamento/cancelamento com confirmação explícita;
- handoff humano com contexto completo;
- fallback de provider;
- métricas de resolução automática;
- proteção contra alucinação e ações sem confirmação.

Critério de saída:

- o agente automatiza casos previstos sem inventar preço, serviço, horário ou política.

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

Critério de saída:

- um novo salão pode ser provisionado, configurado e administrado pelo Super Admin sem edição manual de banco.

## Marco 22 — Observabilidade, performance e confiabilidade — PLANEJADO

Objetivo: operar múltiplos salões com diagnóstico rápido e comportamento previsível.

Escopo planejado:

- métricas de API e latência;
- erros por rota/provider;
- monitoramento de webhooks;
- falhas de WhatsApp;
- filas/tarefas assíncronas quando necessário;
- revisão de índices MongoDB;
- paginação em coleções crescentes;
- redução de queries N+1;
- análise de bundle e performance frontend;
- alertas operacionais.

Critério de saída:

- falhas relevantes podem ser detectadas e diagnosticadas sem depender de relato do cliente.

## Marco 23 — Segurança e LGPD comercial — PLANEJADO

Objetivo: elevar o nível de proteção antes de escala comercial maior.

Escopo planejado:

- revisão final de RBAC;
- trilha de auditoria administrativa;
- política de retenção de dados;
- exportação/eliminação de dados conforme contrato;
- revisão de sessões e refresh tokens;
- rate limits por risco;
- revisão de secrets;
- política de backup/restore testada;
- documentação de incidente.

Critério de saída:

- controles de segurança e privacidade possuem evidência técnica e procedimento operacional.

## Marco 24 — Release comercial estável — PLANEJADO

Objetivo: fechar o ciclo de piloto e promover uma versão comercial estável.

Critérios mínimos:

- Marcos 16–23 avaliados e itens críticos encerrados;
- checklist de produção concluído;
- homologação desktop/mobile;
- fluxo real de Agenda validado;
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

Ordem oficial atual:

```text
Marco 17 — Agenda comercial
   ↓
Marco 18 — Estoque operacional
   ↓
Marco 19 — CRM e retenção
   ↓
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
