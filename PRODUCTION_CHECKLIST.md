# GlossFlow Smart — Checklist de Produção

Use este checklist antes de cada piloto comercial, publicação relevante ou ativação de novo tenant.

## Segurança

- [ ] `.env` e credenciais reais não estão versionados.
- [ ] `JWT_SECRET` possui pelo menos 32 caracteres.
- [ ] cada pessoa possui usuário próprio; não compartilhar login.
- [ ] `SUPER_ADMIN` está separado das contas do salão.
- [ ] HTTPS ativo no frontend, backend e webhooks.
- [ ] CORS contém apenas origens esperadas, subdomínios white-label e domínios cadastrados.
- [ ] logs não exibem JWT, senha, Auth Token da Twilio ou chave de IA.
- [ ] backups do MongoDB Atlas estão configurados conforme o plano contratado.

## Banco e Prisma

- [ ] `backend/prisma/schema.prisma` é a única fonte canônica do schema.
- [ ] `npm run prisma:generate` passa.
- [ ] alterações de schema foram aplicadas conscientemente.
- [ ] `npm run seed` **não** será executado em banco com dados reais.
- [ ] consultas privadas filtram `salonId` da sessão.

## Frontend

- [ ] build Vite passa.
- [ ] vitrine pública abre sem login.
- [ ] tenant correto é resolvido por slug/host.
- [ ] layout validado em desktop e mobile.
- [ ] sessão expirada redireciona para login.
- [ ] erro de permissão em recurso isolado não provoca logout indevido.

## Agenda

- [ ] serviço/profissional compatíveis.
- [ ] jornada e bloqueios respeitados.
- [ ] conflito de horário impedido no backend.
- [ ] agendamento público persiste.
- [ ] protocolo e link de gerenciamento são gerados.
- [ ] cancelamento respeita antecedência configurada.
- [ ] reagendamento revalida disponibilidade.
- [ ] Agenda Operacional e Smart Fit continuam funcionais.
- [ ] lista de espera não marca oferta como entregue quando o WhatsApp falha.

## WhatsApp / Twilio

- [ ] `WHATSAPP_PROVIDER=twilio` no ambiente operacional atual.
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e sender estão corretos.
- [ ] webhook de entrada aponta para `/webhooks/whatsapp/twilio`.
- [ ] callback de status aponta para `/webhooks/whatsapp/twilio/status` ou é derivado corretamente.
- [ ] assinatura do webhook de entrada é validada.
- [ ] confirmação de agendamento chega ao número de teste/produção.
- [ ] callback registra `sent` e, quando disponível, `delivered`/`read`.
- [ ] `failed`/`undelivered` geram diagnóstico operacional.
- [ ] Trial/Sandbox não é tratado como ambiente final de cliente.

## IA

- [ ] `AI_PROVIDER=groq` quando Groq for o provider ativo.
- [ ] chave fica somente no backend.
- [ ] resposta do modelo passa pelos guards necessários.
- [ ] indisponibilidade da IA possui fallback/erro controlado.

## CRM, Estoque e Financeiro

- [ ] CRUD de clientes respeita tenant e papel.
- [ ] estoque não permite saldo negativo.
- [ ] movimentações preservam histórico.
- [ ] desativação lógica é usada quando histórico precisa ser mantido.
- [ ] rotas financeiras e de usuários continuam restritas ao ADMIN quando aplicável.

## Qualidade

Backend:

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build
```

Frontend:

```bash
cd frontend
npm ci
npm run build
```

- [ ] GitHub Quality Gate verde.
- [ ] Production Gate verde.
- [ ] smoke test manual do fluxo alterado concluído.

## Critério de liberação

Uma versão não deve ser promovida apenas porque compilou. Para fluxos com Agenda, WhatsApp, pagamento ou dados de cliente, é obrigatório ter evidência de execução real ou de sandbox equivalente antes da liberação.
