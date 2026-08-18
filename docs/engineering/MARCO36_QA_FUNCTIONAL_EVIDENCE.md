# Marco 36 — Evidência funcional QA

Data da execução: 2026-08-18

## Execução validada

- Workflow: `Marco 36 QA Functional Scenarios`
- Run: `#1`
- GitHub Actions run id: `32093034815`
- Branch: `main`
- SHA: `a00ceaf71e7c6c813bb1f06bd6dfb4dce44119b6`
- Banco: `glossflow-qa`
- Resultado: **SUCCESS**
- Cenários aprovados: **7/7**
- Produção alterada: **não**
- Mensagens reais executadas: **não**
- Pagamentos reais executados: **não**

## Módulos validados

- **PACOTES** — criação e atribuição; elegibilidade por serviço; consumo de 1 crédito; idempotência sem consumo duplicado.
- **RECURSOS** — reserva integrada; idempotência da reserva; bloqueio por capacidade; liberação após checkout.
- **POS** — checkout integrado; venda avulsa; baixa de estoque; estorno; reposição de estoque; proteção contra duplicidade.
- **COMPRAS** — pedido completo; recebimento seguro; estoque e custo; conta a pagar; bloqueio de recebimento duplicado.
- **EQUIPE** — sequência válida do ponto; rejeição de transição inválida; meta válida; folha operacional; bloqueio de período sobreposto.
- **CLINICO** — consentimento completo; vínculo cliente-atendimento; rejeição de client mismatch; `no-store` para dados clínicos.
- **PORTAL_CLIENTE** — criação de link; rotação com revogação anterior; self-service autenticado por token; revogação; bloqueio pós-revogação.

## Diagnósticos finais

- Transactional: **0 erros**.
- Operations: **0 erros**.
- Checkout: **0 erros**.
- Validation suite fora de WhatsApp: **0 achados**.
- WhatsApp: **3 achados** mantidos como bloqueio externo/comercial.

## Interpretação

Os sete módulos não-WhatsApp possuem evidência funcional automatizada verde em tenant QA isolado. Esta evidência não promove automaticamente os módulos para `READY`: a promoção continua condicionada às evidências humanas/comerciais definidas no contrato de homologação.

O módulo **WHATSAPP** permanece bloqueado até validação de provider, sender definitivo e template ativo, sem tratar Twilio Trial como evidência de produção.

## Próxima etapa

Executar homologação humana/comercial guiada dos sete módulos validados em QA e registrar evidência por fluxo crítico. Em paralelo, concluir a integração definitiva do WhatsApp em ambiente autorizado antes de qualquer promoção comercial desse módulo.
