# Tutorial das Tecnologias usadas no GlossFlow

Este documento explica as tecnologias usadas no SaaS e como cada uma aparece no projeto.

## 1. React

React é a biblioteca usada para criar a interface do usuário.

No projeto:

```txt
frontend/src/App.jsx
frontend/src/main.jsx
frontend/src/styles.css
```

Conceitos usados:

- Componentes
- Estado local
- Eventos de formulário
- Requisições para API
- Renderização condicional

Exemplo simples:

```jsx
function Example() {
  const [name, setName] = useState('');

  return <input value={name} onChange={(event) => setName(event.target.value)} />;
}
```

Quando usar:

- Criar novas telas.
- Criar novos formulários.
- Exibir dados vindos do backend.

Boas práticas:

- Componentes pequenos.
- Nomes claros.
- Evitar lógica de negócio complexa dentro do JSX.
- Centralizar chamadas HTTP quando o projeto crescer.

## 2. Vite

Vite é a ferramenta que sobe o frontend em desenvolvimento e gera o build de produção.

Comandos:

```bash
npm run dev
npm run build
npm run preview
```

Onde configura:

```txt
frontend/package.json
frontend/vite.config.* se for adicionado depois
```

Variáveis de ambiente do Vite precisam começar com `VITE_`:

```env
VITE_API_URL="http://localhost:3333"
VITE_SENTRY_DSN=""
```

## 3. Fastify

Fastify é o framework HTTP usado no backend.

Arquivo principal:

```txt
backend/src/server.ts
```

Exemplo de rota:

```ts
app.get('/health', async () => {
  return { ok: true };
});
```

No GlossFlow, o Fastify é responsável por:

- Criar a API.
- Registrar rotas.
- Aplicar CORS.
- Capturar erros.
- Adicionar hooks de auditoria e métricas.

## 4. TypeScript

TypeScript adiciona tipagem ao JavaScript.

No projeto, ele ajuda a evitar erros em:

- Parâmetros de funções.
- Objetos de request/response.
- Integrações.
- Retornos de serviços.

Comando importante:

```bash
npm run lint
```

Nesse projeto, o `lint` roda checagem TypeScript com:

```bash
tsc --noEmit
```

## 5. Prisma

Prisma é o ORM usado para acessar o MongoDB.

Arquivos principais:

```txt
backend/prisma/schema.prisma
backend/src/lib/prisma.ts
```

Comandos:

```bash
npm run prisma:generate
npm run prisma:push
```

Exemplo de consulta:

```ts
const services = await prisma.service.findMany({
  where: { salonId: tenant.salonId }
});
```

Boas práticas:

- Sempre usar `salonId` em dados administrativos.
- Rodar `prisma:generate` após mudar o schema.
- Rodar `prisma:push` para atualizar o banco.

## 6. MongoDB Atlas

MongoDB Atlas é o banco de dados recomendado para o SaaS.

Variável:

```env
DATABASE_URL="mongodb+srv://usuario:senha@cluster.mongodb.net/glossflow?retryWrites=true&w=majority"
```

Uso no projeto:

- Salões
- Usuários
- Serviços
- Agenda
- Clientes
- Estoque
- Auditoria
- Funil comercial

Cuidados:

- Criar usuário com permissão limitada.
- Liberar IP do ambiente de deploy.
- Nunca expor senha do banco.

## 7. Zod

Zod valida dados recebidos pela API.

Arquivo principal:

```txt
backend/src/routes/schemas.ts
```

Exemplo:

```ts
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
```

Uso:

```ts
const data = loginSchema.parse(request.body);
```

Vantagem:

- Evita dados quebrados.
- Reduz bugs.
- Padroniza validação.

## 8. JWT

JWT é usado para autenticação.

Fluxo:

1. Usuário faz login.
2. Backend valida senha.
3. Backend gera token.
4. Frontend envia token no header `Authorization`.
5. Backend libera ou bloqueia a rota.

Header:

```txt
Authorization: Bearer TOKEN_AQUI
```

Variável obrigatória:

```env
JWT_SECRET="chave-forte"
```

## 9. RBAC

RBAC significa controle de acesso por papel.

Papéis usados:

```txt
ADMIN
RECEPTION
PROFESSIONAL
```

Arquivo:

```txt
backend/src/middlewares/auth.ts
```

Uso:

```ts
requireRoles(['ADMIN', 'RECEPTION'])
```

## 10. Sentry

Sentry é usado para monitorar erros em produção.

Variáveis:

```env
SENTRY_DSN=""
VITE_SENTRY_DSN=""
```

