# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-12.

Este documento é a fonte canônica para a evolução do GlossFlow após o encerramento do ciclo de higienização estrutural.

## Estado do produto

O GlossFlow está em **piloto comercial com produção ativa**.

A base técnica, a homologação por papel e as evoluções comerciais dos **Marcos 1–18 estão concluídas no PR do Marco 18**. Os próximos marcos representam retenção, IA, ciclo de vida SaaS, confiabilidade, performance, segurança e escala.

Estado automatizado no head funcional do Marco 18:

- backend: **51 testes**;
- frontend: **44 testes**;
- RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`;
- Agenda comercial integrada e validada em produção no Marco 17;
- Estoque operacional com reposição, conciliação física, histórico e indicadores econômicos;
- GlossFlow Quality Gate do PR: **success**;
- Production Gate do PR: **success**;
- preview Vercel: **READY**;
- smoke de produção do Marco 18 será a última evidência após merge.

---

# Ciclo concluído — Marcos 1–18

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

## Marco 18 — Estoque operacional e reposição — CONCLUÍDO NO PR

Objetivo cumprido no código: tornar o estoque confiável para uso diário, conciliação física e decisão de compra.

Entregue:

- central dedicada `InventoryOperations` no frontend;
- entrada, saída e ajuste físico com regras explícitas;
- ajuste físico capaz de reconciliar o saldo inclusive para **zero**;
- entrada/saída zero rejeitadas e saldo negativo bloqueado;
- read model `/admin/inventory/overview` por tenant;
- indicadores de produtos ativos, estoque baixo, ruptura, capital imobilizado, venda potencial e compra sugerida;
- filtros combinados por busca, categoria, fornecedor e situação;
- produtos inativos fora dos KPIs e da reposição;
- painel **O que comprar agora**, priorizando ruptura;
- sugestão de reposição até `2 × estoque mínimo`;
- custo estimado da reposição;
- ação **Preparar entrada** a partir da sugestão;
- histórico sob demanda em `/admin/inventory/:id/movements`, com até 100 eventos e isolamento por `salonId`;
- `ADMIN` e `RECEPTION` operam Estoque; `PROFESSIONAL` não acessa overview/histórico operacional;
- layout responsivo dedicado;
- guia `docs/usuario/11_ESTOQUE_OPERACIONAL.md`;
- backend totalizando **51 testes**;
- frontend totalizando **44 testes**.

Validação no PR:

- repository hygiene: **success**;
- npm audit backend/frontend: **0 vulnerabilidades**;
- lint/TypeScript: **success**;
- backend: **51/51 testes**;
- frontend: **44/44 testes**;
- builds backend/frontend: **success**;
- GlossFlow Quality Gate: **success**;
- Production Gate: **success**;
- preview Vercel: **READY**.

Critério operacional atingido no produto e coberto pelo guia: a equipe consegue identificar ruptura, justificar compra, registrar movimentos, reconciliar o saldo físico e consultar a trilha sem planilha paralela. A baixa automática por serviço permanece futura e só será implementada quando existir configuração explícita de consumo por serviço/produto.

Após o merge, o `Production Smoke Validation` fecha a evidência de produção do Marco 18.

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

## Marco 19 — CRM, retenção e automações — PRÓXIMO

Objetivo: aumentar retorno de clientes e reduzir trabalho manual.

Escopo:

- segmentação de clientes;
- aniversário;
- inatividade;
- frequência de retorno;
- histórico de atendimentos;
- campanhas e templates;
- métricas de reativação;
- opt-out e regras de comunicação.

Critério de saída:

- o salão consegue identificar quem deve receber follow-up e executar a ação dentro do produto;
- segmentações são explicáveis e tenant-scoped;
- automações respeitam opt-out e regras de comunicação;
- Quality Gate, Production Gate e smoke específicos ficam verdes.

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

Critério de saída: o agente automatiza casos previstos sem inventar preço, serviço, horário ou política.

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
- Agenda e Estoque reais validados;
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
- [`docs/usuario/10_AGENDA_COMERCIAL.md`](docs/usuario/10_AGENDA_COMERCIAL.md)
- [`docs/usuario/11_ESTOQUE_OPERACIONAL.md`](docs/usuario/11_ESTOQUE_OPERACIONAL.md)
