# GlossFlow v9.4 — Segurança Corporativa, UX Premium, PWA Real e IA Conectada

Esta versão eleva o GlossFlow para um patamar mais próximo de SaaS comercial maduro.

## 1. Segurança Corporativa

Implementado:

- Access token curto.
- Refresh token revogável.
- Controle de sessões administrativas.
- Auditoria de ações POST/PUT/DELETE no painel admin.
- Score operacional de segurança.
- Registro de consentimentos LGPD.
- Exportação de dados de cliente para LGPD.
- Backup lógico operacional.
- Rate limit e cabeçalhos básicos de segurança já preservados.

Novas rotas:

- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /admin/security/overview`
- `GET /admin/security/audit-logs`
- `GET /admin/security/sessions`
- `POST /admin/security/sessions/:id/revoke`
- `POST /admin/security/lgpd/consents`
- `GET /admin/security/lgpd/export/:clientId`
- `POST /admin/security/backups`

## 2. UX Premium

Implementado:

- Busca rápida de módulos no menu administrativo.
- Nova aba de Segurança.
- Nova aba App/PWA.
- Controles visuais para sessões, auditoria, backup e LGPD.
- Cards de governança mais claros e operacionais.

## 3. PWA Real

Implementado:

- `service-worker.js` com cache básico.
- Manifest com escopo, ícone SVG e atalhos.
- Registro automático do service worker no frontend.
- Tela administrativa explicando status online/offline e instalação.

## 4. IA Conectada

Implementado:

- A rota `/admin/ai/assistant` continua funcionando sem dependência externa.
- Se `OPENAI_API_KEY` estiver no `.env`, usa OpenAI com contexto resumido do salão.
- Se a API externa falhar, retorna automaticamente para inteligência local.

Variáveis novas:

```env
ACCESS_TOKEN_MINUTES=30
REFRESH_TOKEN_DAYS=7
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

## Como atualizar

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Observação

A integração com OpenAI é opcional. Para demonstração local, o assistente continua respondendo usando inteligência local baseada nos dados do salão.
