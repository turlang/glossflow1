# Marco 36 — Protocolo de Homologação Comercial

## Objetivo

Homologar os oito módulos que entram no Marco 36 como `VALIDATION_REQUIRED` sem transformar evidência automática em evidência humana e sem criar dados fictícios em tenant real de produção.

Endpoint de apoio read-only:

```http
GET /admin/homologation/commercial
```

Requisitos:

- autenticação válida;
- papel `ADMIN` do tenant que será homologado;
- ambiente QA/sandbox ou tenant explicitamente autorizado;
- nenhuma execução destrutiva em produção real.

O endpoint apenas devolve o contrato de validação dos oito módulos, o estado atual da matriz tipada e, no caso de WhatsApp, o estado do provider. Ele não envia mensagens, não cria vendas, não movimenta estoque e não promove maturidade.

## Probes automáticos canônicos

A homologação comercial reutiliza os probes já consolidados no Marco 35:

- `GET /admin/homologation/transactional`;
- `GET /admin/homologation/operations`;
- `GET /admin/homologation/checkout-flow`;
- `GET /admin/homologation/validation-suite`.

O retorno automático deve ser anexado à evidência da sessão QA correspondente. Resultado automático verde é necessário, mas não é suficiente, quando o módulo exige confirmação de provider ou UX humana.

## Matriz de execução

### WHATSAPP

Automático: `validation-suite`.

Evidência humana/provider:

- sender/provider definitivo autorizado para o tenant;
- inbound e outbound em ambiente autorizado;
- template aprovado;
- janela de atendimento corretamente aplicada.

Bloqueio: Twilio Trial/sandbox não pode ser classificado como sender comercial definitivo.

### POS

Automático: `transactional` + `checkout-flow`.

Evidência humana:

- checkout com pagamentos esperados;
- baixa de estoque;
- lançamento financeiro;
- estorno;
- repetição da mesma operação não pode duplicar efeitos.

### PACOTES

Automático: `transactional` + `checkout-flow`.

Evidência humana:

- elegibilidade correta;
- consumo automático de crédito;
- validade;
- saldo remanescente.

### COMPRAS

Automático: `transactional` + `validation-suite`.

Evidência humana:

- recebimento completo;
- estoque e custo atualizados;
- conta a pagar correspondente;
- duplicidade bloqueada.

Limite declarado: recebimento parcial não é representado pelo modelo atual e não deve ser simulado como capacidade existente.

### EQUIPE

Automático: `operations` + `validation-suite`.

Evidência humana:

- sequência do ponto;
- transições inválidas bloqueadas;
- período de folha operacional;
- sobreposição de períodos rejeitada.

Limite declarado: o módulo não representa folha legal/fiscal brasileira completa.

### CLINICO

Automático: `operations` + `validation-suite`.

Evidência humana obrigatória:

- UX do prontuário;
- vínculo cliente ↔ atendimento;
- consentimento completo;
- auditoria;
- privacidade/LGPD.

### PORTAL_CLIENTE

Automático: `operations` + `validation-suite`.

Evidência humana:

- criação e rotação do link;
- expiração;
- revogação;
- jornada mobile;
- ausência de exposição cross-tenant.

### RECURSOS

Automático: `operations` + `checkout-flow`.

Evidência humana:

- capacidade;
- conflito de reserva;
- Agenda → recurso → atendimento;
- liberação após checkout.

## Regra de promoção

Nenhum módulo muda de `VALIDATION_REQUIRED` para `READY` somente porque:

- o build passou;
- o endpoint de diagnóstico retornou `ok`;
- a integração está configurada parcialmente;
- existe provider em modo Trial/sandbox.

A promoção só ocorre na Etapa 3 do Marco 36, quando a evidência automática e a evidência humana/provider exigida estiverem registradas e coerentes.

## Evidência mínima por sessão QA

Registrar:

1. tenant QA/ambiente autorizado utilizado;
2. SHA exato do backend;
3. data/hora da execução;
4. retorno dos probes automáticos aplicáveis;
5. resultado de cada passo humano/provider;
6. falhas encontradas e correção aplicada;
7. decisão final: manter `VALIDATION_REQUIRED` ou candidato a `READY`.

Nunca incluir tokens, senhas, chaves de API ou dados pessoais sensíveis no relatório versionado.
