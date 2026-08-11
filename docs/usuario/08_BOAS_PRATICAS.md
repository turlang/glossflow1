# Boas Práticas de Operação — GlossFlow

## Agenda

- mantenha jornada e bloqueios atualizados;
- use o reagendamento oficial em vez de alterar dados por fora do sistema;
- trate conflito como sinal de agenda ocupada, não como erro a ser contornado;
- registre cancelamento e falta no mesmo dia.

## Clientes

- evite duplicar cadastros;
- mantenha telefone atualizado;
- registre apenas informações úteis ao atendimento;
- não copie dados de clientes para ferramentas pessoais sem necessidade.

## Estoque

- registre movimentações quando elas acontecem;
- faça contagem periódica;
- use **Ajuste** para reconciliar saldo físico e sistema;
- revise produtos abaixo do mínimo antes de faltar material para um atendimento.

## WhatsApp

- confira o número antes de reenviar mensagem;
- não repita envios após erro sem verificar o status;
- encerre handoffs concluídos;
- mantenha mensagens curtas e objetivas;
- nunca informe IDs internos, tokens ou segredos ao cliente.

## IA

A IA deve apoiar a operação, não substituir dados reais. Preço, serviço, profissional e disponibilidade precisam vir dos dados cadastrados e das ferramentas de Agenda.

Em instabilidade do provider, utilize o fallback e encaminhe ao humano quando necessário. Nunca transforme uma falha externa em informação inventada.

## Segurança

- uma conta por pessoa;
- menor privilégio possível;
- sessão encerrada em computadores compartilhados;
- segredos somente em variáveis de ambiente;
- atenção a notificações de segurança e integração;
- reporte comportamento inesperado com horário e operação executada.

## Qualidade dos dados

Indicadores e sugestões são tão confiáveis quanto os registros. Preço, duração, estoque, receita, despesa e status da agenda devem permanecer atualizados.

## Rotina de revisão

**Diária:** agenda, handoffs, notificações e estoque crítico.

**Semanal:** clientes sem retorno, ocupação, financeiro e comissões.

**Mensal:** acessos, módulos, cadastros, jornada, fornecedores e treinamento da equipe.
