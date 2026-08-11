# Plano de Testes — GlossFlow Smart

## 1. Vitrine e multi-tenant

1. Abrir tenant por slug.
2. Validar nome, serviços, equipe e portfólio corretos.
3. Testar host de plataforma e, quando configurado, domínio próprio.
4. Confirmar que dados de outro salão não aparecem.

## 2. Autenticação e papéis

Validar login/logout para os papéis disponíveis.

- `SUPER_ADMIN` não deve cair no painel do tenant.
- `ADMIN` deve acessar gestão completa permitida.
- `RECEPTION` não deve ser desconectado por não possuir acesso a `/admin/users` ou financeiro.
- `PROFESSIONAL` deve receber somente dados/rotas permitidos.
- refresh token inválido deve encerrar a sessão de forma controlada.

## 3. Agendamento público

1. Selecionar serviço.
2. Selecionar profissional compatível.
3. Selecionar data e horário futuro.
4. Criar agendamento.
5. Conferir protocolo e link de gerenciamento.
6. Conferir registro na agenda administrativa.
7. Repetir tentativa no mesmo horário e confirmar bloqueio de conflito.

## 4. Jornada e Agenda Operacional

- horário fora da jornada deve ser rejeitado;
- pausa/bloqueio deve remover disponibilidade;
- serviço deve caber integralmente no período disponível;
- reagendamento deve revalidar capacidade e conflito;
- status operacional deve preservar regras comerciais;
- visão dia/semana deve carregar sem regressão visual.

## 5. Smart Fit e Lista de Espera

- Smart Fit ordena opções válidas, sem inventar horários;
- fila respeita serviço, data e preferência de profissional;
- cancelamento de vaga dispara busca compatível;
- falha do WhatsApp mantém cliente em `WAITING`;
- `QUERO` só converte a vaga se ela ainda estiver disponível.

## 6. WhatsApp / Twilio

### Saída

1. Criar agendamento com número autorizado no ambiente de teste.
2. Confirmar que a Twilio aceita a mensagem.
3. Confirmar callback `sent`.
4. Confirmar `delivered`/`read` quando o provider disponibilizar.
5. Simular/fixar número inválido e conferir `failed`/`undelivered` sem perder o agendamento.

### Entrada

1. Enviar mensagem do WhatsApp para o sender.
2. Confirmar `POST /webhooks/whatsapp/twilio` com 200.
3. Confirmar validação de `X-Twilio-Signature`.
4. Testar comandos de negócio disponíveis (`CONFIRMAR`, `CANCELAR`, `QUERO`) em ambiente compatível.
5. Confirmar idempotência por `MessageSid`.

## 7. CRM

Validar criar, editar e consultar cliente. Confirmar que a edição permanece na aba atual e não provoca logout/retorno indevido ao dashboard.

## 8. Estoque

- criar produto;
- editar produto;
- entrada;
- saída;
- ajuste;
- impedir saldo negativo;
- alerta de mínimo;
- desativação lógica preservando histórico.

## 9. Financeiro, comissões e fidelidade

Validar permissões e CRUDs conforme papel. Usuários sem acesso devem receber 403 sem comprometer a sessão inteira.

## 10. Segurança

- nenhuma credencial em Git/log;
- rotas administrativas sem token retornam 401/403;
- tenant A não acessa recurso do tenant B;
- erros 5xx não expõem stack em produção;
- webhook Twilio com assinatura inválida retorna 401;
- token de gerenciamento de agendamento é validado pelo hash armazenado.

## 11. Responsividade

Testar pelo menos:

- desktop 1366x768;
- desktop 1920x1080;
- tablet vertical;
- celular grande;
- celular pequeno.

## 12. Gate automatizado

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build

cd ../frontend
npm ci
npm run build
```
