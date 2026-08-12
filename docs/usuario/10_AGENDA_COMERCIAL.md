# Agenda Comercial — Guia de Operação

Este guia registra o fluxo operacional consolidado no Marco 17 do GlossFlow.

## Objetivo

A Agenda deve ser o ponto principal de trabalho do salão. A equipe não deve precisar manter uma planilha ou agenda paralela para decidir onde criar, mover ou encaixar atendimentos.

## Quem pode fazer o quê

### ADMIN

Pode planejar e operar a Agenda, criar e reagendar atendimentos, acompanhar presença, usar Smart Fit, operar a Lista de Espera e configurar a jornada da equipe.

### RECEPTION

Pode executar o mesmo fluxo operacional de Agenda necessário ao atendimento diário, sem receber acessos administrativos sensíveis fora do seu papel.

### PROFESSIONAL

Possui Agenda em modo somente leitura. O perfil não recebe drag-and-drop, botão de reagendamento, Lista de Espera, Jornada da Equipe ou Operação do Dia.

## Central da Agenda

A aba **Agenda** reúne dois níveis de trabalho:

1. **Planejamento** — Agenda Enterprise com visões Dia, Semana, Mês e Profissionais.
2. **Operação** — atalhos para Operação do Dia, Encaixe Inteligente, Lista de Espera e Jornada da Equipe.

O fluxo recomendado para ADMIN/RECEPTION é:

```text
Cliente solicita horário
        ↓
Agenda valida profissional, duração e jornada
        ↓
Salão cria ou ajusta o atendimento
        ↓
WhatsApp comunica/acompanha o cliente
        ↓
Cancelamento ou mudança libera espaço
        ↓
Smart Fit / Lista de Espera reaproveitam a capacidade
```

## Filtros comerciais

A Agenda Enterprise permite combinar:

- profissional;
- serviço;
- status do atendimento.

Os filtros afetam as visualizações e os indicadores exibidos. O botão **Limpar filtros** remove os três filtros de uma só vez.

Use os filtros para responder rapidamente perguntas como:

- quais horários de uma profissional ainda estão ocupados hoje;
- quantos atendimentos de determinado serviço existem na semana;
- quais atendimentos já foram concluídos;
- onde existem cancelamentos ou no-show no período.

## Operação do Dia

A tela **Operação do Dia** é destinada a ADMIN/RECEPTION e concentra o trabalho em tempo real.

Ela permite:

- visualizar o dia ou a semana;
- filtrar por profissional;
- criar atendimento em um espaço livre;
- mover atendimento por drag-and-drop;
- alterar o horário por formulário;
- registrar chegada do cliente;
- marcar atendimento em andamento;
- concluir, cancelar ou registrar no-show conforme o fluxo existente;
- criar bloqueios na jornada;
- visualizar confirmação e lembretes associados ao agendamento.

O sistema valida jornada, duração, capacidade, profissional e conflito antes de persistir uma movimentação.

## Conflitos e indisponibilidade

Quando um horário não pode ser utilizado, a Agenda deve informar o motivo em vez de sobrescrever outro atendimento.

Exemplos de bloqueio:

- profissional já possui atendimento no período;
- serviço não cabe integralmente na jornada;
- profissional não executa o serviço;
- horário está fora do expediente ou em bloqueio/pausa.

Ao receber um conflito, a equipe deve escolher outro horário ou usar **Encaixe Inteligente**.

## Encaixe Inteligente — Smart Fit

O Smart Fit procura blocos livres compatíveis com:

- serviço e duração;
- profissional habilitado;
- jornada;
- pausas e bloqueios;
- atendimentos existentes.

O ranking prioriza encaixes que reduzem espaços ociosos e preservam blocos maiores quando possível.

## Lista de Espera

Use a Lista de Espera quando não existir um horário adequado para o cliente.

A operação permite:

- visualizar pedidos ativos;
- priorizar clientes;
- executar uma varredura de encaixe;
- enviar uma oferta quando houver vaga compatível;
- remover ou reativar uma entrada.

Cancelamentos e reagendamentos que liberam espaço disparam o fluxo de reaproveitamento da vaga.

## Confirmação, lembretes e cancelamento

A mesa operacional consolida os sinais já registrados pelo sistema:

- confirmação de presença do cliente;
- lembrete principal;
- lembrete próximo do atendimento;
- estado operacional de chegada/atendimento.

Na criação rápida, a resposta informa se a notificação ao cliente foi enviada. Em falha de entrega, o horário continua registrado e a equipe recebe contexto para confirmar o contato manualmente.

No cancelamento, o GlossFlow libera o espaço e pode acionar a Lista de Espera para reaproveitar a capacidade.

## Checklist de um dia sem agenda paralela

Antes de considerar a operação do salão independente de planilha, confirme:

- [ ] equipe e serviços estão cadastrados;
- [ ] jornadas, pausas, férias e bloqueios estão corretos;
- [ ] criação rápida registra o cliente e o horário;
- [ ] conflitos impedem dupla ocupação;
- [ ] reagendamento mantém duração e profissional válidos;
- [ ] chegada e atendimento podem ser acompanhados na tela operacional;
- [ ] cancelamentos liberam a vaga;
- [ ] Smart Fit encontra alternativas quando existirem;
- [ ] Lista de Espera pode reaproveitar vagas liberadas;
- [ ] confirmação e lembretes aparecem no contexto do atendimento;
- [ ] WhatsApp informa sucesso ou falha de entrega sem esconder o estado real do agendamento;
- [ ] ADMIN/RECEPTION conseguem trabalhar sem recurso externo de agenda;
- [ ] PROFESSIONAL permanece somente leitura.

## Evidência automatizada do Marco 17

O Marco 17 adicionou testes específicos para:

- criação rápida pela recepção;
- bloqueio de conflito antes da persistência;
- conflito de reagendamento;
- cancelamento com notificação e reaproveitamento da vaga;
- consolidação de presença, confirmação e lembretes;
- filtros por profissional, serviço e status;
- central comercial por papel;
- Agenda somente leitura para profissional.
