# GlossFlow — Relatório de Higienização Reconstruído

Data-base: 2026-08-11.

## Contexto da reconstrução

O Marco 1 permanecia preservado no `main`, mas os artefatos correspondentes aos Marcos 2–9 descritos no relatório de higienização original não estavam presentes no GitHub. A reconstrução foi executada sobre a branch `agent/rebuild-hygiene-m2-9`, mantendo o `main` intacto e usando os Quality/Production Gates como critério de aceitação.

O objetivo continua sendo reduzir dívida técnica sem alterar os fluxos validados de Agenda, estoque, CRM e WhatsApp.

## Marco 1 — preservado

O estado existente foi mantido: guard de higiene do repositório, documentação de engenharia, configuração extraída, proteção contra artefatos legados e separação inicial do bootstrap/configuração.

## Marco 2 — reconstruído

O painel administrativo foi decomposto por responsabilidade:

- `AdminOverview.jsx`;
- `AdminCatalog.jsx`;
- `AdminOperations.jsx`;
- `AdminFinance.jsx`;
- `AdminIntelligence.jsx`;
- `AdminPlatformModules.jsx`.

`AdminDashboard.jsx` voltou a atuar como shell de navegação e composição.

O frontend recuperou ESLint real com JavaScript, JSX, Hooks e Fast Refresh. O pipeline voltou a usar lint como gate, não build de desenvolvimento disfarçado.

As dependências também foram alinhadas ao marco reconstruído:

- Fastify `5.11.3`;
- `@fastify/cors` `11.3.0`;
- Vite `8.2.1`;
- `@vitejs/plugin-react` `6.0.5`;
- Node `20.19+` como mínimo do toolchain.

## Marco 3 — reconstruído

A Agenda Enterprise voltou a ter domínio próprio. As regras de calendário foram extraídas para `agenda-enterprise.utils.js`, incluindo:

- datas locais sem deslocamento acidental por UTC;
- grade semanal;
- grade mensal;
- filtros e ordenação;
- métricas de ocupação/capacidade;
- navegação entre dia, semana e mês;
- construção segura do horário de reagendamento.

A capacidade mensal usa a quantidade real de dias do mês, inclusive fevereiro bissexto, e a navegação a partir do dia 31 limita corretamente a data no mês de destino.

## Marco 4 — reconstruído

A Agenda foi dividida em componentes específicos:

- `AgendaToolbar.jsx`;
- `AgendaAppointmentCard.jsx`;
- `AgendaDayView.jsx`;
- `AgendaWeekView.jsx`;
- `AgendaMonthView.jsx`;
- `AgendaProfessionalsView.jsx`.

As grades semanal/mensal só são montadas quando visíveis. Tabs possuem semântica e navegação por teclado com setas, Home e End. Um único cartão de agendamento é reutilizado nas visualizações.

## Marco 5 — reconstruído

O reagendamento acessível foi restaurado com:

- ação explícita `Reagendar`;
- formulário operável por teclado;
- foco inicial;
- campos nativos de data/hora/profissional;
- estado ocupado;
- feedback de erro e sucesso;
- formulário preservado quando ocorre conflito.

`useAgendaReschedule.js` centraliza a persistência para formulário e drag-and-drop, eliminando caminhos divergentes.

O frontend possui novamente **17 testes em 3 arquivos**, cobrindo utilitários, interação da Agenda e reagendamento acessível.

## Marco 6 — reconstruído

Foi restaurado `appointment-reschedule.service.ts`, centralizando:

- detecção de alteração de data/profissional;
- início, fim e profissional efetivos;
- filtro tipado de conflito.

A sobreposição usa novamente o contrato correto:

```text
existente.start < novo.fim
E
existente.end > novo.início
```

O schema de atualização rejeita payload vazio e campos desconhecidos.

O backend foi novamente higienizado para **zero ocorrência explícita de `any` em `backend/src`**. Delegates corporativos do Prisma são explícitos para autenticação, auditoria, LGPD, backup e observabilidade, fazendo o build falhar cedo se o Client não corresponder ao schema.

## Marco 7 — reconstruído

A criação do Fastify voltou para `backend/src/app.ts` através de `buildApp()`.

