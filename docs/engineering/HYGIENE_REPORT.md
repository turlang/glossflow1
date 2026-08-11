# GlossFlow — Relatório de Higienização

Data-base: 2026-08-10/11.

## Objetivo

Reduzir dívida técnica sem alterar os fluxos já validados de Agenda e WhatsApp. A higienização prioriza segurança, legibilidade, separação de responsabilidades e remoção de artefatos perigosos/obsoletos.

## Marco 1 — concluído

A primeira higienização estrutural foi aplicada e validada pelos Quality/Production Gates.

### Artefatos removidos

- `setup.js`: restaurador legado em Base64 que podia sobrescrever código atual com versões antigas.
- árvore `prisma/` da raiz: duplicava/divergia do schema canônico em `backend/prisma/`.
- `infra/render.blueprint.yaml`: blueprint antigo concorrendo com `render.yaml`.
- `usuario/`: cópia duplicada da documentação já mantida em `docs/usuario/`.
- `COMO_USAR_GLOSSFLOW.txt`: cópia antiga do guia Markdown.
- notas antigas de fases/releases na raiz: removidas da árvore ativa e preservadas no histórico do Git.

### Padrões adicionados

- `.editorconfig` para charset, LF, indentação e final de arquivo consistentes.
- `.prettierrc.json` e `.prettierignore` como contrato de formatação.
- `CONTRIBUTING.md` com fluxo de contribuição, segurança e commits.
- `docs/engineering/CODING_STANDARDS.md` com regras de backend/frontend e comentários.
- `docs/engineering/ARCHITECTURE.md` com arquitetura vigente.
- `docs/history/README.md` separando documentação histórica da fonte de verdade atual.

### Proteção automática

Foi criado `scripts/check-repository-hygiene.mjs`, executado pelo GitHub Actions antes dos builds. Ele impede o retorno dos principais artefatos legados, `.env` reais, backups locais e arquivos grandes acidentais.

O Quality Gate agora segue:

```text
repository-hygiene
       |
       +--> backend: Prisma -> TypeScript -> testes -> build
       |
       +--> frontend: npm ci -> Vite build
```

### Refatoração do frontend

`frontend/src/App.jsx` deixou de concentrar parsing de JWT, regras de navegação e matriz de endpoints administrativos.

Foram extraídos:

- `frontend/src/utils/auth.js`: papéis e helpers de UX/RBAC;
- `frontend/src/config/navigation.js`: tradução de `?action=` e normalização de página por papel;
- `frontend/src/services/backoffice-data.js`: carregamento do backoffice por papel/módulo.

Além de reduzir acoplamento, isso corrige uma falha estrutural: usuários `RECEPTION`/`PROFESSIONAL` não devem perder a sessão apenas porque não têm permissão para endpoints `ADMIN` como `/admin/users`.

### Refatoração do backend

`backend/src/server.ts` passou a ser apenas o bootstrap/compositor da API.

Foram extraídos:

- `src/config/environment.ts`: contrato de produção e build id;
- `src/config/cors.ts`: política CORS multi-tenant/white-label;
- `src/middlewares/rate-limit.ts`: limiter em memória e limpeza de buckets;
- `src/services/reminder-scheduler.service.ts`: scheduler dos lembretes da Agenda.

## Comentários — padrão adotado

“Código comentado” no GlossFlow significa documentação útil, não comentário em toda linha.

Devem ser comentados:

- propósito e contrato de módulos exportados;
- regras de segurança/multi-tenant;
- fallbacks e limitações de providers;
- efeitos colaterais e decisões que não são óbvias pelo código;
- trechos complexos cujo motivo não pode ser deduzido facilmente.

Não serão adicionados comentários redundantes como `// soma 1` antes de `count += 1`, pois isso reduz legibilidade e tende a ficar desatualizado.

## Documentação atualizada

Foram alinhados ao estado atual do produto:

- `README.md`;
- `COMO_USAR_GLOSSFLOW.md`;
- `DEPLOY_RENDER_VERCEL.md`;
- `PRODUCTION_CHECKLIST.md`;
- `QA_TEST_PLAN.md`;
- `QUALITY_GATE.md`;
- `backend/.env.example`;
- `render.yaml`.

Esses documentos agora refletem Groq como IA principal, Twilio como WhatsApp operacional e `backend/prisma/schema.prisma` como schema único.

## Validação do Marco 1

No commit de fechamento do marco:

- Repository Hygiene: **success**;
- Backend: `npm ci`, Prisma generate, TypeScript/lint, testes e build: **success**;
- Frontend: `npm ci` e Vite build: **success**;
- Production Gate backend/frontend: **success**.

## Dívida estrutural que ainda permanece

O projeto está mais seguro e organizado, mas a higienização completa ainda não termina aqui.

### Prioridade alta

- `frontend/src/components/admin/AdminDashboard.jsx` continua grande e reúne muitos domínios; deve ser dividido em módulos como Dashboard, Serviços, Equipe, Estoque, CRM, Financeiro, Automações e Segurança.
- `frontend/src/styles.css` ainda concentra estilos de muitos módulos e deve ser separado progressivamente sem causar regressão visual.
- o frontend ainda não possui ESLint real; o build Vite não deve ser vendido como substituto de análise estática.
- existem `any` herdados em rotas/serviços antigos do backend que devem ser tipados gradualmente.

### Prioridade média

- ampliar testes unitários/integração de Agenda, Estoque, CRM, RBAC e WhatsApp;
- reduzir funções longas em rotas antigas, movendo regra para serviços;
- revisar documentação de usuário em `docs/usuario/`, que ainda é muito curta em alguns arquivos.

## Próximo marco de higienização

Antes de iniciar novas funcionalidades de Estoque, o próximo marco deve atacar o principal monólito restante: **decomposição do `AdminDashboard.jsx` e organização dos estilos administrativos**, mantendo o Quality Gate verde a cada extração.
