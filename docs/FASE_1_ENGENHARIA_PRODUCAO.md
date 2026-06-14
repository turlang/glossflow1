# Fase 1 — Engenharia de Produção

Esta etapa deixou o GlossFlow preparado para operar como produto real, com contrato de API, healthcheck, readiness, Docker, CI/CD e observabilidade.

## Entregas implementadas

- `GET /health`: healthcheck simples para Render, Railway, Docker e uptime monitors.
- `GET /ready`: valida ambiente mínimo e mostra status das integrações.
- `GET /openapi.json`: contrato OpenAPI base para documentação e QA.
- `Dockerfile`: imagem full-stack com build separado de backend e frontend.
- `docker-compose.yml`: execução local conteinerizada.
- `.dockerignore`: evita envio de `.env`, `node_modules`, `dist` e `.git` para imagem.
- `.github/workflows/production-gate.yml`: valida backend e frontend em pull requests.
- Tratamento de erro com captura via `captureOperationalError`.

## Comandos

```bash
cd backend
npm ci
npx prisma generate --schema prisma/schema.prisma
npm run deploy:verify
```

```bash
docker compose up --build
```

## Critério para produção

Antes de vender o SaaS, rode:

```bash
cd backend
STRICT_INTEGRATIONS=true npm run check:env
npm run deploy:verify
```

Depois valide:

```txt
/health
/ready
/openapi.json
/admin/ecosystem/integrations
```