`server.ts` contém apenas efeitos de processo: validação de ambiente, bootstrap do Super Admin, `listen()` e scheduler.

Os contratos HTTP com `Fastify.inject()` foram restaurados para:

- autenticação/cabeçalhos de segurança;
- RBAC antes de operações protegidas;
- normalização Zod para HTTP 400;
- isolamento multi-tenant pelo `salonId` assinado no JWT.

## Marco 8 — reconstruído

`appointments.routes.ts` voltou a ser apenas agregador. O domínio Agenda foi separado em:

- `appointments/public.routes.ts`;
- `appointments/management.routes.ts`;
- `appointments/waitlist.routes.ts`;
- `appointments/admin.routes.ts`;
- `appointments/contracts.ts`;
- `appointments/access.ts`.

As URLs públicas foram preservadas. Testes confirmam o bloqueio do módulo antes de consultas e o isolamento do tenant nos caminhos habilitados.

As folhas de estilo globais foram novamente divididas por domínio, preservando byte a byte a ordem original da cascata durante a migração:

- `styles.css`;
- `public-showcase.css`;
- `ui-primitives.css`;
- `admin-shell.css`;
- `admin-operations.css`;
- `responsive.css`;
- `agenda-enterprise.css`;
- `admin-business.css`;
- `admin-platform.css`.

## Marco 9 — reconstruído

`whatsapp-agent.service.ts` voltou a ser uma fachada de compatibilidade. A implementação foi separada em:

- `whatsapp-agent/contracts.ts`;
- `whatsapp-agent/time.ts`;
- `whatsapp-agent/conversation.repository.ts`;
- `whatsapp-agent/appointment-tools.service.ts`;
- `whatsapp-agent/tools.ts`;
- `whatsapp-agent/orchestrator.service.ts`.

Providers externos entram como `unknown` e são estreitados/validados antes do uso. Criação, cancelamento e reagendamento utilizam contratos de Agenda e isolamento de salão.

O backend possui novamente **18 testes**, compostos por:

- 2 testes de ambiente;
- 5 testes de contrato de reagendamento;
- 4 testes da factory/contratos HTTP;
- 4 testes de isolamento e módulo Agenda;
- 3 testes positivos de mutações de agendamento.

Os blocos `<style>` dos componentes públicos de agendamento foram removidos do JSX e consolidados em `public-booking.css`, preservando precedência de importação.

## Proteções permanentes restauradas

O `repository-hygiene` agora também impede:

- retorno de `any` explícito em `backend/src`;
- retorno de `<style>` dentro dos componentes públicos;
- arquivos de ambiente reais;
- backups/temporários;
- artefatos legados já removidos;
- arquivos acidentais maiores que 5 MB.

Os workflows permanentes são apenas:

- `GlossFlow Quality Gate`;
- `Production Gate`.

Ambos executam auditoria de dependências antes de lint/test/build.

## Validação da reconstrução

A reconstrução funcional dos Marcos 2–9 foi validada pelo GitHub Actions em 2026-08-11:

### Frontend

- `npm ci`: aprovado;
- `npm audit --audit-level=high`: aprovado;
- ESLint: aprovado;
- **17 testes**: aprovados;
- Vite build: aprovado.

### Backend

- `npm ci`: aprovado;
- `npm audit --audit-level=high`: aprovado;
- Prisma generate: aprovado;
- TypeScript/lint: aprovado;
- **18 testes**: aprovados;
- build: aprovado.

### Repositório

- Repository Hygiene: aprovado;
- zero `any` explícito em `backend/src`;
- zero `<style>` nos componentes públicos de agendamento.

## Marco 10 — NÃO iniciado

Conforme a decisão de reconstrução, o trabalho foi interrompido deliberadamente ao final do Marco 9.

O próximo marco continua sendo:

1. migrar CSS embutido remanescente dos componentes administrativos por domínio;
2. ampliar testes contratuais específicos do agente WhatsApp, incluindo fallback do provider e abertura/fechamento do handoff humano;
3. selecionar e refatorar o próximo módulo longo do backend com base em risco e frequência de alteração.

Nenhum item do Marco 10 faz parte desta reconstrução.
