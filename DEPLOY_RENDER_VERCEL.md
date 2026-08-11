# Deploy do GlossFlow — Render + Vercel

Arquitetura operacional atual:

```text
Frontend React/Vite  -> Vercel
Backend Fastify/TS   -> Render
Banco                -> MongoDB Atlas
IA                   -> Groq
WhatsApp             -> Twilio
```

O arquivo `render.yaml` é o blueprint canônico do backend.

## 1. Pré-requisitos

- repositório GitHub atualizado;
- MongoDB Atlas ativo;
- `DATABASE_URL` válida;
- `JWT_SECRET` forte (mínimo de 32 caracteres em produção);
- projeto Vercel para `frontend/`;
- serviço Render para `backend/`;
- credenciais Groq/Twilio quando esses módulos estiverem ativos.

Nunca versionar `.env`, Auth Token da Twilio, JWT secret ou chaves de IA.

## 2. Backend no Render

Configuração manual equivalente ao blueprint:

```text
Name: glossflow-api
Root Directory: backend
Runtime: Node
Build Command: npm ci && npm run prisma:generate && npm run build
Start Command: npm run start
Health Check Path: /health
```

Variáveis mínimas:

```env
NODE_ENV=production
DATABASE_URL=...
JWT_SECRET=...
FRONTEND_ORIGIN=https://seu-frontend.vercel.app
PUBLIC_API_URL=https://glossflow-api.onrender.com
APP_PUBLIC_URL=https://seu-frontend.vercel.app
```

IA atual:

```env
AI_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
```

WhatsApp atual:

```env
WHATSAPP_PROVIDER=twilio
WHATSAPP_DRY_RUN=false
WHATSAPP_DEFAULT_COUNTRY_CODE=55
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+...
TWILIO_WEBHOOK_URL=https://glossflow-api.onrender.com/webhooks/whatsapp/twilio
TWILIO_STATUS_CALLBACK_URL=https://glossflow-api.onrender.com/webhooks/whatsapp/twilio/status
```

Para Sandbox/Trial de QA, configure também `TWILIO_TRIAL_MODE` e o `TWILIO_TRIAL_CONTENT_SID` fornecido pela Twilio. Não tratar Trial como ambiente de produção.

## 3. Frontend no Vercel

```text
Root Directory: frontend
Framework Preset: Vite
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Variável principal:

```env
VITE_API_URL=https://glossflow-api.onrender.com
```

Se usar uma vitrine de demonstração fixa, `VITE_SALON_SLUG` pode definir o tenant padrão do frontend.

## 4. Ordem segura de publicação

1. Merge/push no GitHub.
2. Aguarde o Quality Gate.
3. Confirme o deploy do Render.
4. Valide `/health`.
5. Confirme o deploy do Vercel.
6. Faça smoke test de login, vitrine e agendamento.
7. Para mudanças de WhatsApp, valide callback de status e webhook de entrada.

## 5. Banco e Prisma

O schema canônico fica somente em:

```text
backend/prisma/schema.prisma
```

Comandos locais:

```bash
cd backend
npm ci
npm run prisma:generate
npm run prisma:push
```

`npm run seed` apaga/recria diversos dados de demonstração. **Não execute seed em um banco de produção com dados reais de clientes.**

## 6. Smoke test de produção

Checklist mínimo:

- [ ] `/health` responde 200;
- [ ] login funciona;
- [ ] tenant correto aparece na vitrine;
- [ ] agenda retorna disponibilidade;
- [ ] novo agendamento persiste;
- [ ] confirmação WhatsApp é aceita pela Twilio;
- [ ] callback registra `sent` e, quando aplicável, `delivered`/`read`;
- [ ] cancelamento respeita política configurada;
- [ ] nenhuma credencial aparece nos logs;
- [ ] Super Admin e tenant continuam isolados.

## 7. Render Free

Instâncias gratuitas podem hibernar. Isso afeta timers internos de lembretes e pode aumentar latência do primeiro request. Para lembretes com horário estrito em produção, prefira instância sem hibernação ou um Cron externo chamando uma rotina idempotente.
