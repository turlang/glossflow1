# Marco 35 — Validação Final

Este documento fecha o ciclo técnico de consolidação dos 19 módulos sem confundir automação, homologação humana e dependências externas.

## 1. Gates automatizados obrigatórios

O SHA final do Marco 35 só pode ser promovido quando:

- `GlossFlow Quality Gate` = success;
- `Production Gate` = success;
- Vercel = success para o mesmo SHA;
- Render serve exatamente os 12 primeiros caracteres do mesmo SHA;
- `/health` responde `ok=true`, com Build ID igual no body e `X-GlossFlow-Build`;
- `/ready` responde `ok=true`, mesmo Build ID e `database.ok=true`;
- `Production Smoke Validation` = success.

## 2. Diagnósticos do Marco 35

Executar com usuário `ADMIN` de um tenant de QA apropriado.

| Diagnóstico | Domínios |
|---|---|
| `GET /admin/homologation/transactional` | PDV, Estoque, Compras, Financeiro, Pacotes |
| `GET /admin/homologation/operations` | Equipe, Clínico, Portal, Recursos |
| `GET /admin/homologation/evolution` | Marketing, Multiunidade, Financeiro Avançado/Fiscal |
| `GET /admin/homologation/checkout-flow` | Agenda → Recursos → Pacotes → PDV → Financeiro |
| `GET /admin/homologation/validation-suite` | WhatsApp, Compras, Equipe, Clínico, Portal |

Um diagnóstico com `ERROR` exige correção ou decisão documentada. `WARN` pode representar dependência externa, dado histórico ou necessidade de homologação humana e não deve ser silenciosamente convertido em PASS.

## 3. Contratos cross-tenant

A suíte automatizada deve manter:

- operações comerciais autenticadas;
- rate limit por tenant;
- subscription access;
- entitlement de módulo;
- auditoria;
- consultas operacionais filtradas por `salonId`;
- checkout validando agendamento, recurso, pacote e produto no tenant da sessão;
- portal público derivando `clientId`/`salonId` do token persistido, nunca de query/params fornecidos pelo visitante;
- multiunidade com convite HMAC direcionado ao tenant de destino;
- multiunidade sem acesso implícito a CRM, Agenda, Estoque ou Financeiro da outra unidade.

Contrato automatizado: `backend/tests/marco35-final-isolation.test.js`.

## 4. Homologação humana — VALIDATION_REQUIRED

### WhatsApp

- validar sender definitivo em sandbox/ambiente autorizado;
- confirmar webhook inbound/outbound;
- confirmar templates e janela de atendimento;
- Twilio Trial não é aprovação comercial final.

### PDV

- atendimento com pagamento integral;
- múltiplos pagamentos;
- produto com baixa de estoque;
- estorno restaurando estoque/financeiro;
- idempotência do checkout.

### Pacotes

- pacote elegível consumindo exatamente um crédito;
- serviço não coberto bloqueado;
- pacote vencido/esgotado bloqueado;
- saldo final consistente.

### Compras

- pedido completo recebido;
- estoque e custo atualizados;
- movimento `IN` criado;
- conta a pagar criada uma única vez;
- tentativa duplicada bloqueada.

Recebimento parcial não está no modelo atual e não deve ser simulado em QA.

### Equipe

- CLOCK_IN → BREAK_START → BREAK_END → CLOCK_OUT;
- transições inválidas bloqueadas;
- folha com período válido;
- sobreposição de folha bloqueada.

A homologação não representa validação trabalhista/legal da folha brasileira.

### Clínico

- anamnese/evolução;
- vínculo com atendimento do mesmo cliente;
- mismatch cliente ↔ atendimento bloqueado;
- consentimento com texto, responsável e data/hora;
- resposta administrativa `no-store`;
- revisão humana de UX, segurança, auditoria e LGPD.

### Portal do Cliente

- novo link revoga link ativo anterior;
- token expirado/revogado não acessa;
- portal mostra apenas dados do cliente/tenant do token;
- jornada mobile/self-service validada.

### Recursos

- reserva disponível;
- conflito/capacidade bloqueados;
- integração com Agenda;
- liberação após checkout.

## 5. EVOLUTION_REQUIRED — não bloquear por falsa promessa

### Marketing 360

A base de campanha, cupom, avaliação e audiência consentida existe. Para promoção futura ainda faltam worker/provider de entrega, scheduler, gatilhos e métricas de conversão reais.

### Multiunidade

Convite/aceite/saída/revogação existem. Dashboards corporativos e compartilhamento de dados só podem ser implementados depois de política explícita de acesso e consentimento.

### Financeiro Avançado/Fiscal

Caixa, centros de custo, contas, conciliação e evidência fiscal existem. Emissão NFS-e legal depende de provider autorizado e homologado.

## 6. Operações proibidas na homologação de produção

- não executar clean reset;
- não apagar/anonymizar cliente real para testar LGPD;
- não executar restore de backup em produção para validação;
- não disparar campanha real sem ambiente/provider autorizado;
- não emitir documento fiscal fictício como `ISSUED`;
- não criar movimentações financeiras/estoque fictícias em tenant real.

## 7. Hardening posterior identificado

A superfície de clean reset deve receber feature flag/env guard explícita antes de qualquer ampliação de uso, por exemplo `PLATFORM_CLEAN_RESET_ENABLED=false` como padrão.

## 8. Deploy final

Como o Render não está acompanhando automaticamente cada commit de `main`, o fechamento exige um único **Manual Deploy → Deploy latest commit** depois que a Etapa 7 e seus gates estiverem concluídos.

Depois do deploy, rerodar/aguardar o Production Smoke do mesmo SHA. Não criar commit documental apenas para registrar o sucesso, pois isso alteraria novamente o Build ID. Registrar a evidência final na Issue #28.

## 9. Decisão de saída

### GO técnico

Pode ser declarado quando Quality Gate, Production Gate, cross-tenant contracts e exact-build Production Smoke do SHA final estiverem verdes.

### GO comercial por módulo

Depende da classificação da matriz:

- `READY`: liberado no escopo implementado;
- `VALIDATION_REQUIRED`: depende da homologação humana/provider indicada;
- `EVOLUTION_REQUIRED`: não vender como capacidade completa até a evolução declarada ser entregue.
