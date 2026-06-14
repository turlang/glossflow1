# GlossFlow Enterprise v10 — Production Candidate

GlossFlow é um SaaS para salões de beleza com vitrine pública, agendamento online, painel administrativo, CRM, estoque, financeiro, comissões, fidelidade, automações e estrutura multiempresa.

Esta versão foi preparada como **candidata de produção**, com reforço de segurança multi-tenant, qualidade de build, testes mínimos e documentação de deploy, com foco em experiência premium, clareza operacional e estabilidade para testes com salões reais.

## Nota alvo da versão

| Área | Meta |
|---|---:|
| Backend | 9,5 |
| Banco de dados | 9,5 |
| Funcionalidades | 9,5 |
| UX/UI | 9,5 |
| Segurança base | 9,0 |
| Documentação | 9,5 |


## Quality Gate v10

Consulte `QUALITY_GATE.md` para ver as melhorias de engenharia aplicadas, os comandos de validação e a nota técnica por cenário.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Fastify + TypeScript
- Banco: MongoDB + Prisma 5.22
- Autenticação: JWT + perfis de acesso
- PWA: manifesto básico
- Estilo: Design System próprio em CSS puro

## Módulos

- Vitrine pública do salão
- Agendamento online
- Login administrativo
- Serviços, profissionais e portfólio
- Controle de estoque
- CRM de clientes
- Financeiro
- Comissão por profissional
- Fidelidade
- Planos e assinatura SaaS
- Templates de WhatsApp
- Central de automações
- Insights gerenciais preparados para IA
- Multiempresa via `salonId`

