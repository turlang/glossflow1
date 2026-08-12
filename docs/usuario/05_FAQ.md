# FAQ — GlossFlow

## Por que não consigo abrir um módulo?

Os módulos são liberados por salão. Se aparecer `MODULE_DISABLED`, o recurso não está habilitado para o seu tenant ou perfil.

## Por que um reagendamento foi recusado?

O GlossFlow impede sobreposição real de horários. Verifique data, hora, duração e profissional e tente outro slot.

## Posso cadastrar saída de estoque maior que o saldo?

Não. O sistema bloqueia qualquer movimentação que deixe quantidade negativa.

## O agente pode inventar horário ou preço?

Não deve. Serviços, preços, profissionais e disponibilidade precisam vir das ferramentas conectadas aos dados reais do salão.

## O que acontece quando o cliente pede atendimento humano?

O handoff é aberto e a automação fica pausada para aquele telefone. Depois do atendimento manual, o handoff deve ser encerrado.

## E se a IA estiver fora do ar?

O agente possui fallback seguro para respostas básicas e não deve transformar falha do provider em informação inventada.

## A recepção pode alterar tudo?

Não. Há separação de papéis. Configurações críticas e ações administrativas específicas ficam restritas ao `ADMIN` ou ao `SUPER_ADMIN` da plataforma.

## Um salão consegue ver dados de outro salão?

Não deveria. As rotas operacionais usam o `salonId` assinado na sessão e as consultas são filtradas por tenant.

## Como sei se o WhatsApp falhou?

O painel pode registrar notificações de falha de entrega. Confira número, configuração do provider e status antes de reenviar.

## O que devo informar ao suporte?

Informe a operação executada, horário aproximado, tela utilizada e mensagem de erro. Não envie senha, token, chave de API ou segredo do provider.
