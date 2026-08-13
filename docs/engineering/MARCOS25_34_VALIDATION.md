# GlossFlow — Validação dos Marcos 25 a 34

Status esperado antes de merge: **todos os AUTO-BLOCKER verdes** e validação manual dos fluxos que escrevem dados operacionais.

Esta checklist valida os módulos adicionados após a Release Comercial do Marco 24. Execute em tenant de homologação. Não use dados reais desnecessariamente.

## Pré-condições

- [ ] Branch/release contém os Marcos 25–34.
- [ ] `npm ci`, Prisma Generate, TypeScript e build backend passam.
- [ ] Testes backend passam, incluindo `marcos25-34-contract.test.js`.
- [ ] ESLint, Vitest e build frontend passam.
- [ ] Tenant QA possui módulos novos habilitados pelo Super Admin.
- [ ] Existem ao menos 2 clientes, 2 profissionais, 2 serviços e 2 produtos de estoque para teste.
- [ ] Nenhum reset destrutivo será executado em base com dados reais.
- [ ] Snapshot/backup de QA disponível antes da homologação transacional.

## Marco 25 — PDV / Checkout / Pagamentos

- [ ] Abrir **PDV / Checkout** no painel.
- [ ] Criar venda de serviço via PIX e conferir `subtotal`, desconto, `total` e status `PAID`.
- [ ] Confirmar lançamento automático de receita na categoria `PDV`.
- [ ] Criar venda com produto e confirmar baixa automática do estoque + `InventoryMovement OUT`.
- [ ] Tentar vender quantidade maior que o estoque e confirmar bloqueio.
- [ ] Tentar pagamento menor que o total e confirmar bloqueio.
- [ ] Estornar venda com produto e confirmar `REFUNDED`, devolução ao estoque, movimento `IN` e lançamento de estorno.
- [ ] Tentar estornar novamente e confirmar bloqueio.

**Resultado Marco 25:** [ ] PASS [ ] FAIL

## Marco 26 — Pacotes, Assinaturas e Gift Cards

- [ ] Criar pacote com preço, créditos e validade.
- [ ] Vincular serviço e atribuir pacote a cliente.
- [ ] Confirmar créditos iniciais e vencimento.
- [ ] Criar plano recorrente e atribuir membership a cliente com status `ACTIVE`.
- [ ] Emitir gift card e confirmar código único e saldo inicial.
- [ ] Cliente de outro tenant não pode ser associado.

**Resultado Marco 26:** [ ] PASS [ ] FAIL

## Marco 27 — Compras e Fornecedores

- [ ] Cadastrar fornecedor.
- [ ] Criar pedido com produto existente e conferir número/total.
- [ ] Receber pedido e confirmar `RECEIVED`, incremento de estoque, custo atualizado e movimento `IN`.
- [ ] Tentar receber o mesmo pedido novamente e confirmar bloqueio.
- [ ] Produto de outro tenant deve ser rejeitado.

**Resultado Marco 27:** [ ] PASS [ ] FAIL

## Marco 28 — Equipe, Ponto, Metas e Folha

- [ ] Registrar `CLOCK_IN`, intervalo e `CLOCK_OUT`.
- [ ] Criar meta de receita e rejeitar período inválido.
- [ ] Criar folha com salário base, comissão, bônus e descontos.
- [ ] Conferir total por profissional e `grossTotal`.
- [ ] Metas/folha exigem ADMIN.

**Resultado Marco 28:** [ ] PASS [ ] FAIL

## Marco 29 — Anamnese e Prontuário

- [ ] Criar ficha `ANAMNESIS` com alergias, observações e consentimento.
- [ ] Criar registros `TREATMENT` e `EVOLUTION`.
- [ ] Filtrar por cliente.
- [ ] RECEPTION não grava prontuário; operação exige ADMIN.
- [ ] Dados clínicos ficam isolados por tenant e não aparecem em endpoints públicos.

**Resultado Marco 29:** [ ] PASS [ ] FAIL

## Marco 30 — Marketing 360 e Reputação

- [ ] Criar campanha WhatsApp em `DRAFT` e campanha agendada.
- [ ] Criar cupom percentual e de valor fixo.
- [ ] Código duplicado no mesmo tenant deve ser bloqueado.
- [ ] Criar solicitação de avaliação vinculada a cliente.
- [ ] Campanha DRAFT não envia mensagem automaticamente.
- [ ] Provider real somente em sandbox/ambiente autorizado.

**Resultado Marco 30:** [ ] PASS [ ] FAIL