## Instalação — Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npm run seed
npm run lint
npm test
npm run build
npm run dev
```

## Instalação — Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Login inicial de teste

```txt
E-mail: admin@glossflow.com
Senha: 123456
```

Troque a senha antes de usar com clientes reais.

## Segurança

- O `.env` real foi removido do pacote.
- Use somente `.env.example` como modelo.
- Configure `FRONTEND_ORIGIN` em produção.
- Configure `JWT_SECRET` forte.
- Ative backup no MongoDB Atlas.

## Arquivos importantes

- `PRODUCTION_CHECKLIST.md`: checklist para produção.
- `QA_TEST_PLAN.md`: roteiro de testes.
- `COMO_USAR_GLOSSFLOW.md`: guia de uso para usuário final.

## Observação honesta

Esta versão é forte para apresentação, piloto e validação comercial. A palavra “final” em SaaS significa **final candidata**, porque produtos reais evoluem após feedback de usuários, métricas e testes em produção.

## Atualização v8.6 — Automações e Planos mais claros

Esta versão melhora dois pontos importantes de uso comercial:

- **Central de Automações:** agora permite criar automações do zero, usar modelos prontos, editar, pausar e excluir templates salvos.
- **Planos SaaS:** a tela de assinatura explica claramente o que o Trial oferece e o que muda nos planos pagos Start, Profissional e Enterprise.

> Observação: o envio real via WhatsApp ainda depende da integração com um provedor externo, como Evolution API, Twilio ou Z-API. O sistema já prepara templates, eventos e prévia visual para essa etapa.

## v9.3 — Dashboard Executivo

A versão v9.3 adiciona a aba **Dashboard** ao painel administrativo, com indicadores de receita, lucro, ticket médio, retenção, meta mensal, rankings e insights executivos.

## Versão 9.5 — Polimento, Ecossistema, Observabilidade e UX

Esta versão adiciona as camadas finais de maturidade para uso piloto/comercial:

- Ecossistema de integrações: OpenAI, WhatsApp Business, Mercado Pago, Stripe, Google Calendar, Cloudinary, Sentry e Meta Ads.
- Observabilidade: health score, latência média, rotas mais acessadas, uso de memória, uptime e recomendações operacionais.
- UX Premium: área de atalhos, tour recomendado e navegação orientada a tarefas de negócio.
- IA conectada: mantém fallback local e usa OpenAI quando `OPENAI_API_KEY` estiver configurada.

### Variáveis opcionais de integração

Configure no `backend/.env` somente as integrações que for usar:

```env
OPENAI_API_KEY=""
WHATSAPP_API_URL=""
WHATSAPP_API_TOKEN=""
MERCADO_PAGO_ACCESS_TOKEN=""
STRIPE_SECRET_KEY=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
CLOUDINARY_URL=""
SENTRY_DSN=""
META_ACCESS_TOKEN=""
```

Sem essas chaves, o sistema continua funcionando com modo demonstrativo/local.

## Deploy Render + Vercel

O projeto inclui um guia específico para publicação:

- `DEPLOY_RENDER_VERCEL.md`
- `render.yaml`
- `frontend/vercel.json`

Resumo:

- Backend: Render
- Frontend: Vercel
- Banco: MongoDB Atlas

## Versão 10 — Fase 2 pronta para credenciais reais

Esta revisão adiciona conectores reais em modo seguro para:

- WhatsApp Cloud API
- PIX via Mercado Pago
- Assinaturas via Stripe
- IA via OpenAI
- Observabilidade via Sentry
- Deploy validável com variáveis de produção

Consulte `FASE_2_INTEGRACOES.md` para preencher as informações externas e sair do modo `dry-run`.

Novas rotas administrativas:

```txt
GET  /admin/ecosystem/integrations
POST /admin/ecosystem/integrations/:key/test
POST /admin/whatsapp/send-test
POST /admin/payments/checkout
```

---

## GlossFlow v10 — Fases 1, 2 e 3

Esta versão foi preparada para operar como SaaS comercial configurável.

### Fase 1 — Engenharia de produção

- Healthcheck: `GET /health`
- Readiness: `GET /ready`
- OpenAPI: `GET /openapi.json`
- Dockerfile e docker-compose
- GitHub Actions de produção
- Runbook operacional
- Captura de erro preparada para Sentry

### Fase 2 — Integrações configuráveis

- WhatsApp em dry-run ou envio real
- Mercado Pago PIX em dry-run ou real
- Stripe Checkout em dry-run ou real
- OpenAI preparada
- Sentry preparado

### Fase 3 — Comercial SaaS

- Página SaaS no frontend
- Planos comerciais públicos
- Captura de leads
- Trial de 7 dias
- Checkout de assinatura
- Indicação de afiliados

Rotas principais:

```txt
GET  /commercial/plans
POST /commercial/leads
POST /commercial/trial
POST /commercial/checkout
POST /commercial/affiliate/referral
```

Documentação complementar:

```txt
docs/FASE_1_ENGENHARIA_PRODUCAO.md
docs/FASE_3_COMERCIAL_SAAS.md
docs/RUNBOOK_OPERACIONAL.md
```

### Validação recomendada

```bash
cd backend
npm ci
npx prisma generate --schema prisma/schema.prisma
npm run deploy:verify
```

Com integrações obrigatórias:

```bash
STRICT_INTEGRATIONS=true npm run check:env
```

## Documentação para programadores

Para facilitar manutenção por outro desenvolvedor, consulte também:

- `docs/GUIA_DO_DESENVOLVEDOR.md` — instalação, arquitetura, rotas, padrões e checklist.
- `docs/TUTORIAL_TECNOLOGIAS.md` — explicação das tecnologias usadas no SaaS.
- `docs/MAPA_DE_COMENTARIOS_E_MANUTENCAO.md` — onde estão os comentários mais importantes e como manter o padrão.
- `docs/RUNBOOK_OPERACIONAL.md` — operação, deploy e diagnóstico.
- `docs/FASE_1_ENGENHARIA_PRODUCAO.md` — engenharia de produção.
- `docs/FASE_2_INTEGRACOES.md` — integrações WhatsApp, pagamento, IA e Sentry.
- `docs/FASE_3_COMERCIAL_SAAS.md` — camada comercial, trial, leads e afiliados.
