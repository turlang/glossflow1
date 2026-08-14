# Marco 36 — Higiene de Branches

Baseline auditada: `main` em `42804f4d9e047684f2d84c5fb5e3e82f5ed7059e`.

Objetivo: reduzir branches históricas sem perder código útil, sem reintroduzir versões antigas e sem alterar a baseline de produção antes do merge controlado do Marco 36.

## Regras

1. `main` é a única fonte de verdade operacional.
2. Branch antiga nunca deve ser mesclada novamente apenas porque está divergente.
3. Branch de PR já mesclado é candidata à remoção, não a novo merge.
4. Branch sem PR precisa ser comparada com `main` antes de qualquer remoção.
5. Código útil encontrado apenas em branch antiga deve ser recuperado seletivamente para o candidato atual; a branch antiga não é mesclada inteira.
6. Limpeza de refs só ocorre depois de gates verdes e revisão final do inventário.

## Branches preservadas

- `main` — produção/fonte de verdade;
- `feature/marco36-commercial-homologation` — candidato ativo do Marco 36.

## Candidatas à remoção por PR já mesclado

As branches abaixo representam trabalho histórico já integrado por PR e não devem voltar ao `main` por novo merge:

- `agent/rebuild-hygiene-m2-9` — PR #1;
- `agent/production-smoke` — PR #2;
- `fix/homologation-ui-select-layout` — PR #3;
- `feature/marco16-role-homologation` — PR #4;
- `feature/marco17-agenda-commercial` — PR #5;
- `feature/marco18-estoque-operacional` — PR #6;
- `feature/marco19-crm-retencao` — PR #7;
- `feature/marco20-ai-whatsapp-production` — PR #8;
- `feature/marco21-superadmin-saas-lifecycle` — PR #9;
- `feature/marco22-observability-performance` — PR #10;
- `fix/marco22-readiness-smoke-convergence` — PR #11;
- `fix/marco22-render-build-traceability` — PR #12;
- `feature/marco23-security-lgpd` — PR #17;
- `fix/production-smoke-expected-build` — PR #18;
- `feature/marco24-release-commercial` — PR #20;
- `fix/auth-expired-login-redirect` — PR #21;
- `fix/auth-refresh-single-flight` — PR #22;
- `fix/mongodb-session-null-semantics` / variante final associada — ciclo do PR #23;
- branches de logout associadas ao ciclo do PR #24;
- `chore/clean-production-reset` — PR #25;
- `feat/superadmin-browser-reset` — PR #26;
- `agent/marcos-25-34` — PR #27.

A remoção dessas refs é higiene; os commits/PRs continuam preservados no histórico do GitHub.

## Duplicatas/staging antigas

- `agent/rebuild-hygiene`;
- `agent/rebuild-hygiene-backup`;
- `agent/rebuild-hygiene-work`.

As três apontavam para o mesmo corte histórico `2f9923cc...` na auditoria. Devem ser tratadas como staging antigo e não como fontes alternativas de produto.

## Marco 35 — branches intermediárias

### `agent/marco35-etapa2-transacional`

O head `a9d64793...` é ancestral de `main`: a comparação mostrou `main` 38 commits à frente e zero commits exclusivos na branch. Candidata segura à remoção depois do merge do Marco 36.

### `agent/marco35-etapa2-transacional-v2`

A branch possui um commit exclusivo (`96318951...`) com versão inicial do diagnóstico transacional. O `main` contém versões posteriores e mais completas de:

- `transactional-homologation.routes.ts`;
- registro em `appRoutes.ts`;
- teste `marco35-transactional-homologation.test.js`.

Portanto a branch é **superseded**, não deve ser mesclada. Preservar apenas pelo histórico do commit/PR se necessário.

### `agent/marco-35-consolidacao`

A comparação encontrou três commits exclusivos. Dois conteúdos estavam claramente superados pelo catálogo atual, mas havia uma peça útil que não tinha chegado ao `main`:

- `platform-module-readiness.routes.ts` — endpoint read-only `/platform-admin/modules/readiness`.

O Marco 36 recuperou seletivamente essa rota para o candidato atual, registrando-a somente dentro do wrapper `SUPER_ADMIN` e usando o **catálogo de maturidade atual**, sem trazer de volta percentuais/descrições antigos.

Após o merge do Marco 36 e gates verdes, essa branch passa a ser candidata à remoção.

## Branch `noop-ignore`

O único commit exclusivo adiciona apenas `.noop` com conteúdo `ignore`. Não contém capacidade de produto e é candidata à remoção.

## Branches que exigem conferência final antes da exclusão

Estas refs devem ser comparadas individualmente com `main` antes da remoção, mesmo quando o nome sugere correção já absorvida:

- `fix/auth-refresh-single-flight-v2`;
- `fix/logout-explicit-handler`;
- `fix/logout-session-lifecycle`;
- `fix/mongodb-session-null-semantics-ci`;
- qualquer branch nova criada após esta auditoria.

A regra é simples: se houver commit exclusivo com mudança funcional ainda ausente em `main`, recuperar seletivamente em PR atual; nunca mesclar a branch velha inteira.

## Resultado da auditoria até aqui

- nenhum PR aberto na baseline auditada;
- `main` e produção estavam sincronizados no fechamento do Marco 35;
- branches antigas não representam automaticamente código faltante;
- uma capacidade útil realmente ausente foi encontrada e recuperada seletivamente: readiness de módulos para SUPER_ADMIN;
- nenhuma branch antiga foi mesclada novamente;
- nenhuma limpeza destrutiva de dados foi executada.

## Critério de fechamento da higiene

1. Quality Gate e Production Gate do candidato Marco 36 verdes;
2. rota de readiness e teste aprovados;
3. branches ambíguas comparadas individualmente;
4. PR do Marco 36 mesclado;
5. somente então remover refs históricas classificadas como seguras;
6. revalidar `main` e Production Smoke após qualquer promoção de código para produção.
