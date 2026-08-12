# Marco 23 — Checklist final de validação

Data-base: 2026-08-12.

Este arquivo congela o escopo usado para promover o Marco 23. Depois deste commit, nenhuma alteração funcional deve entrar no PR #17 sem reiniciar a validação completa.

## Contratos que devem permanecer verdes

- sessão revogada invalida access token vinculado;
- refresh token é rotacionado e não pode ser reutilizado;
- papel persistido prevalece sobre privilégio antigo no JWT;
- produção rejeita access token legado sem `sessionId`;
- RBAC continua isolando `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`;
- exportação LGPD não atravessa tenant;
- eliminação LGPD anonimiza histórico e remove dados pessoais operacionais;
- retenção exige prévia e confirmação explícita;
- rate limit diferencia login, refresh, webhook, escrita pública e tenant;
- auditoria não grava valores sensíveis;
- backup assinado rejeita adulteração e outro tenant;
- restore permanece bloqueado por padrão;
- restore habilitado em teste restaura apenas domínio operacional e audita a ação;
- `check-env` rejeita configuração insegura;
- frontend Segurança expõe exportação, eliminação, retenção, backup e resposta a incidente sem oferecer restore destrutivo como ação cotidiana.

## Evidência esperada no PR

- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- `npm audit --audit-level=high`: zero vulnerabilidades;
- TypeScript/ESLint: success;
- builds: success;
- Quality Gate: success;
- Production Gate: success;
- checks Vercel: success.

## Evidência obrigatória após merge

- Quality Gate do `main`: success;
- Production Gate do `main`: success;
- frontend Vercel convergido;
- `/health` servindo o Build ID esperado no body/header;
- `/ready` servindo o mesmo Build ID e `database.ok=true`;
- Production Smoke Validation: success.

## Regras de segurança da homologação

A validação automatizada usa somente mocks/fixtures para operações destrutivas. Não apagar cliente real, não executar restore real, não alterar lifecycle SaaS real e não enviar mensagem WhatsApp real para concluir este marco.
