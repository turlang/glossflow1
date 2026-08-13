# Marco 35 — Etapa 5: Checkout integrado

## Objetivo

Consolidar a jornada operacional `Agenda → Recursos → Pacotes → PDV → Financeiro` sem confiar em preços enviados pelo navegador e preservando isolamento por tenant.

## Implementado

- Preview server-side do checkout por atendimento.
- Reserva de recurso usando o intervalo canônico do agendamento e validação de capacidade.
- Consumo automático de 1 crédito de pacote elegível pelo serviço, cliente, validade e tenant.
- Checkout idempotente por `appointmentId`.
- Preço do serviço e dos produtos calculado exclusivamente pelo backend.
- Venda, pagamentos, baixa de estoque, movimento de estoque, consumo do pacote, lançamento financeiro, conclusão do atendimento e liberação dos recursos dentro de uma única transação Prisma.
- Diagnóstico somente leitura em `GET /admin/homologation/checkout-flow`.
- Interface de checkout integrada diretamente à Agenda para ADMIN/RECEPTION.

## Maturidade após a etapa

- POS: 91% — `VALIDATION_REQUIRED`.
- PACOTES: 89% — `VALIDATION_REQUIRED`.
- RECURSOS: 89% — `VALIDATION_REQUIRED`.

Os três permanecem em validação porque a promoção para `READY` depende da homologação humana em tenant QA, incluindo checkout real, pacote, capacidade de recurso, estorno e consistência financeira/estoque.

## Evidência automatizada

No SHA funcional `b0252ee7a972d3c66d409a7462a7706045432c00`, Production Gate e Quality Gate passaram integralmente em frontend e backend. O SHA final da etapa inclui apenas a atualização da matriz de maturidade e este registro documental.
