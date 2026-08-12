# GlossFlow — Assistente IA e WhatsApp em Produção

Guia operacional do **Marco 20** para proprietários e recepção.

## Objetivo

O assistente do GlossFlow atende dúvidas comerciais usando somente dados do salão, consulta a Agenda por ferramentas e pode preparar ações de agendamento. A execução de ações sensíveis e de mensagens proativas permanece protegida por regras do servidor.

## 1. O que a IA pode responder

A base factual do agente é construída com dados do próprio salão:

- nome e descrição;
- horário de funcionamento;
- endereço, telefone e Instagram quando cadastrados;
- serviços ativos, preço, duração e descrição.

Disponibilidade e profissionais não são inferidos pelo modelo. O agente deve consultar as ferramentas de Agenda para responder esses pontos.

Quando uma informação não existe no cadastro nem em uma ferramenta, o comportamento esperado é informar que o dado não está cadastrado e, quando necessário, encaminhar para atendimento humano.

## 2. Regra de ouro para a Agenda

Criar, cancelar e reagendar possuem duas etapas obrigatórias:

1. **Proposta** — a IA valida os dados e o servidor registra uma ação pendente.
2. **Confirmação posterior** — o cliente envia uma nova mensagem explícita de confirmação.

A IA não recebe permissão para executar a mutação diretamente. Mesmo que um provider tente incluir um campo como `confirmed=true`, a ferramenta exposta ao modelo apenas prepara a proposta.

### Confirmação

Depois da proposta o cliente recebe orientação para responder **CONFIRMAR**. Somente então o servidor recupera a ação pendente, revalida o estado atual da Agenda e executa a alteração.

Uma resposta ambígua não executa nada. O servidor mantém a proposta pendente e repete a solicitação de confirmação.

### Cancelar a proposta

O cliente pode responder **CANCELAR AÇÃO**. A proposta é encerrada sem alteração na Agenda.

### Expiração

A proposta expira após o tempo configurado em `WHATSAPP_ACTION_CONFIRMATION_TTL_MINUTES` — 10 minutos por padrão. Depois disso uma nova proposta deve ser criada.

## 3. Handoff humano

Quando o cliente pede uma pessoa ou o caso sai do escopo seguro, o agente pode abrir handoff.

O registro de handoff inclui:

- telefone normalizado;
- motivo;
- até seis mensagens recentes da conversa, quando disponíveis.

Assim a equipe recebe contexto para continuar o atendimento. Se a leitura do histórico falhar, o encaminhamento humano ainda é aberto.

## 4. Janela de atendimento do WhatsApp

A política de envio é aplicada pelo servidor, e não pela IA.

### Janela aberta

Quando existe mensagem recebida recentemente do cliente dentro da janela de atendimento, o GlossFlow pode usar mensagem livre pelo provider.

### Janela fechada

Fora da janela, o GlossFlow exige um identificador de template oficial configurado para o evento. Sem esse identificador o envio é bloqueado antes de chamar o provider.

Para retenção, os identificadores de ambiente são:

- `WHATSAPP_TEMPLATE_RETENTION_BIRTHDAY`;
- `WHATSAPP_TEMPLATE_RETENTION_INACTIVE`;
- `WHATSAPP_TEMPLATE_RETENTION_FREQUENT`;
- `WHATSAPP_TEMPLATE_RETENTION_FOLLOWUP`.

No Twilio em produção, use o `ContentSid` correspondente. No provider Meta, use o nome do template aprovado conforme a integração configurada.

## 5. Follow-up pelo CRM

No módulo **Clientes / CRM**:

1. escolha um cliente elegível;
2. clique em **Preparar follow-up**;
3. confira a mensagem;
4. escolha uma das opções:
   - **Abrir WhatsApp** — fluxo manual;
   - **Enviar pelo provider** — fluxo controlado pelo servidor.

O botão **Enviar pelo provider** pede confirmação do operador antes da chamada externa.

O servidor então:

1. revalida o tenant e o módulo WhatsApp;
2. revalida opt-out e telefone;
3. verifica a janela de atendimento;
4. seleciona texto livre ou template;
5. chama o provider;
6. registra o follow-up como iniciado somente depois de sucesso confirmado pela API do provider.

Se o provider falhar, a API retorna falha e o GlossFlow não registra sucesso falso.

> Sucesso da requisição ao provider não significa necessariamente entrega ou leitura. Status de entrega continua dependente dos callbacks do provider.

## 6. Templates internos x templates oficiais

São conceitos diferentes:

- **Template interno do GlossFlow**: conteúdo editável do salão usado para montar a mensagem.
- **Template oficial do provider**: identificador aprovado/configurado para envio quando a política do canal o exige.

A tela **Automações** inclui presets de retenção para aniversário, inatividade, cliente frequente e follow-up geral.

## 7. Métricas operacionais

A tela de homologação do agente apresenta indicadores dos últimos 30 dias:

- contatos recebidos;
- mensagens enviadas;
- falhas do provider;
- ações propostas;
- ações confirmadas;
- ações canceladas/falhas;
- handoffs;
- taxa de sucesso do provider;
- taxa de resolução automática.

A **taxa de resolução automática** é um indicador operacional: considera contato recebido que teve resposta outbound no período e não abriu handoff. Ela não substitui uma pesquisa de satisfação nem prova que o problema do cliente foi resolvido.

## 8. Homologação segura

A tela **WhatsApp · Homologação** usa `/admin/whatsapp/agent-test` e não envia mensagem para Meta/Twilio.

Cenários mínimos antes de ativar um salão:

1. perguntar preço de serviço cadastrado;
2. perguntar algo não cadastrado e verificar ausência de invenção;
3. consultar disponibilidade real;
4. solicitar agendamento e confirmar que a primeira resposta é apenas proposta;
5. enviar mensagem ambígua e confirmar que a Agenda não muda;
6. enviar `CONFIRMAR` e verificar a ação;
7. testar `CANCELAR AÇÃO`;
8. pedir atendimento humano e verificar contexto do handoff;
9. testar follow-up com janela aberta em ambiente controlado;
10. testar janela fechada sem template e confirmar bloqueio;
11. testar template em dry-run antes de qualquer ativação real.

## 9. Configuração mínima de produção

Além das variáveis gerais do backend, revise:

```text
AI_PROVIDER
GROQ_API_KEY ou OPENAI_API_KEY
WHATSAPP_PROVIDER
WHATSAPP_DRY_RUN
WHATSAPP_ACTION_CONFIRMATION_TTL_MINUTES
credenciais do provider
webhook e callback de status
templates oficiais necessários ao salão
```

Não desative `WHATSAPP_DRY_RUN` apenas porque o playground está funcionando. A ativação real deve acontecer depois da configuração do sender, webhook, templates aplicáveis e homologação do número.

## 10. Limites intencionais

O Marco 20 não transforma a IA em fonte de verdade. A fonte de verdade continua sendo banco + regras + ferramentas.

Também não considera uma chamada aceita pelo provider como prova de entrega ou leitura. O GlossFlow mantém os eventos de callback para estados como `sent`, `delivered`, `read`, `failed` e `undelivered` quando o provider disponibiliza esses dados.

## Resultado operacional esperado

Ao concluir este marco, o salão consegue usar o agente para atendimento comercial com:

- fatos restritos ao tenant;
- Agenda consultada em tempo real;
- mutações protegidas por confirmação posterior;
- handoff com contexto;
- follow-up sujeito à política do canal;
- falha de provider sem sucesso falso;
- métricas para acompanhar automação e exceções.
