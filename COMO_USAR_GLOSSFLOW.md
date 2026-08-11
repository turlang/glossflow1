# Como usar o GlossFlow Smart

Este guia descreve o comportamento atual do produto. Para arquitetura e padrões de código, consulte `docs/engineering/`.

## 1. Vitrine pública

A vitrine apresenta marca do salão, serviços, equipe, portfólio e acesso ao agendamento online. O tenant pode ser resolvido por slug, subdomínio ou domínio próprio conforme a configuração da plataforma.

## 2. Acesso administrativo

Use uma conta provisionada para o salão. Não existem credenciais fixas recomendadas para produção.

Papéis principais:

- `SUPER_ADMIN`: administração global da plataforma;
- `ADMIN`: gestão completa do tenant;
- `RECEPTION`: operação permitida de agenda/CRM/estoque e módulos liberados;
- `PROFESSIONAL`: acesso operacional limitado.

## 3. Serviços e profissionais

Cadastre serviços com preço, duração e informações públicas. Depois configure quais serviços cada profissional pode executar e a jornada individual de trabalho, incluindo pausas e bloqueios.

## 4. Agenda

O módulo Agenda inclui:

- disponibilidade pública;
- validação de conflito;
- capacidade por profissional;
- jornada individual;
- visão operacional dia/semana;
- reagendamento;
- estados operacionais de atendimento;
- Smart Fit;
- lista de espera.

As regras críticas são sempre validadas novamente no backend.

## 5. Confirmação do cliente

Depois de um agendamento público, o cliente recebe:

- protocolo;
- política de cancelamento;
- link seguro de gerenciamento;
- tentativa de confirmação pelo WhatsApp quando o módulo estiver ativo.

O GlossFlow diferencia uma solicitação aceita pelo provider de uma mensagem realmente entregue. No fluxo Twilio, callbacks podem registrar `sent`, `delivered`, `read`, `failed` ou `undelivered`.

## 6. WhatsApp

A integração operacional atual usa Twilio.

Entrada:

```text
WhatsApp -> Twilio -> /webhooks/whatsapp/twilio -> GlossFlow
```

Status de entrega:

```text
Twilio -> /webhooks/whatsapp/twilio/status -> GlossFlow
```

O Sandbox/Trial serve somente para QA e possui limitações de templates/recipientes. Um WhatsApp Sender completo é necessário para operação real com clientes.

## 7. CRM

Clientes podem ser cadastrados manualmente e também são criados/relacionados durante o agendamento público. O CRM mantém dados de contato, preferências, observações e histórico relacionado.

## 8. Estoque

Cadastre produtos com categoria, fornecedor, unidade, saldo, mínimo e valores. Use movimentações explícitas para entrada, saída e ajuste. Produtos com histórico são desativados logicamente em vez de apagados fisicamente.

## 9. Financeiro e comissões

O ADMIN pode registrar receitas/despesas e regras de comissão. Esses dados alimentam indicadores do painel executivo.

## 10. Fidelidade

O programa de fidelidade permite configurar regra de pontos e registrar movimentações por cliente conforme permissões do tenant.

## 11. IA

O provider principal atual é Groq. O agente e os recursos inteligentes devem usar a camada de provider do backend e nunca expor chave da IA ao navegador.

## 12. Super Admin

A administração global controla tenants, módulos, planos e configurações de plataforma. Site & Marca e decisões globais não devem ser alterados por usuários comuns do salão.

## 13. Atualização de dados

Após operações administrativas, o frontend executa atualização silenciosa dos dados do backoffice para preservar a tela/aba atual. Falhas em um endpoint sem permissão não devem ser tratadas automaticamente como sessão expirada.

## 14. Segurança operacional

- nunca compartilhar tokens ou senhas em prints;
- não executar `npm run seed` em banco de produção com dados reais;
- não versionar `.env`;
- confirmar o tenant antes de alterações administrativas;
- validar o Quality Gate após mudanças de código.
