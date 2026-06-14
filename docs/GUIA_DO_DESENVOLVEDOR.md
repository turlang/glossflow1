# Guia do Desenvolvedor — GlossFlow SaaS

Este guia foi escrito para que outro programador consiga entender, instalar, executar, testar, manter e evoluir o GlossFlow sem depender de conhecimento prévio do projeto.

## 1. Visão geral

O GlossFlow é um SaaS para salões de beleza. A aplicação foi organizada em três camadas principais:

- **Frontend React + Vite**: interface do cliente, painel administrativo, landing comercial e telas do SaaS.
- **Backend Fastify + TypeScript**: API REST, autenticação, regras de negócio, integrações, auditoria, saúde e rotas comerciais.
- **Banco MongoDB + Prisma**: persistência dos dados com modelagem tipada.

A arquitetura segue a ideia de **multi-tenant**, ou seja, vários salões podem usar o mesmo sistema, mas cada salão deve acessar apenas seus próprios dados por meio do campo `salonId`.

## 2. Estrutura de pastas

```txt
backend/
  src/
    lib/                 # Conexões compartilhadas, como Prisma
    middlewares/         # Autenticação e autorização
    routes/              # Rotas da API separadas por domínio
    services/            # Serviços de integração e suporte operacional
  prisma/
    schema.prisma        # Modelagem oficial usada pelo backend
    seed.js              # Dados iniciais para desenvolvimento
  tests/                 # Testes mínimos de ambiente/qualidade

frontend/
  src/
    App.jsx              # Aplicação principal React
    main.jsx             # Ponto de entrada do Vite
    styles.css           # Estilos globais
  public/
    manifest.webmanifest # PWA
    service-worker.js    # Cache básico do app

docs/
  GUIA_DO_DESENVOLVEDOR.md
  TUTORIAL_TECNOLOGIAS.md
  FASE_1_ENGENHARIA_PRODUCAO.md
  FASE_2_INTEGRACOES.md
  FASE_3_COMERCIAL_SAAS.md
  RUNBOOK_OPERACIONAL.md
```

## 3. Como instalar localmente

### 3.1 Pré-requisitos

Use Node compatível com o projeto:

```bash
node -v
npm -v
```

Recomendado:

```txt
Node >=20 e <23
npm >=10
```

### 3.2 Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edite o `.env` e configure pelo menos:

```env
DATABASE_URL="mongodb+srv://usuario:senha@cluster.mongodb.net/glossflow?retryWrites=true&w=majority"
JWT_SECRET="uma-chave-grande-e-segura-com-mais-de-32-caracteres"
FRONTEND_ORIGIN="http://localhost:5173"
```

Depois rode:

```bash
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

API local:

```txt
http://localhost:3333
```

### 3.3 Frontend

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend local:

```txt
http://localhost:5173
```

## 4. Fluxo básico para testar

1. Suba o backend.
2. Suba o frontend.
3. Acesse o frontend local.
4. Faça login com o usuário criado pelo `seed.js`.
5. Teste agenda, serviços, clientes, dashboard e integrações em modo `dry-run`.

Rotas úteis:

```txt
GET /health
GET /ready
GET /openapi.json
GET /admin/ecosystem/integrations
POST /admin/whatsapp/send-test
POST /admin/payments/checkout
GET /commercial/plans
POST /commercial/leads
POST /commercial/trial
```

## 5. Como o multi-tenant funciona

O token JWT carrega o contexto do usuário:

```ts
{
  id: string;
  email: string;
  role: 'ADMIN' | 'RECEPTION' | 'PROFESSIONAL';
  salonId: string;
}
```

Toda rota administrativa deve filtrar dados por `salonId`:

```ts
where: {
  id,
  salonId: tenant.salonId
}
```

Regra obrigatória para manutenção:

> Nenhuma rota administrativa deve atualizar, listar ou excluir dados sem validar o `salonId` do usuário logado.

## 6. Como adicionar uma nova rota

1. Crie um arquivo em `backend/src/routes`, por exemplo:

```txt
backend/src/routes/coupons.routes.ts
```

2. Crie os schemas Zod em `schemas.ts` ou no próprio arquivo.
3. Use `getTenant(request)` se a rota for administrativa.
4. Registre a rota em `appRoutes.ts`.
5. Atualize `openapi.service.ts` se a rota for pública/importante.
6. Adicione testes se a regra for crítica.

Exemplo:

```ts
app.get('/admin/coupons', async (request) => {
  const tenant = getTenant(request);
  return prisma.coupon.findMany({
    where: { salonId: tenant.salonId }
  });
});
```

## 7. Padrão de validação com Zod

Toda entrada externa deve passar por schema Zod:

```ts
const body = z.object({
  name: z.string().min(2),
  price: z.coerce.number().positive()
}).parse(request.body);
```

Isso evita dados inválidos no banco e deixa os erros mais claros.

## 8. Integrações em modo dry-run

As integrações foram preparadas para funcionar de duas formas:

- **Dry-run**: simula a operação sem chamar serviços externos.
- **Real**: chama APIs externas quando as credenciais forem preenchidas.

Variáveis principais:

```env
WHATSAPP_DRY_RUN="true"
PAYMENTS_DRY_RUN="true"
OPENAI_API_KEY=""
SENTRY_DSN=""
MERCADO_PAGO_ACCESS_TOKEN=""
STRIPE_SECRET_KEY=""
```

Para ativar real:

```env
WHATSAPP_DRY_RUN="false"
PAYMENTS_DRY_RUN="false"
```

Nunca ative modo real sem testar antes em sandbox/homologação.

## 9. Scripts importantes

Backend:

```bash
npm run dev              # desenvolvimento
npm run build            # compila TypeScript
npm run start            # executa dist/server.js
npm run lint             # checagem TypeScript
npm test                 # testes Node
npm run prisma:generate  # gera Prisma Client
npm run prisma:push      # aplica schema no MongoDB
npm run seed             # popula dados iniciais
npm run deploy:verify    # valida ambiente, prisma, lint, testes e build
```

Frontend:

```bash
npm run dev
npm run build
npm run preview
npm run deploy:verify
```

## 10. Checklist antes de abrir Pull Request

```bash
cd backend
npm run deploy:verify

cd ../frontend
npm run deploy:verify
```

Também confirme:

- `.env` não foi commitado.
- Não existem `node_modules` no repositório.
- Rotas administrativas usam `salonId`.
- Nenhuma credencial real foi colocada no código.
- Alterações importantes foram documentadas.

## 11. Checklist antes de produção

- `NODE_ENV=production`.
- `JWT_SECRET` forte e único.
- `FRONTEND_ORIGIN` apontando para domínio real.
- `DATABASE_URL` de produção configurado.
- `SENTRY_DSN` configurado.
- `WHATSAPP_DRY_RUN=false` apenas depois de validar a conta Meta/Twilio.
- `PAYMENTS_DRY_RUN=false` apenas depois de testar pagamento em sandbox.
- `GET /ready` retornando status saudável.
- Logs e alertas acompanhados durante o primeiro deploy.

## 12. Regras de ouro para evoluir o projeto

1. Não misture regra de negócio com componente visual.
2. Não salve segredo em arquivo versionado.
3. Não crie rota administrativa sem autenticação.
4. Não acesse dados sem `salonId`.
5. Não aceite entrada externa sem validação.
6. Não remova auditoria de operações críticas.
7. Não suba integração real sem `dry-run` testado.
