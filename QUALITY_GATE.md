# GlossFlow Smart — Quality Gate

O Quality Gate existe para impedir regressões estruturais, erros de TypeScript/build e retorno de artefatos inseguros antes de uma mudança chegar ao ambiente de produção.

## Pipeline atual

O workflow `.github/workflows/quality.yml` possui três gates independentes por responsabilidade:

1. `repository-hygiene`
2. `backend`
3. `frontend`

Backend e frontend só começam depois que a higienização estrutural é aprovada.

## Repository Hygiene

Executa:

```bash
node scripts/check-repository-hygiene.mjs
```

O checker bloqueia, entre outros:

- `setup.js` restaurador legado;
- schema/seed Prisma duplicados na raiz;
- blueprint Render antigo duplicado;
- `.env` real versionado;
- arquivos `.bak`, `.old`, `.orig`, `.tmp` e `.temp`;
- arquivos acima de 5 MB sem revisão explícita.

A fonte Prisma canônica é:

```text
backend/prisma/schema.prisma
```

O blueprint Render canônico é:

```text
render.yaml
```

## Backend Gate

Executa:

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build
```

`npm run lint` atualmente usa o TypeScript em modo `--noEmit`, preservando `strict: true` como validação estática principal do backend.

## Frontend Gate

Executa:

```bash
cd frontend
npm ci
npm run build
```

O build Vite é o gate automatizado atual do frontend. A adoção de ESLint real está registrada como evolução de engenharia; não chamamos o build de desenvolvimento de análise estática completa.

## Critérios além do CI

CI verde não substitui smoke test em fluxos externos. Mudanças em Agenda, WhatsApp, pagamentos, autenticação ou isolamento multi-tenant precisam de validação do comportamento afetado.

Exemplos:

- Agenda: criar/reagendar/cancelar e conferir conflito/jornada;
- Twilio: observar callback `sent` e, quando disponível, `delivered`/`read`;
- RBAC: testar papéis diferentes sem vazamento entre tenants;
- CRM/Estoque: confirmar persistência e permissões depois de CRUDs.

## Padrões de manutenção

Consulte:

- `docs/engineering/CODING_STANDARDS.md`
- `docs/engineering/ARCHITECTURE.md`
- `docs/engineering/HYGIENE_REPORT.md`
- `CONTRIBUTING.md`

Comentários devem documentar contratos, riscos, segurança, decisões e fallbacks. Comentários que apenas repetem o código são considerados ruído e não fazem parte do padrão do GlossFlow.

## Definição de aprovado

Uma mudança estrutural está aprovada quando:

- Repository Hygiene passa;
- backend passa TypeScript/testes/build;
- frontend gera build;
- o fluxo alterado possui smoke test quando necessário;
- nenhum segredo ou artefato obsoleto foi introduzido.
