# GlossFlow — Estoque Operacional e Reposição

Este guia descreve o fluxo diário do módulo **Estoque** após o Marco 18. O objetivo é permitir que proprietário e recepção controlem saldo, reposição e conciliação física sem depender de planilha paralela.

## 1. O que a tela de Estoque mostra

Ao abrir **Estoque**, o GlossFlow apresenta indicadores para decisão rápida:

- **Produtos ativos**: itens atualmente monitorados;
- **Estoque baixo**: itens no mínimo configurado ou abaixo dele;
- **Sem estoque**: itens com saldo zero;
- **Capital imobilizado**: quantidade atual multiplicada pelo preço de custo;
- **Venda potencial**: valor estimado dos itens que possuem preço de venda;
- **Compra sugerida**: custo aproximado do plano de reposição atual.

Produtos inativos permanecem pesquisáveis no filtro de situação, mas não entram nos indicadores operacionais nem no plano de compra.

## 2. Cadastro correto do produto

Para que alertas e reposição funcionem, mantenha principalmente estes campos atualizados:

- produto;
- categoria;
- fornecedor;
- unidade;
- quantidade atual;
- quantidade mínima;
- preço de custo;
- preço de venda, quando aplicável.

A **quantidade mínima** representa o ponto de atenção. Quando o saldo ativo fica igual ou abaixo desse valor, o produto entra no painel de reposição.

## 3. Entrada de estoque

Use **Entrada** quando novas unidades realmente chegam ao salão, por exemplo:

- compra de fornecedor;
- devolução interna para o estoque;
- recebimento de transferência controlada.

Informe a quantidade recebida e um motivo que permita entender a movimentação no futuro.

O botão **Preparar entrada**, disponível no painel de reposição, seleciona o produto, sugere a quantidade e preenche o motivo. Revise os dados e somente então registre a movimentação.

## 4. Saída de estoque

Use **Saída** quando unidades deixam o saldo, por exemplo:

- consumo interno;
- venda;
- perda ou avaria;
- descarte controlado.

O backend impede qualquer saída que faria o saldo ficar negativo. Se o sistema rejeitar a movimentação, verifique o estoque físico antes de tentar novamente.

Entradas e saídas precisam possuir quantidade maior que zero.

## 5. Ajuste físico e conciliação

Use **Ajuste para saldo físico exato** após uma contagem real do estoque.

Diferente de entrada e saída, no ajuste o número informado é o **novo saldo oficial**, e não uma diferença a somar ou subtrair.

Exemplo operacional:

1. GlossFlow informa 7 unidades;
2. a contagem física encontra 4;
3. selecione `Ajuste para saldo físico exato`;
4. informe `4`;
5. registre um motivo como `Contagem física semanal`.

Se a contagem física encontrar nenhuma unidade, o ajuste pode ser **zero**. Esse comportamento é intencional e permite conciliar ruptura real sem criar movimentações artificiais.

## 6. Painel “O que comprar agora”

O painel prioriza primeiro produtos **sem estoque** e depois produtos com **estoque baixo**.

A sugestão de compra usa uma regra simples e previsível: recompor o produto até **duas vezes a quantidade mínima configurada**.

Exemplo:

- mínimo: 3 unidades;
- saldo: 1 unidade;
- alvo de segurança: 6 unidades;
- compra sugerida: 5 unidades.

O custo estimado utiliza o preço de custo cadastrado. A sugestão é apoio operacional; antes de comprar, confirme fornecedor, embalagem e necessidade real do salão.

## 7. Filtros

A consulta de produtos permite combinar:

- busca por produto, categoria ou fornecedor;
- categoria;
- fornecedor;
- situação: saudável, estoque baixo, sem estoque ou inativo.

Use **Limpar filtros** para retornar à visão completa.

## 8. Histórico por produto

O histórico é carregado somente quando um produto é selecionado. Isso evita trazer todas as movimentações do salão na abertura da página.

São exibidas até as **100 movimentações mais recentes** do produto, sempre isoladas pelo salão autenticado.

A trilha diferencia:

- entrada;
- saída;
- ajuste físico;
- motivo;
- quantidade ou novo saldo;
- data e horário.

## 9. Rotina diária recomendada

No início ou no fim do expediente:

1. verifique **Sem estoque** e **Estoque baixo**;
2. confirme se entradas recebidas foram registradas;
3. registre consumos, perdas ou vendas que alteraram o saldo;
4. use filtros para conferir categorias críticas;
5. consulte o histórico quando houver divergência.

## 10. Rotina semanal de conciliação

Uma vez por semana, ou conforme o volume do salão:

1. faça contagem física dos itens relevantes;
2. compare com o saldo do GlossFlow;
3. registre **Ajuste físico** quando houver diferença;
4. informe motivo claro;
5. revise o painel de reposição;
6. consolide a lista de compras por fornecedor;
7. confirme se o capital imobilizado está coerente com a operação.

## 11. Perfis de acesso

- `ADMIN`: pode operar o estoque;
- `RECEPTION`: pode operar o estoque quando o módulo está habilitado;
- `PROFESSIONAL`: não acessa a visão operacional de reposição/histórico.

As operações continuam isoladas pelo `salonId` da sessão autenticada.

## 12. Checklist de fechamento do Marco 18

O estoque pode ser considerado operacional quando:

- [ ] produtos ativos possuem mínimo e custo coerentes;
- [ ] entradas e saídas reais são registradas;
- [ ] nenhuma saída consegue gerar saldo negativo;
- [ ] ajuste físico consegue reconciliar inclusive para zero;
- [ ] ruptura e estoque baixo aparecem no painel;
- [ ] a equipe consegue saber o que comprar sem planilha externa;
- [ ] histórico por produto permite explicar divergências;
- [ ] filtros por categoria e fornecedor ajudam na rotina de compra;
- [ ] capital imobilizado é visível para decisão;
- [ ] a rotina semanal de contagem física foi definida.

> A baixa automática de insumos a partir de serviços permanece como evolução futura e somente deverá ser ativada quando existir configuração explícita de consumo por serviço/produto. O Marco 18 não inventa esse vínculo automaticamente.
