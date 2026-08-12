# Marco 21 — Super Admin, planos e ciclo de vida SaaS

Este guia descreve o fluxo comercial e operacional do GlossFlow para cadastrar, ativar, suspender, reativar e administrar um salão sem edição manual no banco de dados.

## Objetivo

O Super Admin passa a operar o ciclo completo de um cliente SaaS dentro do GlossFlow:

1. cadastrar o tenant;
2. criar o primeiro usuário `ADMIN`;
3. escolher plano e estado inicial da assinatura;
4. definir os módulos contratados;
5. preparar os dados de billing;
6. configurar Site & Marca e domínio;
7. registrar custos externos do tenant;
8. alterar o ciclo comercial com trilha de auditoria.

O provisionamento é tenant-scoped. O `SUPER_ADMIN` administra a plataforma, mas não se transforma em usuário operacional de um salão.

---

## 1. Provisionar um novo cliente

No Super Admin, abra **Clientes** e use **Provisionar salão completo**.

O fluxo possui cinco etapas.

### Etapa 1 — Salão

Informe:

- nome;
- slug único;
- telefone;
- WhatsApp;
- endereço;
- horário de funcionamento;
- Instagram, se houver;
- descrição.

O slug identifica o tenant em previews e rotas white-label. Não reutilize o slug de outro cliente.

### Etapa 2 — Administrador

Cadastre a conta principal do cliente:

- nome;
- e-mail único na plataforma;
- senha inicial com pelo menos 12 caracteres.

A conta é criada com papel `ADMIN` e vinculada exclusivamente ao novo `salonId`.

### Etapa 3 — Contrato

Escolha:

- plano ativo;
- estado inicial `TRIAL` ou `ACTIVE`;
- data de fim, quando aplicável;
- provider de billing.

Se um `TRIAL` for criado sem data, o backend usa `SAAS_DEFAULT_TRIAL_DAYS`.

### Etapa 4 — Módulos

Selecione apenas o que foi contratado. O plano comercial e os módulos são controles diferentes: o plano representa a oferta/preço e os módulos representam o entitlement efetivo do tenant.

Exemplos de módulos:

- Site & Marca;
- Agenda;
- Estoque;
- CRM;
- Financeiro;
- Fidelidade;
- WhatsApp;
- IA;
- Analytics.

### Etapa 5 — Revisão

Confirme os dados e execute **Provisionar cliente SaaS**.

O backend cria, na ordem lógica:

- `Salon`;
- usuário `ADMIN`;
- `SalonSubscription`;
- módulos contratados;
- perfil inicial de billing;
- eventos de auditoria.

Se uma etapa interna falhar depois da criação inicial, o serviço executa limpeza compensatória para não deixar um tenant parcialmente provisionado.

---

## 2. Estados da assinatura

O GlossFlow usa quatro estados comerciais.

### `TRIAL`

Cliente em avaliação.

- acesso permitido enquanto `endsAt` não venceu;
- se não houver data no provisionamento, aplica o prazo padrão configurado;
- depois do vencimento, login e operação ficam bloqueados.

### `ACTIVE`

Contrato ativo.

- operação liberada;
- módulos continuam controlando quais recursos podem ser usados.

### `PAST_DUE`

Contrato com pendência financeira.

- pode operar até o fim da janela de graça em `endsAt`;
- se a data não for informada ao entrar em `PAST_DUE`, o backend usa `SAAS_PAST_DUE_GRACE_DAYS`;
- depois da graça, o acesso é bloqueado.

### `CANCELED`

Contrato encerrado.

- novas operações privadas são bloqueadas;
- novos agendamentos públicos são bloqueados;
- sessões ativas do tenant são revogadas;
- dados, Site & Marca, histórico e configuração não são apagados.

Esse comportamento permite reativação sem reconstruir o salão.

---

## 3. Transições permitidas

O servidor, e não apenas a interface, valida o ciclo.

| Estado atual | Próximos estados permitidos |
|---|---|
| `TRIAL` | `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELED` |
| `ACTIVE` | `ACTIVE`, `PAST_DUE`, `CANCELED` |
| `PAST_DUE` | `PAST_DUE`, `ACTIVE`, `CANCELED` |
| `CANCELED` | `CANCELED`, `ACTIVE` |

Um cliente cancelado não volta para `TRIAL`; ele deve ser reativado como `ACTIVE`.

---

## 4. O que o bloqueio contratual afeta

O ciclo SaaS é aplicado antes do entitlement de módulo.

Para um tenant bloqueado, o GlossFlow impede:

- novo login de usuários do salão;
- renovação de sessão por refresh token;
- rotas operacionais autenticadas;
- rotas de negócio autenticadas;
- rotas administrativas críticas do tenant;
- consulta/criação de novos horários pelo fluxo público de Agenda.

