# GlossFlow — Relatório de Higienização

Data-base: 2026-08-10/11.

## Objetivo

Reduzir dívida técnica sem alterar os fluxos já validados de Agenda e WhatsApp. A higienização prioriza segurança, legibilidade, separação de responsabilidades e remoção de artefatos perigosos/obsoletos.

## Achados principais

### Críticos

- `setup.js` era um restaurador legado em Base64 capaz de sobrescrever `backend/package.json`, `backend/src/server.ts`, `frontend/package.json`, `frontend/src/main.jsx` e o schema Prisma com versões antigas. Não pertence ao produto atual.
- Existia uma segunda árvore `prisma/` na raiz, diferente do schema canônico em `backend/prisma/`. Os scripts atuais do backend e o deploy usam `backend/prisma/`.
- Havia duas definições de Render: `render.yaml` e `infra/render.blueprint.yaml`, sendo a segunda antiga e divergente da infraestrutura atual.
- A raiz continha uma cópia de `usuario/` já existente em `docs/usuario/`.
- O README ainda mencionava integrações e credenciais de demonstração desatualizadas.

### Estruturais

- `frontend/src/App.jsx` acumulava navegação, parsing de JWT, carregamento de dados, autorização e composição visual.
- `frontend/src/components/admin/AdminDashboard.jsx` concentra muitos domínios administrativos no mesmo arquivo e deve ser quebrado progressivamente por módulo.
- O script `lint` do frontend não executa análise estática real; atualmente funciona como build de desenvolvimento. Isso fica registrado como dívida de qualidade até a adoção de ESLint/formatter no pipeline.
- O backend usa TypeScript `strict`, mas ainda existem pontos com `any` herdado em rotas antigas.

## Regras adotadas nesta higienização

1. Não remover funcionalidade ativa só para diminuir arquivos.
2. Não mover regra de negócio para o frontend.
3. Não adicionar comentários redundantes linha a linha.
4. Documentar contratos, segurança, integrações e decisões não óbvias.
5. Fazer refactors pequenos com Quality Gate entre marcos relevantes.
6. Manter `backend/prisma/` como única fonte canônica do schema.
7. Manter `render.yaml` como único blueprint do Render.
8. Manter documentação operacional em `docs/` e engenharia em `docs/engineering/`.

## Próximos alvos estruturais

- quebrar `AdminDashboard.jsx` por domínio (`agenda`, `estoque`, `crm`, `financeiro`, `automacoes`);
- separar estilos globais por camada/design system sem duplicar seletores;
- ampliar testes de serviços críticos;
- substituir o pseudo-lint do frontend por ESLint real em alteração controlada do lockfile;
- reduzir `any` remanescente no backend.
