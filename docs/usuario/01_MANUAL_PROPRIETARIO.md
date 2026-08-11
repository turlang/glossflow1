# Manual do Proprietário — GlossFlow

Este manual é destinado ao proprietário ou administrador do salão. O perfil `ADMIN` opera o salão dentro dos módulos habilitados no plano e não substitui o `SUPER_ADMIN` da plataforma.

## 1. Primeiros passos

1. Entre no painel com seu usuário administrativo.
2. Confira os dados carregados no Dashboard.
3. Cadastre serviços, preços e duração.
4. Cadastre profissionais e configure quais serviços cada um atende.
5. Configure jornada, intervalos e bloqueios de agenda.
6. Cadastre produtos do estoque e os níveis mínimos.
7. Cadastre ou revise clientes no CRM.
8. Valide os módulos de WhatsApp e IA antes de liberar automações.

## 2. Agenda

A Agenda Enterprise possui visualização por dia, semana, mês e profissionais. Use o filtro de profissional para reduzir a grade e o botão **Reagendar** para alterar data, horário ou profissional.

O sistema valida conflito antes de persistir a mudança. Um erro de conflito não fecha o formulário: escolha outro horário e confirme novamente.

Bloqueios, folgas e férias devem ser cadastrados na jornada do profissional. Evite usar um agendamento fictício para representar indisponibilidade.

## 3. Serviços e profissionais

Mantenha preço e duração atualizados. Esses dados alimentam agenda pública, capacidade, projeções e o agente de WhatsApp.

Ao alterar serviços atendidos por um profissional, revise a agenda futura para garantir que não existam combinações antigas incompatíveis.

## 4. Estoque

Cadastre quantidade atual, estoque mínimo, custo e unidade. Use **Movimentar estoque** para entradas, saídas e ajustes.

O sistema impede saída que deixaria saldo negativo. Produtos abaixo do mínimo aparecem como alerta operacional.

## 5. Clientes e CRM

O CRM registra nome, WhatsApp, e-mail opcional, aniversário, preferências e observações. O cadastro pertence ao salão da sessão e não é compartilhado com outros tenants.

Use preferências e histórico para melhorar atendimento e campanhas, evitando inserir informação sensível que não seja necessária para a operação.

## 6. Financeiro, comissões e fidelidade

O módulo Financeiro registra receitas e despesas. As comissões usam regras por profissional e os atendimentos confirmados/concluídos. A fidelidade permite programa de pontos e lançamentos por cliente.

Revise periodicamente valores, lançamentos e regras para que indicadores executivos não sejam calculados sobre dados desatualizados.

## 7. WhatsApp e IA

O agente usa somente serviços, profissionais e horários existentes. Alterações de agenda exigem confirmação explícita do cliente.

Quando o cliente pede uma pessoa, ocorre handoff humano e a automação fica pausada para aquele telefone até o encerramento do handoff.

Em falha do provider de IA, o sistema mantém resposta de fallback segura. Nunca use o painel para copiar chaves de API para mensagens ou campos visíveis ao cliente.

## 8. Segurança

- não compartilhe senha administrativa;
- encerre sessões que você não reconhece;
- use usuários separados para recepção e profissionais;
- mantenha módulos desnecessários desabilitados;
- confira alertas de entrega do WhatsApp;
- preserve backups e registros de auditoria.

## 9. Rotina recomendada

**Diariamente:** agenda, notificações, estoque crítico e handoffs.

**Semanalmente:** clientes sem retorno, ocupação, faturamento, despesas e comissões.

**Mensalmente:** acessos, módulos, fornecedores, preços, jornada da equipe, fidelidade e indicadores executivos.
