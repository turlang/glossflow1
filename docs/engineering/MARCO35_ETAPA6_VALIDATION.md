# Marco 35 — Etapa 6: Homologação e hardening dos módulos em validação

## Objetivo

Consolidar `WHATSAPP`, `COMPRAS`, `EQUIPE`, `CLINICO` e `PORTAL_CLIENTE` sem promover módulos para `READY` antes da homologação humana ou da dependência externa correspondente.

## Implementado

### WhatsApp

- Diagnóstico de provider em `GET /admin/homologation/validation-suite` usando o catálogo central de integrações.
- Provider incompleto é erro de homologação.
- Twilio Trial conectado é tratado como aviso, não como sender comercial definitivamente homologado.
- Ausência de template ativo no tenant é sinalizada.

### Compras

- Recebimento seguro cria, na mesma transação Prisma, entrada de estoque, atualização do custo, movimento `IN`, conta a pagar e mudança do pedido para `RECEIVED`.
- A rota já utilizada pela interface continua compatível, mas é interceptada pelo hardening antes do handler legado.
- Rota explícita adicional: `POST /admin/procurement/orders/:id/receive-safe`.
- O diagnóstico acusa pedido `RECEIVED` sem movimento de estoque ou sem conta a pagar.
- Recebimento parcial ainda não foi inventado sobre o schema atual; a decisão exige evolução explícita do modelo de dados.

### Equipe

- Máquina de estados do ponto bloqueia transições inválidas.
- Fechamento de folha bloqueia período inválido e sobreposição com folha existente.
- O diagnóstico revisa sequências históricas de ponto e períodos de folha.
- Cálculo trabalhista/legal brasileiro não é reivindicado como parte do escopo atual.

### Clínico

- Respostas administrativas recebem `Cache-Control: no-store`.
- Atendimento vinculado deve pertencer ao tenant.
- Cliente do prontuário deve ser compatível com o cliente do atendimento.
- Registros `CONSENT` exigem texto do consentimento, responsável/signatário e data/hora de assinatura.
- A UI agora expõe atendimento relacionado, texto do consentimento e data/hora da assinatura.

### Portal do Cliente

- Ao emitir novo link para um cliente, links ativos e ainda válidos anteriores são revogados automaticamente.
- Rotas administrativas do portal recebem `Cache-Control: no-store`.
- O diagnóstico acusa múltiplos links simultaneamente ativos e links expirados ainda não revogados.

## Diagnóstico consolidado

`GET /admin/homologation/validation-suite`

A rota é ADMIN-only, usa o `salonId` da sessão e retorna achados por domínio para WhatsApp, Compras, Equipe, Clínico e Portal do Cliente.

## Maturidade após a etapa

- WHATSAPP: 90% — `VALIDATION_REQUIRED`.
- COMPRAS: 91% — `VALIDATION_REQUIRED`.
- EQUIPE: 89% — `VALIDATION_REQUIRED`.
- CLINICO: 89% — `VALIDATION_REQUIRED`.
- PORTAL_CLIENTE: 90% — `VALIDATION_REQUIRED`.

## Condições restantes para READY

- WhatsApp: sender definitivo autorizado/homologado; Twilio Trial não conta como conclusão comercial.
- Compras: homologação humana do recebimento completo e decisão explícita sobre recebimento parcial.
- Equipe: homologação das regras operacionais; folha legal/fiscal permanece fora do escopo.
- Clínico: revisão humana de UX, auditoria, segurança e LGPD devido à sensibilidade dos dados.
- Portal: homologação ponta a ponta da jornada self-service.