## Marco 31 — Portal do Cliente

- [ ] Gerar link temporário e conferir validade.
- [ ] Token bruto só aparece na emissão; banco guarda apenas SHA-256.
- [ ] Abrir `?action=client-portal&token=...` e conferir salão/cliente correto.
- [ ] Conferir agenda, pacotes, memberships, gift cards e pontos do próprio cliente.
- [ ] Token alterado/expirado/revogado deve falhar.
- [ ] Token do cliente A nunca abre dados do cliente B.

**Resultado Marco 31:** [ ] PASS [ ] FAIL

## Marco 32 — Multiunidade / Redes

- [ ] Criar organização/rede e registrar unidade.
- [ ] Associação de unidade não concede acesso automático aos dados de outro tenant.
- [ ] Registros corporativos permanecem isolados pelo tenant administrador.
- [ ] Somente ADMIN acessa o módulo.
- [ ] Compartilhamento de CRM/estoque entre unidades só pode ser habilitado por política futura explícita.

**Resultado Marco 32:** [ ] PASS [ ] FAIL

## Marco 33 — Recursos Físicos

- [ ] Criar sala capacidade 1 e recurso/equipamento adicional.
- [ ] Reservar intervalo válido.
- [ ] Segunda reserva sobreposta em capacidade 1 deve falhar.
- [ ] Capacidade 2 permite duas reservas simultâneas e bloqueia a terceira.
- [ ] `endTime <= startTime` deve ser rejeitado.
- [ ] Confirmar isolamento por tenant.

**Resultado Marco 33:** [ ] PASS [ ] FAIL

## Marco 34 — Financeiro Avançado / Fiscal

- [ ] Criar centro de custo.
- [ ] Abrir caixa e bloquear segundo caixa simultâneo; depois fechar caixa.
- [ ] Criar conta a pagar e a receber.
- [ ] Liquidar título e confirmar `FinancialEntry` correspondente + status `SETTLED`.
- [ ] Conciliação igual deve gerar `MATCHED`; diferença deve gerar `REVIEW` com cálculo `settled - expected`.
- [ ] Criar documento fiscal `PENDING`.
- [ ] Documento `ISSUED` só pode representar provider realmente autorizado/homologado.

**Resultado Marco 34:** [ ] PASS [ ] FAIL

## Segurança e isolamento transversal

- [ ] Todas as rotas `/admin/...` exigem autenticação.
- [ ] Todas as consultas dos novos domínios aplicam `salonId` do JWT.
- [ ] Módulo desabilitado retorna `403 MODULE_DISABLED`.
- [ ] ADMIN acessa módulos contratados; RECEPTION respeita operações ADMIN-only; PROFESSIONAL não recebe a suite comercial.
- [ ] Super Admin continua separado da operação do tenant.
- [ ] Auditoria não armazena senha, token bruto do portal ou corpo clínico sensível completo.
- [ ] Rate limit continua aplicado.
- [ ] Nenhum segredo real foi versionado.

## Reset e higiene

- [ ] Dry-run de `data:reset:clean` lista todos os modelos dos Marcos 25–34.
- [ ] Reset permanece bloqueado em produção sem proteções previstas.
- [ ] Reset QA limpa todos os novos domínios e preserva SUPER_ADMIN principal + tenant técnico.
- [ ] Repository Hygiene passa; nenhum `.env`, dump, backup ou temporário foi commitado.

## Produção e regressão

- [ ] Quality Gate verde.
- [ ] Production Gate verde.
- [ ] Vercel `READY` no SHA do merge.
- [ ] Render `/health` e `/ready` servem o mesmo SHA, com `database.ok=true`.
- [ ] Production Smoke Validation verde.
- [ ] Vitrine e booking públicos continuam funcionando.
- [ ] Login/logout/refresh continuam verdes.
- [ ] Agenda, Estoque, CRM, WhatsApp/IA e LGPD anteriores não regrediram.
- [ ] Sem issue P0/P1 aberta.

# Critério final

A expansão **Marcos 25–34** pode ser promovida quando todos os testes automatizados estiverem verdes, cada marco estiver marcado `PASS` em tenant QA, não houver vazamento cross-tenant, operações transacionais tiverem sido validadas com dados de homologação, providers externos não homologados estiverem explicitamente pendentes/N/A e o smoke final confirmar o SHA exato de produção.

**Decisão:** [ ] GO [ ] NO-GO

**SHA validado:** `____________________________`

**Data:** `____/____/________`

**Responsável:** `____________________________`
