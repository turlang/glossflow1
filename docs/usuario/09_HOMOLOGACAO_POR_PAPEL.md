# Homologação Funcional por Papel — GlossFlow

Este checklist registra o contrato funcional mínimo do Marco 16. A autorização real é feita no backend; o frontend deve esconder ações que o papel não pode executar.

## SUPER_ADMIN

Deve acessar:

- painel global da plataforma;
- clientes/tenants;
- planos e assinaturas;
- módulos contratados;
- Site & Marca;
- custos externos e infraestrutura.

Não deve operar módulos internos de um salão usando o painel tenant.

Checklist:

- [x] acesso ao `/platform-admin`;
- [x] redirecionamento do painel tenant para administração global;
- [x] bloqueio backend em `/admin/appointments`;
- [x] isolamento entre plataforma e tenant testado automaticamente.

## ADMIN

Deve possuir operação completa do salão dentro dos módulos contratados:

- Dashboard e implantação;
- métricas;
- serviços e profissionais;
- vitrine;
- Agenda;
- estoque;
- usuários;
- CRM;
- financeiro e comissões;
- fidelidade;
- consulta de assinatura;
- automações e Assistente IA;
- segurança, observabilidade e integrações.

Checklist:

- [x] menu administrativo completo;
- [x] usuários restritos ao tenant da sessão;
- [x] Agenda leitura/escrita;
- [x] CRM, Estoque e Financeiro protegidos por tenant;
- [x] ações críticas cobertas por RBAC e testes.

## RECEPTION

Deve operar atendimento e relacionamento sem administrar credenciais, financeiro sensível ou segurança:

- Dashboard;
- implantação operacional;
- serviços e profissionais;
- vitrine;
- Agenda;
- estoque;
- CRM;
- fidelidade;
- automações/WhatsApp;
- Assistente IA;
- UX/PWA.

Não deve acessar:

- Usuários;
- Financeiro e Comissões;
- Assinatura;
- Segurança;
- Observabilidade administrativa;
- configurações exclusivas do SUPER_ADMIN.

Checklist:

- [x] endpoints exclusivos do ADMIN não são buscados pelo frontend;
- [x] `/admin/users` retorna 403;
- [x] `/admin/financial` retorna 403;
- [x] CRM permanece disponível quando contratado;
- [x] Agenda operacional e lista de espera permanecem disponíveis.

## PROFESSIONAL

O papel Profissional é deliberadamente restrito nesta versão.

Deve acessar:

- Dashboard operacional mínimo;
- Agenda em modo somente leitura;
- Smart Fit somente leitura quando aplicável;
- recursos locais de UX/PWA.

Não deve acessar ou executar:

- usuários;
- CRM;
- estoque;
- financeiro;
- comissões;
- assinatura;
- automações/WhatsApp;
- administração de jornada da equipe;
- lista de espera operacional;
- reagendamento;
- criação rápida da recepção;
- alteração de estado operacional de terceiros.

Checklist:

- [x] frontend não exibe módulos administrativos proibidos;
- [x] URLs diretas proibidas são normalizadas para o dashboard;
- [x] Agenda remove drag-and-drop e botão Reagendar;
- [x] backend mantém GET da Agenda;
- [x] backend rejeita PUT de agendamento;
- [x] backend rejeita lista de espera administrativa;
- [x] backend rejeita mesa operacional da recepção;
- [x] backend rejeita CRM.

## Estados de interface

Para todos os papéis:

- [x] sessão inválida/expirada redireciona para login;
- [x] 403 isolado não deve apagar uma sessão válida;
- [x] módulo não contratado usa estado explícito de indisponibilidade;
- [x] estados vazios não devem parecer erro de layout;
- [x] tema escuro preserva contraste de controles nativos;
- [x] cabeçalhos não esticam em páginas de pouco conteúdo.

## Validação automatizada do Marco 16

Frontend:

- matriz de menu por papel;
- navegação direta e normalização de página;
- matriz de endpoints carregados por papel;
- Agenda somente leitura para Professional.

Backend:

- SUPER_ADMIN global vs tenant;
- ADMIN em usuários;
- RECEPTION em CRM e bloqueio financeiro/usuários;
- PROFESSIONAL em Agenda somente leitura e bloqueio das mutações operacionais.

O Marco 16 só pode ser encerrado com Quality Gate, Production Gate e smoke pós-deploy verdes.
