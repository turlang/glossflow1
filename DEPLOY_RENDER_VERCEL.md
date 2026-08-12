# Deploy do GlossFlow — Render + Vercel

Arquitetura operacional atual:

```text
Frontend React/Vite  -> Vercel
Backend Fastify/TS   -> Render
Banco                -> MongoDB Atlas
IA                   -> Groq/OpenAI conforme ambiente
WhatsApp             -> Twilio/Meta/provider configurado
```

O arquivo `render.yaml` é o blueprint canônico do backend.

## 1. Pré-requisitos

- repositório GitHub atualizado;
- MongoDB Atlas ativo;
- `DATABASE_URL` válida;
- `JWT_SECRET` forte;
- `FRONTEND_ORIGIN` correto;
- projeto Vercel apontando para `frontend/`;
- serviço Render apontando para `backend/`;
- credenciais de IA/WhatsApp apenas quando os módulos forem ativados;
- nenhum segredo real versionado.

Nunca copiar Auth Token da Twilio, JWT secret, API key, senha ou snapshot de backup para commit, issue pública ou log.

## 2. Backend no Render

Configuração equivalente ao blueprint:

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

Segurança/backup:

```env
BACKUP_RESTORE_ENABLED=false
BACKUP_SIGNING_SECRET=...
```

O restore deve permanecer desligado na operação normal.

IA, quando habilitada:

```env
AI_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=...
```

WhatsApp, quando habilitado:

```env
WHATSAPP_PROVIDER=twilio
WHATSAPP_DEFAULT_COUNTRY_CODE=55
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+...
TWILIO_WEBHOOK_URL=https://glossflow-api.onrender.com/webhooks/whatsapp/twilio
TWILIO_STATUS_CALLBACK_URL=https://glossflow-api.onrender.com/webhooks/whatsapp/twilio/status
```

Para Sandbox/Trial, configure os campos específicos do provider. **Trial/Sandbox não deve ser apresentado como linha definitiva de produção do cliente.**

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

`VITE_SALON_SLUG` pode definir um tenant padrão quando a estratégia de vitrine exigir.

## 4. Ordem segura de publicação

1. criar branch/PR;
2. aguardar `GlossFlow Quality Gate` e `Production Gate` do head;
3. revisar a alteração e fazer merge em `main`;
4. aguardar Vercel publicar o SHA de `main`;
5. aguardar Render publicar o mesmo ciclo de release;
6. executar `Production Smoke Validation`;
7. o smoke deve comparar os 12 primeiros caracteres do SHA esperado com `/health.build`, `X-GlossFlow-Build` e `/ready.build`;
8. `/ready.database.ok` deve ser `true`;
9. somente então declarar o deploy convergido.

**Não aceitar smoke verde em build antigo.** A rastreabilidade exata é requisito de release.

## 5. Banco e Prisma

Schema canônico:

```text
backend/prisma/schema.prisma
```

Comandos de validação/desenvolvimento:

```bash
cd backend
npm ci
npm run prisma:generate
npm run deploy:verify
```

`npm run prisma:push` altera o schema do banco e deve ser executado somente quando houver mudança de schema revisada e janela de implantação apropriada. Não usar como etapa genérica de troubleshooting.

`npm run seed` recria dados de demonstração. **Nunca executar seed em produção com dados reais.**

## 6. Smoke global de produção — somente leitura

O smoke permanente deve validar sem escrever dados:

- [ ] frontend responde e contém GlossFlow;
- [ ] `/health` responde `ok=true`;
- [ ] Build ID do body = `X-GlossFlow-Build`;
- [ ] Build ID = 12 primeiros caracteres do SHA de `main` esperado;
- [ ] `/ready` responde no mesmo build;
- [ ] `database.ok=true`;
- [ ] `/public/salon` responde tenant válido;
- [ ] `/services`, `/professionals` e `/portfolio` respondem arrays;
- [ ] `/appointments` read model responde array.

Criação de agendamento, alteração de estoque, CRM, LGPD, restore e WhatsApp real **não pertencem ao smoke global**.

## 7. Homologação do tenant

Depois que a release base está verde, o cliente/tenant precisa de validação própria conforme `docs/usuario/07_CHECKLIST_IMPLANTACAO.md`:

- serviços e profissionais;
- jornadas, pausas e bloqueios;
- estoque inicial;
- usuários e papéis;
- marca/white-label;
- integrações contratadas;
- dados de homologação autorizados;
- treinamento dos responsáveis.

## 8. WhatsApp e providers externos

- validar assinatura e webhook em sandbox/trial autorizado;
- envio real somente com autorização explícita;
- confirmar callback quando o provider permitir;
- não reenviar mensagens em loop em caso de falha;
- manter idempotência.

Stripe/Mercado Pago só são bloqueadores quando billing automático fizer parte do plano vendido. Sentry é hardening opcional enquanto não estiver no SLA contratado; ausência nunca deve ser mostrada como integração conectada.

## 9. Render Free e jobs temporizados

Instâncias gratuitas podem hibernar. Isso aumenta a latência do primeiro request e pode prejudicar timers internos. Para lembretes com horário estrito em operação comercial, usar infraestrutura sem hibernação ou rotina externa idempotente compatível com a arquitetura definida.

## 10. Critério de GO

O deploy está apto ao go-live quando:

1. gates estão verdes;
2. Vercel está `READY` no SHA esperado;
3. Render serve o Build ID exato;
4. MongoDB está ready;
5. smoke final está verde;
6. não há regressão P0/P1 conhecida;
7. checklist do tenant foi concluído para os módulos vendidos.

A matriz canônica da release fica em `docs/engineering/MARCO24_RELEASE_VALIDATION.md`.