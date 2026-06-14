# Deploy do GlossFlow — Render + Vercel

Este projeto está preparado para publicar a API no **Render**, o frontend no **Vercel** e manter o banco no **MongoDB Atlas**.

## 1. Antes de publicar

Confirme que você possui:

- Repositório no GitHub com o projeto completo.
- Banco MongoDB Atlas ativo.
- String real `DATABASE_URL` do MongoDB Atlas.
- Uma chave `JWT_SECRET` forte, com mais de 32 caracteres.

Nunca suba `.env` real para o GitHub.

---

## 2. Backend no Render

### Opção recomendada pelo Dashboard

No Render:

1. Clique em **New > Web Service**.
2. Conecte o repositório do GitHub.
3. Configure:

```txt
Name: glossflow-api
Root Directory: backend
Runtime: Node
Build Command: npm install && npx prisma generate && npm run build
Start Command: npm run start
Health Check Path: /health
```

O Render usa comandos `buildCommand` e `startCommand` para serviços Node, e esses mesmos campos também estão documentados no Blueprint `render.yaml`.

### Variáveis de ambiente no Render

Configure:

```env
NODE_ENV=production
DATABASE_URL="mongodb+srv://usuario:senha@cluster.mongodb.net/glossflow?retryWrites=true&w=majority"
JWT_SECRET="uma-chave-muito-forte-com-mais-de-32-caracteres"
FRONTEND_ORIGIN="https://sua-url-da-vercel.vercel.app"
RATE_LIMIT_PER_MINUTE=180
ACCESS_TOKEN_MINUTES=30
REFRESH_TOKEN_DAYS=7
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

Após o primeiro deploy, abra:

```txt
https://sua-api.onrender.com/health
```

Resultado esperado:

```json
{"ok":true,"app":"GlossFlow API"}
```

---

## 3. Frontend no Vercel

No Vercel:

1. Clique em **New Project**.
2. Importe o repositório do GitHub.
3. Configure:

```txt
Root Directory: frontend
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### Variável de ambiente na Vercel

```env
VITE_API_URL="https://sua-api.onrender.com"
```

Depois do deploy, copie a URL da Vercel e volte ao Render para atualizar:

```env
FRONTEND_ORIGIN="https://sua-url-da-vercel.vercel.app"
```

Republique o backend após alterar essa variável.

---

## 4. Seed inicial

Depois que o backend estiver conectado ao MongoDB Atlas, execute o seed localmente apontando para o banco de produção, ou use o shell do Render se disponível.

Localmente:

```powershell
cd backend
$env:DATABASE_URL="mongodb+srv://usuario:senha@cluster.mongodb.net/glossflow?retryWrites=true&w=majority"
npm install
npx prisma generate
npm run seed
```

Atenção: rode seed apenas quando quiser criar dados iniciais/demonstração.

---

## 5. Checklist rápido

- [ ] MongoDB Atlas liberado para conexão.
- [ ] `DATABASE_URL` configurada no Render.
- [ ] `JWT_SECRET` forte configurado.
- [ ] Backend abre `/health`.
- [ ] Vercel aponta `VITE_API_URL` para o Render.
- [ ] Render `FRONTEND_ORIGIN` aponta para a URL da Vercel.
- [ ] Login admin testado.
- [ ] Agendamento testado.
- [ ] Agenda Enterprise testada.
- [ ] PWA instalado no celular para validação.

---

## 6. Observação sobre o Render Free

Em planos gratuitos, a API pode demorar alguns segundos para responder após ficar inativa. Para apresentação comercial ou uso real, considere um plano pago para evitar cold start.
