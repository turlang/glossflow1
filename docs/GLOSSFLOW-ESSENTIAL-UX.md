# GlossFlow Essential — direção de produto e UX

## Objetivo

Transformar o GlossFlow atual em uma experiência simples, prática e orientada ao papel do usuário, preservando backend, regras de negócio, RBAC e módulos avançados já existentes.

Princípio central:

> A complexidade fica no sistema, não no usuário.

A tela inicial nunca deve ser um catálogo de módulos. Ela deve responder à necessidade imediata do perfil autenticado.

## 1. Experiência por perfil

### Profissional

Primeira tela após login: **Minha agenda de hoje**.

Informação primária:
- data atual;
- atendimentos do próprio profissional em ordem cronológica;
- horário, cliente, serviço, duração e estado;
- horários livres quando fizer sentido;
- próximo atendimento em destaque.

Ações primárias:
- Chegou;
- Finalizar;
- Reagendar;
- Cancelar;
- WhatsApp;
- Novo agendamento;
- Ver outros dias / agenda completa.

O profissional não deve precisar navegar pelo dashboard administrativo para trabalhar.

### Administrador

Primeira tela após login: **Meu negócio hoje**.

Informação primária:
- atendimentos do dia;
- concluídos;
- faturamento previsto;
- recebido no dia;
- próximos atendimentos;
- resumo da equipe;
- alertas operacionais importantes.

Ação primária: **Ver gestão completa**.

Os módulos atuais continuam disponíveis na gestão completa, sem competir com a operação diária na primeira tela.

### Cliente

Entrada preferencial: Instagram, WhatsApp, Google, QR Code ou link compartilhado.

Fluxo público:

1. Escolher serviço;
2. Escolher profissional, opcionalmente;
3. Escolher horário;
4. Informar nome e WhatsApp;
5. Confirmar.

Não exigir login antes de demonstrar intenção de agendamento. O site/vitrine institucional deixa de ser passagem obrigatória.

## 2. Social-first

O GlossFlow não substitui Instagram ou WhatsApp. Ele transforma tráfego social em agendamento e operação organizada.

Links públicos devem poder levar diretamente ao agendamento e, futuramente, pré-selecionar serviço, profissional e origem da campanha.

## 3. Responsividade

Mobile-first, sem tratar desktop como celular esticado.

Faixas mínimas de homologação:
- 320–430 px: celulares;
- 768–1024 px: tablets;
- 1024–1920 px: notebooks e desktops;
- acima de 1920 px: telas grandes / ultrawide.

Regras:
- nenhuma ação essencial depende de hover;
- alvos de toque confortáveis;
- navegação e densidade adaptam-se ao espaço;
- conteúdo essencial não desaparece em telas pequenas;
- desktop pode acrescentar contexto sem alterar o fluxo principal;
- suportar orientação retrato/paisagem, zoom e teclado virtual.

## 4. Regras de simplificação

1. Se o GlossFlow já possui a informação, não perguntar novamente.
2. Se pode calcular com segurança, não pedir para digitar.
3. Se pode automatizar sem retirar controle necessário, não criar trabalho manual.
4. Uma tarefa cotidiana deve exigir o menor número razoável de decisões.
5. Recursos avançados permanecem disponíveis, mas aparecem apenas quando necessários.
6. Não duplicar cadastro entre agenda, cliente, financeiro, comissão e estoque.
7. Linguagem da interface deve refletir o trabalho do salão/clínica, não a arquitetura do software.

## 5. Estratégia de migração

Não reconstruir o produto do zero.

Classificar cada tela e fluxo atual como:
- **ESSENCIAL**: pertence à experiência diária;
- **SECUNDÁRIO**: permanece na gestão completa;
- **AUTOMATIZÁVEL**: deve exigir menos intervenção;
- **REMOVÍVEL**: não gera valor suficiente para permanecer na experiência principal.

Ordem de implementação:
1. fundação de navegação por perfil;
2. Profissional → Agenda de hoje;
3. Administrador → Meu negócio hoje;
4. Cliente → agendamento direto;
5. simplificação da gestão completa;
6. social-first e mensuração de origem;
7. homologação responsiva e acessibilidade.

## 6. Critérios de aceite da primeira transformação

### Profissional
- após login chega diretamente à agenda de hoje;
- entende o próximo atendimento sem abrir menu;
- consegue acessar outros dias com uma ação clara;
- ações essenciais funcionam em celular, tablet e desktop.

### Administrador
- após login entende a situação operacional e financeira do dia;
- consegue chegar à gestão completa por uma ação explícita;
- dashboard inicial não expõe a lista inteira de módulos.

### Cliente
- consegue iniciar o agendamento sem criar conta;
- fluxo serviço → profissional opcional → horário → identificação → confirmação;
- experiência otimizada para links vindos de redes sociais.

## 7. Não objetivos desta fase

- remover módulos avançados já implementados;
- reescrever backend sem necessidade comprovada;
- alterar regras de autorização apenas para simplificar a interface;
- adicionar novas funcionalidades sem ligação direta com os três fluxos principais;
- redesenhar telas isoladamente sem um padrão responsivo comum.