O `SUPER_ADMIN` continua conseguindo acessar o painel global para corrigir o contrato.

Tenants antigos que ainda não possuem `SalonSubscription` permanecem em modo de compatibilidade até serem migrados comercialmente pelo Super Admin.

---

## 5. Reativação

Para reativar um salão cancelado:

1. abra **Clientes**;
2. escolha **Gerenciar cliente**;
3. confirme o plano;
4. altere o status para `ACTIVE`;
5. salve o ciclo de assinatura;
6. confirme se o usuário `ADMIN` está ativo;
7. peça um novo login ao cliente.

As sessões antigas continuam revogadas. O cliente deve autenticar novamente.

---

## 6. Acesso do ADMIN do cliente

No gerenciamento do salão é possível alterar:

- nome do ADMIN principal;
- e-mail;
- estado ativo/inativo;
- senha.

Alterar senha ou desativar a conta revoga sessões desse administrador.

A senha nunca é gravada nos metadados de auditoria.

---

## 7. Billing

O painel **Ciclo SaaS — Billing e acesso contratual** registra a preparação comercial por tenant.

Campos disponíveis:

- provider: `MANUAL`, `MERCADO_PAGO`, `STRIPE` ou `OTHER`;
- Customer ID;
- referência/ID da assinatura externa;
- próxima cobrança;
- observações.

### Limite intencional do Marco 21

Salvar o perfil de billing **não cria, cobra, cancela nem altera uma assinatura no gateway externo**.

O objetivo deste marco é tornar a plataforma pronta para integrar billing real com rastreabilidade, mantendo a fonte de verdade do estado operacional em `SalonSubscription`.

Para `MANUAL`, o perfil é considerado operacionalmente preparado sem IDs externos. Para providers externos, o painel considera preparado quando Customer ID e referência de assinatura estão preenchidos.

---

## 8. Site & Marca e domínio

Site & Marca permanece responsabilidade exclusiva do `SUPER_ADMIN`.

Ao atualizar white-label ou domínio, o GlossFlow audita por tenant:

- domínio anterior e novo;
- template;
- cores principais;
- alteração de logo;
- alteração da imagem principal.

Imagens base64 não são copiadas integralmente para o log de auditoria.

Antes de configurar um domínio próprio, confirme DNS e disponibilidade no provedor responsável. O GlossFlow impede que o mesmo `customDomain` seja associado a dois salões.

---

## 9. Custos externos por tenant

O painel de custos externos continua disponível dentro do gerenciamento do salão.

Ele permite registrar, por período:

- custos Meta/WhatsApp;
- custos de IA;
- outros custos externos;
- custo mensal de domínio;
- limite mensal incluído;
- percentual de alerta.

Esses dados ajudam a comparar receita recorrente e custo operacional real do cliente.

---

## 10. Auditoria do ciclo SaaS

Eventos sensíveis possuem registros dirigidos ao tenant afetado. Entre eles:

- `SAAS_TENANT_PROVISIONED`;
- `SAAS_SUBSCRIPTION_CHANGED`;
- `SAAS_MODULES_UPDATED`;
- `SAAS_ADMIN_ACCESS_UPDATED`;
- `SAAS_BILLING_PROFILE_UPDATED`;
- `SAAS_SITE_BRAND_UPDATED`.

Os eventos guardam contexto seguro de antes/depois quando aplicável, além do ator, IP e user-agent quando disponíveis.

A auditoria genérica HTTP permanece ativa em paralelo.

---

## 11. Checklist de implantação de cliente

Antes de entregar o acesso:

- [ ] salão provisionado sem erro;
- [ ] e-mail do ADMIN revisado;
- [ ] plano correto;
- [ ] status correto;
- [ ] data de TRIAL/graça revisada;
- [ ] módulos conferidos com a proposta comercial;
- [ ] Site & Marca configurados;
- [ ] domínio configurado ou decisão registrada;
- [ ] billing preparado;
- [ ] custos externos configurados quando aplicável;
- [ ] login do cliente testado;
- [ ] Agenda pública testada se contratada;
- [ ] evidência de auditoria disponível.

---

## 12. O que não fazer

Não:

- editar `salonId`, plano ou status diretamente no MongoDB para operação normal;
- reativar cliente cancelado recriando o tenant;
- apagar o tenant apenas para suspender acesso;
- compartilhar credenciais do Super Admin;
- gravar senha em observações de billing;
- tratar cadastro do billing profile como confirmação de cobrança no gateway;
- remover módulos para simular cancelamento comercial.

O cancelamento deve ocorrer pelo estado `CANCELED`; os módulos descrevem o produto contratado, não a situação financeira do contrato.
