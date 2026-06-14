# GlossFlow Enterprise v8.5 — Checklist de Produção

Este checklist transforma o projeto de MVP avançado em uma versão candidata a produção comercial. Use antes de apresentar, vender ou publicar o SaaS.

## 1. Segurança obrigatória

- Nunca subir `.env` real para GitHub, ZIP público ou hospedagem compartilhada.
- Usar `JWT_SECRET` forte com mais de 32 caracteres.
- Trocar a senha padrão `admin@glossflow.com / 123456` antes de usar com clientes reais.
- Criar um usuário por pessoa, evitando compartilhamento de senha.
- Usar HTTPS em produção.
- Configurar origem CORS fixa no backend, nunca `origin: true` em produção.
- Ativar backup automático no MongoDB Atlas.

## 2. Banco de dados

- Confirmar `DATABASE_URL` real no `backend/.env`.
- Rodar `npx prisma generate`.
- Rodar `npx prisma db push`.
- Rodar `npm run seed` somente em ambiente de teste ou homologação.
- Criar rotina de backup.

## 3. Frontend

- Testar em 1366x768, 1920x1080, tablet e celular.
- Validar a vitrine pública sem login.
- Validar login administrativo.
- Validar cadastro, edição e exclusão de serviços, profissionais, portfólio e estoque.
- Validar agendamento público e visualização na agenda.

## 4. SaaS comercial

- Definir planos: Básico, Profissional e Premium.
- Definir limites por plano: profissionais, serviços, imagens, automações e unidades.
- Integrar pagamento real: Mercado Pago, Stripe ou Asaas.
- Criar termos de uso e política de privacidade.

## 5. LGPD

- Informar ao cliente final quais dados são coletados.
- Permitir correção ou exclusão de dados pessoais.
- Não coletar dados sensíveis desnecessários.
- Registrar consentimento quando houver disparo de mensagens.

## 6. WhatsApp e IA

- Templates estão prontos para uso, mas o disparo real depende de provedor externo.
- Recomendados: Evolution API, Twilio ou Z-API.
- IA deve usar variáveis de ambiente e logs controlados.

## 7. Critério de aceite para nota 9,5

A versão pode ser considerada 9,5 quando:

- O fluxo completo funciona sem intervenção técnica.
- O visual se mantém consistente em desktop, notebook, tablet e celular.
- O salão consegue operar agenda, vitrine, serviços, profissionais e estoque sem programador.
- O backend não expõe segredo, senha ou erro técnico para o usuário final.
- O projeto tem documentação suficiente para instalação, uso e manutenção.
