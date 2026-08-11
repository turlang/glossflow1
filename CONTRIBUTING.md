# Contribuindo com o GlossFlow

O GlossFlow é um produto SaaS multi-tenant. Mudanças pequenas podem afetar vários salões, por isso a regra principal é preservar isolamento por tenant e validar o fluxo de negócio no backend.

## Antes de alterar código

Leia:

- `docs/engineering/ARCHITECTURE.md`
- `docs/engineering/CODING_STANDARDS.md`
- `PRODUCTION_CHECKLIST.md`

## Fluxo recomendado

1. Faça uma mudança coesa por vez.
2. Não versionar `.env`, tokens ou credenciais.
3. Mantenha regras de negócio fora de componentes de UI.
4. Adicione comentários apenas quando explicarem contrato, risco, segurança, fallback ou decisão não óbvia.
5. Rode os gates locais.

### Backend

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

## Pull requests / commits

Use mensagens no padrão Conventional Commits, por exemplo:

```text
feat: add inventory consumption rules
fix: keep reception session on restricted resources
refactor: split admin dashboard modules
docs: document Twilio callback flow
chore: remove obsolete bootstrap artifacts
```

## Segurança e multi-tenant

- Nunca confiar em `salonId` enviado diretamente pelo navegador para operações administrativas.
- Em rotas autenticadas, derive o tenant da sessão/JWT.
- Não registrar segredos em logs.
- Não retornar hashes de senha, tokens ou credenciais para o frontend.
- Não tratar resposta `2xx` de provider externo como prova de entrega quando existir callback/status posterior.

## Integrações externas

WhatsApp, IA e pagamentos devem degradar de forma controlada. Se a operação principal já foi persistida, uma falha do provider deve ser registrada e comunicada, não causar rollback artificial do negócio.
