# Marco 19 — CRM, retenção e automações

Este guia descreve o uso operacional da central de **Clientes / CRM** do GlossFlow após o Marco 19.

## Objetivo

A central de retenção ajuda a equipe a responder quatro perguntas sem planilha paralela:

1. quem precisa de atenção agora;
2. por que esse cliente entrou na fila;
3. se a comunicação de marketing está permitida;
4. se um follow-up iniciado resultou em novo atendimento.

O Marco 19 não dispara campanhas automaticamente por Twilio/Meta. A automação de provider, templates oficiais e regras de janela do WhatsApp pertencem ao Marco 20. Neste marco, o GlossFlow prepara a mensagem, respeita opt-out e registra o follow-up quando a equipe abre o WhatsApp.

## Quem pode usar

- `ADMIN`: acesso ao CRM operacional e às ações de retenção;
- `RECEPTION`: acesso ao CRM operacional e às ações de retenção;
- `PROFESSIONAL`: sem acesso ao CRM;
- `SUPER_ADMIN`: administração da plataforma, não operação do tenant.

Todas as consultas e gravações do Marco 19 usam o `salonId` da sessão autenticada.

## Segmentos

A classificação é determinística e mostra o motivo na própria interface.

### Aniversário próximo

Cliente com aniversário nos próximos **14 dias**. Essa tag tem prioridade operacional alta para que a equipe consiga antecipar o contato.

### Inativo 120+ dias

Cliente cujo último atendimento válido ocorreu há pelo menos **120 dias**.

### Inativo 60+ dias

Cliente cujo último atendimento válido ocorreu há pelo menos **60 dias**, mas menos de 120 dias.

### Cliente frequente

Cliente com **3 ou mais atendimentos nos últimos 90 dias**.

### Cliente ativo

Cliente que não atende às condições anteriores.

Um cliente pode possuir mais de uma tag. Exemplo: aniversário próximo e cliente frequente. A interface mostra um segmento principal e mantém os demais motivos disponíveis.

Agendamentos `CANCELLED` e `NO_SHOW` não contam como visita para recência ou frequência.

## Indicadores

A central mostra:

- total de clientes no CRM;
- clientes elegíveis para comunicação;
- aniversários nos próximos 14 dias;
- clientes inativos há 60 dias ou mais;
- clientes frequentes;
- taxa de reativação após follow-up iniciado.

A taxa de reativação considera clientes que tiveram um follow-up iniciado e depois retornaram para um atendimento válido em até **30 dias**.

## Opt-out e preferência de comunicação

Cada card informa se a comunicação está permitida ou se existe **opt-out ativo**.

### Registrar opt-out

1. Abra `Clientes` no painel administrativo.
2. Localize o cliente.
3. Clique em **Registrar opt-out**.
4. O GlossFlow cria uma nova evidência `MARKETING` no histórico de consentimentos LGPD.
5. O botão **Preparar follow-up** fica bloqueado para esse cliente.

### Liberar comunicação

Use **Liberar comunicação** somente quando houver base operacional para registrar novamente a permissão do cliente. O GlossFlow cria uma nova evidência de consentimento; o registro anterior não é apagado.

O sistema usa sempre o consentimento `MARKETING` mais recente para determinar o estado atual.

## Preparar um follow-up

1. Localize um cliente elegível na fila.
2. Leia o campo **Por quê** para confirmar o motivo da recomendação.
3. Clique em **Preparar follow-up**.
4. O GlossFlow procura um template ativo compatível com o segmento.
5. Se não houver template configurado, usa uma mensagem de fallback segura.
6. A mensagem aparece na área **Contato preparado**.

Preparar a mensagem **não conta como contato executado** e não altera a métrica de reativação.

## Abrir o WhatsApp

Ao clicar em **Abrir WhatsApp**:

- o GlossFlow registra `RETENTION_FOLLOWUP_INITIATED` na auditoria do tenant;
- o WhatsApp é aberto com a mensagem preparada;
- a central passa a considerar esse cliente na base de follow-ups iniciados.

O GlossFlow não afirma que a mensagem foi enviada ou entregue, porque o deep-link não fornece confirmação de entrega ao sistema. Essa confirmação só poderá ser tratada pelo provider no Marco 20.

## Templates de retenção

A central reaproveita `WhatsAppTemplate` quando existe um template ativo para o evento correspondente:

- `RETENTION_BIRTHDAY`;
- `RETENTION_INACTIVE`;
- `RETENTION_FREQUENT`;
- `RETENTION_FOLLOWUP`.

Placeholders suportados na preparação da mensagem:

- `{{cliente}}`;
- `{{nome}}`;
- `{{primeiro_nome}}`;
- `{{salao}}` ou `{{salão}}`.

Se nenhum template ativo existir, o sistema usa um texto local de fallback adequado ao segmento.

## Histórico de atendimentos

Clique em **Histórico** no card de um cliente para carregar sob demanda até **50 atendimentos**, incluindo quando disponível:

- data e hora;
- status;
- serviço;
- profissional;
- observações persistidas no agendamento.

O histórico é carregado somente para o cliente selecionado e sempre dentro do tenant autenticado.

## Filtros da fila

A central permite:

- busca por nome, telefone, e-mail ou motivo;
- filtro por aniversário;
- filtro por inatividade 60+;
- filtro por inatividade 120+;
- filtro por frequência;
- filtro por clientes ativos;
- filtro por opt-out.

## Rotina recomendada

### Início do dia

1. Abra `Clientes`.
2. Veja aniversários próximos.
3. Veja inativos 120+.
4. Veja inativos 60+.
5. Priorize clientes com motivo claro e comunicação permitida.

### Antes do contato

1. Confira o motivo da segmentação.
2. Abra o histórico se precisar de contexto.
3. Confirme se o opt-out está inativo.
4. Prepare a mensagem.
5. Revise o texto antes de abrir o WhatsApp.

### Após alguns dias

Use o indicador de reativação como sinal de resultado. Ele representa retorno após follow-up iniciado, não atribuição perfeita de causa comercial.

## Regras de segurança operacional

- não contornar opt-out por outro botão do sistema;
- não usar a fila como justificativa para spam;
- revisar a mensagem antes de abrir o WhatsApp;
- não afirmar que o GlossFlow enviou ou entregou a mensagem quando o contato foi aberto por deep-link;
- não alterar manualmente dados de outro salão;
- usar histórico e motivo da segmentação antes de abordar o cliente.

## Evidências automatizadas do Marco 19

No head funcional do marco:

- backend: **57/57 testes**;
- frontend: **53/53 testes**;
- repository hygiene: **success**;
- `npm audit --audit-level=high`: **0 vulnerabilidades** no backend e frontend;
- TypeScript/ESLint: **success**;
- builds: **success**;
- preview Vercel: **READY**.

## Limite intencional para o Marco 20

O Marco 19 encerra identificação, segmentação, consentimento, preparação, auditoria de follow-up iniciado e métrica de reativação. O próximo marco deve fechar a camada de atendimento automatizado com provider real, incluindo:

- base de conhecimento por salão;
- regras de catálogo e políticas do tenant;
- templates oficiais quando necessários;
- janela de atendimento do WhatsApp;
- criação/reagendamento/cancelamento com confirmação explícita;
- handoff humano;
- métricas de resolução e entrega;
- proteção contra alucinação e ação sem confirmação.
