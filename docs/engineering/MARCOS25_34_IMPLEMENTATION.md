# GlossFlow — Implementação dos Marcos 25 a 34

## Estado

Os Marcos 25–34 foram implementados na branch `agent/marcos-25-34` e são promovidos somente após os gates automatizados e a homologação descrita em [`MARCOS25_34_VALIDATION.md`](./MARCOS25_34_VALIDATION.md).

A implementação preserva os contratos anteriores do GlossFlow: autenticação, RBAC, isolamento por `salonId`, entitlements por módulo, auditoria, rate limit e ciclo de vida do tenant.

## Marco 25 — PDV / Checkout

Entregue:

- vendas com itens e múltiplos pagamentos no contrato da API;
- desconto e total server-side;
- validação de cobertura do pagamento;
- baixa automática de estoque para produtos;
- lançamento financeiro automático de receita;
- estorno com devolução ao estoque e lançamento de despesa;
- bloqueio de estoque insuficiente e estorno duplicado.

Modelos: `Sale`, `SaleItem`, `SalePayment`.

## Marco 26 — Pacotes, Assinaturas e Gift Cards

Entregue:

- ofertas de pacotes com créditos e validade;
- atribuição de pacote a cliente;
- planos de assinatura/membership do cliente;
- vínculo de membership com próxima cobrança;
- gift cards com código único e saldo próprio;
- UI administrativa para criação e atribuição.

Modelos: `PackageOffer`, `ClientPackage`, `MembershipPlan`, `ClientMembership`, `GiftCard`.

## Marco 27 — Compras e Fornecedores

Entregue:

- cadastro de fornecedores;
- pedidos de compra;
- validação de produto no tenant;
- recebimento controlado;
- incremento de estoque e movimentação `IN`;
- atualização do custo do produto no recebimento.

Modelos: `Supplier`, `PurchaseOrder`.

## Marco 28 — Equipe, Ponto, Metas e Folha

Entregue:

- eventos de ponto e intervalos;
- metas por profissional e período;
- métricas de receita, serviços, produtos, retenção e ocupação;
- fechamento de folha com base, comissão, bônus e descontos;
- operações sensíveis de metas/folha restritas a ADMIN.

Modelos: `TimeClockEntry`, `StaffGoal`, `PayrollRun`.

## Marco 29 — Anamnese / Prontuário

Entregue:

- anamnese, tratamento, evolução e consentimento;
- alergias, respostas estruturadas, notas e fotos por URL;
- assinatura/responsável e data;
- filtro por cliente;
- acesso restrito a ADMIN no backend;
- nenhum endpoint público expõe prontuário.

Modelo: `ClinicalRecord`.

## Marco 30 — Marketing 360 e Reputação

Entregue:

- campanhas por WhatsApp, e-mail, SMS e in-app;
- segmentação e agendamento;
- solicitações de avaliação;
- cupons percentuais ou de valor fixo;
- controle de código duplicado por tenant;
- campanhas `DRAFT` não disparam mensagens automaticamente.

Modelos: `MarketingCampaign`, `ReviewRequest`, `Coupon`.

Providers reais continuam sujeitos à homologação em sandbox/ambiente autorizado.

## Marco 31 — Portal do Cliente

Entregue:

- emissão de link temporário pelo salão;
- token aleatório retornado somente no momento da emissão;
- persistência apenas do SHA-256 do token;
- revogação e expiração;
- página pública do portal;
- consulta somente de dados do cliente vinculado: agenda, pacotes, memberships, gift cards e fidelidade.

Modelo: `ClientPortalAccess`.

## Marco 32 — Multiunidade / Redes

Entregue:

- organizações/redes;
- vínculo de unidades;
- convite assinado por HMAC para slug e tenant específicos;
- validade de até 72 horas;
- aceite obrigatório por ADMIN da unidade de destino;
- verificação da assinatura em tempo constante;
- bloqueio da rota legada de vínculo direto com `410 CONSENT_REQUIRED`;
- nenhum compartilhamento automático de CRM, agenda, estoque, financeiro ou usuários.

Modelos: `Organization`, `OrganizationLocation`.

O convite usa `MULTIUNIT_INVITE_SECRET` quando definido e, como fallback compatível, `JWT_SECRET`. Em produção o segredo efetivo precisa possuir ao menos 32 caracteres.

## Marco 33 — Recursos Físicos

Entregue:

- salas, cadeiras, macas, equipamentos e recursos genéricos;
- capacidade configurável;
- reservas por intervalo;
- associação opcional a atendimento;
- detecção de sobreposição e bloqueio quando a capacidade for atingida.

Modelos: `BusinessResource`, `ResourceReservation`.

## Marco 34 — Financeiro Avançado / Fiscal

Entregue:

- centros de custo;
- abertura e fechamento de caixa;
- bloqueio de segundo caixa simultâneo;
- contas a pagar e receber;
- liquidação com reflexo em `FinancialEntry`;
- conciliação com resultado `MATCHED` ou `REVIEW`;
- registro do ciclo de documento fiscal.

Modelos: `CostCenter`, `CashSession`, `ReceivablePayable`, `FinancialReconciliation`, `FiscalDocument`.

A camada fiscal não simula emissão. Um documento só deve evoluir para `ISSUED` quando existir provider fiscal real e homologado para o tenant.

## Entitlements

Novos módulos:

- `POS`;
- `PACOTES`;
- `COMPRAS`;
- `EQUIPE`;
- `CLINICO`;
- `MARKETING`;
- `PORTAL_CLIENTE`;
- `MULTIUNIDADE`;
- `RECURSOS`;
- `FINANCEIRO_ADV`.

ADMIN possui acesso visual à expansão completa. RECEPTION recebe apenas operações permitidas e continua bloqueado nas superfícies ADMIN-only. PROFESSIONAL não recebe a suite comercial.

## Reset e manutenção

O reset controlado de dados de teste foi estendido para remover os dados persistentes dos Marcos 25–34 antes das entidades-raiz antigas, preservando o SUPER_ADMIN principal e o tenant técnico conforme o contrato já existente.

## Evidência automatizada

Foram adicionados contratos automatizados para:

- presença dos novos modelos Prisma;
- rotas dos dez marcos;
- entitlements;
- cobertura do reset;
- baixa de estoque/financeiro no PDV;
- capacidade de recursos;
- token hash do portal;
- convite/aceite seguro de multiunidade e bloqueio do vínculo direto legado;
- presença dos dez módulos no catálogo e matriz de papéis do frontend.

A evidência final de release depende do SHA final da branch/PR e dos gates do GitHub Actions.