No projeto existe um serviço preparado:

```txt
backend/src/services/sentry.service.ts
```

Para uso real, instale o SDK oficial e conecte o DSN da conta.

## 11. WhatsApp Cloud API

A integração está preparada para a Meta WhatsApp Cloud API.

Arquivo:

```txt
backend/src/services/whatsapp.service.ts
```

Variáveis:

```env
WHATSAPP_PROVIDER="meta"
WHATSAPP_DRY_RUN="true"
WHATSAPP_ACCESS_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_API_VERSION="v20.0"
```

Teste:

```txt
POST /admin/whatsapp/send-test
```

Em `dry-run`, o sistema simula o envio. Para envio real, configure as credenciais e use:

```env
WHATSAPP_DRY_RUN="false"
```

## 12. Mercado Pago PIX

Usado para pagamento avulso por PIX.

Arquivo:

```txt
backend/src/services/payments.service.ts
```

Variável:

```env
MERCADO_PAGO_ACCESS_TOKEN=""
```

Teste:

```txt
POST /admin/payments/checkout
```

Provider:

```json
{
  "provider": "mercadopago",
  "amount": 99.9,
  "description": "Reserva de horário",
  "payerEmail": "cliente@email.com"
}
```

## 13. Stripe

Usado para assinatura do SaaS.

Variáveis:

```env
STRIPE_SECRET_KEY=""
STRIPE_PRICE_ID=""
STRIPE_SUCCESS_URL="http://localhost:5173/sucesso"
STRIPE_CANCEL_URL="http://localhost:5173/cancelado"
```

Provider:

```json
{
  "provider": "stripe",
  "amount": 149,
  "description": "Assinatura GlossFlow Pro",
  "payerEmail": "cliente@email.com"
}
```

## 14. OpenAI

A IA fica preparada por variável de ambiente:

```env
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

Ideias de uso dentro do GlossFlow:

- Previsão de faturamento.
- Sugestão de horários para preencher agenda.
- Campanhas para clientes inativos.
- Resumo executivo do salão.
- Assistente para recepção.

Recomendação:

- Nunca chamar IA direto do frontend.
- Sempre passar pelo backend.
- Nunca enviar dados sensíveis sem necessidade.

## 15. Docker

Docker empacota a aplicação para rodar em ambiente padronizado.

Arquivos:

```txt
Dockerfile
docker-compose.yml
.dockerignore
```

Comando:

```bash
docker compose up --build
```

Use Docker para:

- Testar ambiente limpo.
- Facilitar deploy.
- Reduzir erro de versão local.

## 16. GitHub Actions

GitHub Actions valida o projeto automaticamente a cada push.

Arquivos:

```txt
.github/workflows/quality.yml
.github/workflows/production-gate.yml
```

A pipeline deve validar:

- Instalação.
- Prisma generate.
- Lint.
- Testes.
- Build.

## 17. PWA

PWA permite instalar o frontend como app.

Arquivos:

```txt
frontend/public/manifest.webmanifest
frontend/public/service-worker.js
```

Uso:

- Melhor experiência no celular.
- Acesso mais rápido.
- Aparência de aplicativo.

## 18. OpenAPI

OpenAPI documenta a API.

Rota:

```txt
GET /openapi.json
```

Arquivo gerador:

```txt
backend/src/services/openapi.service.ts
```

Serve para:

- Documentar rotas.
- Integrar com Swagger UI futuramente.
- Ajudar outro dev a consumir a API.

## 19. Como estudar o projeto na ordem certa

1. Leia `README.md`.
2. Leia `docs/GUIA_DO_DESENVOLVEDOR.md`.
3. Rode o backend local.
4. Rode o frontend local.
5. Abra `backend/src/server.ts`.
6. Abra `backend/src/routes/appRoutes.ts`.
7. Estude `auth.routes.ts` e `middlewares/auth.ts`.
8. Estude `admin-crud.routes.ts`.
9. Estude `integrations.routes.ts`.
10. Estude `commercial.routes.ts`.
11. Leia `docs/RUNBOOK_OPERACIONAL.md` antes de deploy.

## 20. Próximos passos técnicos sugeridos

- Separar o frontend em componentes menores.
- Adicionar React Router.
- Adicionar camada `apiClient` no frontend.
- Adicionar testes de API com Supertest ou Vitest.
- Adicionar Playwright para testes E2E.
- Adicionar Swagger UI visual.
- Persistir leads em coleção própria em vez de usar fallback em AuditLog.
- Adicionar webhooks reais de pagamento.
