# Como usar o GlossFlow SaaS Pro

## 1. Acessar a vitrine

Abra o frontend em `http://localhost:5173`. A vitrine mostra serviços, profissionais, portfólio e botão de agendamento.

## 2. Fazer login no painel

Clique em **Admin** e use:

```txt
admin@glossflow.com
123456
```

## 3. Cadastrar serviços

Entre em **Serviços**. Preencha imagem, nome, descrição, preço e duração. Clique em salvar. Para alterar, use **Editar** na lista.

## 4. Cadastrar profissionais

Entre em **Profissionais**. Cadastre foto, nome, especialidade e biografia. Esses dados aparecem na vitrine pública e no agendamento.

## 5. Cadastrar trabalhos da vitrine

Entre em **Vitrine**. Adicione título, categoria, descrição e imagem do resultado. Use fotos reais do salão para aumentar conversão.

## 6. Visualizar agendamentos

Entre em **Agenda**. Os agendamentos aparecem no modelo semanal com post-its, mantendo a visualização atual escolhida para o projeto.

## 7. Controlar estoque

Entre em **Estoque**. Cadastre produtos, fornecedor, quantidade, quantidade mínima, custo e imagem. Use movimentações para entrada, saída e ajuste.

## 8. Cadastrar clientes

Entre em **Clientes**. Cadastre nome, WhatsApp, e-mail, aniversário, preferências e observações. Clientes que agendam pela vitrine também entram automaticamente no CRM.

## 9. Controlar financeiro

Entre em **Financeiro**. Registre receitas e despesas com categoria, descrição, valor, forma de pagamento e data. O painel mostra receita, despesa e resultado.

## 10. Configurar comissões

Entre em **Comissões**. Cadastre o percentual de cada profissional. O sistema calcula projeções com base nos serviços agendados.

## 11. Criar fidelidade

Entre em **Fidelidade**. Configure o programa e registre pontos por cliente. Use para campanhas de retorno e descontos.

## 12. Configurar assinatura

Entre em **Assinatura**. Veja o plano ativo do salão e altere status. Esse módulo prepara o projeto para venda como SaaS.

## 13. Preparar WhatsApp e IA

Entre em **Automações**. Cadastre templates de WhatsApp e veja insights gerenciais. Em produção, conecte com Evolution API/Twilio e OpenAI API.

## Fase 2 — Central de Automações Visual

A área de **Automações** agora possui um construtor visual de jornada do cliente.

### Como usar

1. Acesse **Admin > Automações**.
2. Clique em um bloco do fluxo, como **Confirmação**, **Lembrete** ou **Avaliação**.
3. O sistema preencherá um modelo de mensagem automaticamente.
4. Personalize o texto usando variáveis como `{nome}`, `{servico}`, `{data}` e `{hora}`.
5. Escolha se a automação ficará **Ativa** ou **Pausada**.
6. Clique em **Salvar automação**.

### Observação técnica

Nesta fase, as automações são templates gerenciáveis dentro do SaaS. O disparo real via WhatsApp deve ser conectado posteriormente a um provedor como Evolution API, Z-API, Twilio ou Meta WhatsApp Cloud API.

## Fase 3 — Assistente IA

A versão 9.2 adiciona uma aba **Assistente IA** no painel administrativo.

### Como usar

1. Acesse o painel administrativo.
2. Clique em **Assistente IA** no menu lateral.
3. Digite uma pergunta, por exemplo:
   - Quem são meus melhores clientes?
   - Quais produtos precisam de reposição?
   - Qual profissional mais faturou?
   - Crie uma campanha para horários vagos.
4. Clique em **Gerar resposta**.

### O que o assistente analisa

- Clientes cadastrados.
- Serviços ativos.
- Profissionais.
- Agendamentos.
- Estoque.
- Receita, despesa e lucro.
- Insights gerenciais já existentes.

### Observação técnica

Nesta fase, o assistente funciona com uma inteligência local determinística, sem depender de API externa. Em produção, a rota `/admin/ai/assistant` pode ser conectada a OpenAI, filas, cache, auditoria e histórico persistente.

## Dashboard Executivo

1. Acesse o painel administrativo.
2. Clique em **Dashboard** na barra lateral.
3. Acompanhe receita, lucro, ticket médio, retenção e previsão mensal.
4. Use os botões de ação rápida para abrir automações, financeiro, comissões ou o Assistente IA.
