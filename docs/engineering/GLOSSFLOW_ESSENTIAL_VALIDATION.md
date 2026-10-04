# GlossFlow Essential — validação de 04/10/2026

## Recuperação da branch

- `main` preservada no commit `acb5f97557955d66b80ae73429141542b8effa83`.
- Branch incorreta preservada em `backup/glossflow-essential-20261004`, commit `4e458f993f1c5980d8ffec079c51344d9945b3d3`.
- `feat/glossflow-essential` reconstruída a partir da `main`. A primeira correção está em `a6ac4be`.
- Nenhuma exclusão de arquivo da `main` faz parte da recuperação. Os commits antigos não foram aplicados integralmente, pois continham árvores incompletas.

## Entregas

- Direção de UX recuperada em `docs/GLOSSFLOW-ESSENTIAL-UX.md`.
- Login profissional abre Minha agenda de hoje, usa `startTime` da API, mostra duração, estado traduzido e próximo atendimento. Outros dias abre agenda somente leitura.
- `/admin/appointments` deriva o profissional de `Professional.userId` e do salão da sessão. Sem vínculo ativo único, responde 403 antes de ler atendimentos. Parâmetros da URL não substituem essa identidade.
- Notificações operacionais ficam restritas a administrador/recepção para não expor atendimentos da equipe ao profissional.
- Administrador vincula contas ativas com papel PROFESSIONAL em Gestão completa → Profissionais → Contas da equipe. Conta de outro salão é rejeitada. Recepção e profissional não podem alterar esse vínculo.
- A equipe administrativa é carregada por `/admin/professionals` usando o salão da sessão, mesmo se o login começar pela vitrine pública de outro salão. A agenda completa do profissional deriva sua equipe dos atendimentos já filtrados.
- Login administrador abre Meu negócio hoje. Previsão exclui cancelamentos/faltas; recebido considera apenas receitas pagas com referência no dia. Módulos desabilitados aparecem como indisponíveis.
- Agendamento direto: `/?action=booking&salon=SLUG`. Os parâmetros opcionais `service=ID` e `professional=ID` só pré-selecionam registros válidos carregados pelo salão e profissional elegível ao serviço.
- Cliente escolhe serviço → profissional opcional → dia/horário → nome/WhatsApp → confirmação. E-mail e observações ficam em informações opcionais. Não exige conta.
- Respostas atrasadas de disponibilidade de outro dia são descartadas; trocar serviço remove o horário anterior.

## Verificação

Ambiente: Windows, Node 22.23.3. Os comandos `npm test` iniciam testes em UTC para os cenários existentes com datas fixas; três testes de backend fixam também a data do cenário. O fuso da aplicação não foi alterado.

- Backend: geração Prisma, lint TypeScript, build e 181 testes passaram.
- Frontend: lint ESLint, build com orçamento de bundles e 88 testes passaram.
- Gate de higiene do repositório e `git diff --check` passaram.
- Auditorias npm de frontend/backend sem vulnerabilidades após atualização do Fastify 5.12.5, Vitest 4.1.11 e dependências transitivas. O watcher antigo `ts-node-dev`, sem correção disponível para sua cadeia vulnerável, foi substituído pelo modo watch nativo do Node com o mesmo registro ts-node.
- O check responsivo de PR agora compila a própria branch, usa preview e fixture pública locais e abre também a confirmação do agendamento. O disparo manual continua verificando o site publicado. A fixture não acessa banco ou provedores reais.
- Navegador: login por perfil, acesso à gestão completa, agenda profissional somente leitura e confirmação pública exercitados com API local de dados fictícios.
- Layouts de hoje e agendamento verificados em 320, 430, 768, 1024, 1920 e 2560 px. Sem transbordamento horizontal global. Campos e confirmação do agendamento com altura de 48 px após a correção.

## Limites e ativação

Não houve alteração do banco de produção, merge na main ou implantação manual. Os testes HTTP usam a aplicação Fastify com persistência simulada; a navegação usa dados fictícios locais. MongoDB real, entrega de WhatsApp, pagamentos e implantação em produção não foram homologados nesta execução.

Os checks da Vercel indicam implantação bloqueada na conta; o site publicado retornou 402 / Deployment Paused no smoke anterior. Esse impedimento externo não foi contornado nem apresentado como implantação bem-sucedida.

Antes de disponibilizar a nova versão, o build da API deve gerar o cliente Prisma com o campo opcional `Professional.userId`. O administrador deve vincular as contas existentes aos profissionais; não há associação automática por nome ou e-mail. Contas ainda sem vínculo receberão a mensagem de configuração pendente, sem acesso à agenda do salão.

Chegou, Finalizar, Reagendar, Cancelar e criação de horários pelo profissional permanecem sujeitos ao RBAC existente, que reserva essas mutações à administração/recepção. Esta fase mantém o profissional em leitura; não oferece botões que o servidor recusaria.
