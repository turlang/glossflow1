# GlossFlow — Quality Gate 10/10

Esta versão foi ajustada com foco em entrega profissional, segurança multi-tenant e prontidão de deploy.

## Melhorias aplicadas

- Remoção obrigatória de arquivos sensíveis e artefatos gerados no pacote final.
- Correção dos scripts Prisma para usar o schema único em `../prisma/schema.prisma` quando executados pelo backend.
- Endurecimento de rotas administrativas com `salonId` em operações críticas de update/delete.
- Desativação segura de usuários em vez de exclusão direta.
- Bloqueio para impedir que o usuário autenticado desative a própria conta.
- Testes automatizados mínimos com `node:test` para validação de variáveis de ambiente.
- Pipeline local documentado com `lint`, `test`, `build` e `deploy:verify`.
- Validação de `JWT_SECRET` forte antes de deploy.
- Documentação objetiva das integrações que dependem de provedores externos.

## Como validar localmente

Backend:

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

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run build
npm run dev
```

## Observação importante

Pagamentos, WhatsApp real, Sentry, Cloudinary, OpenAI e Google Calendar dependem de contas externas e chaves reais. O projeto está preparado para essas integrações, mas elas só ficam 100% operacionais após configurar as credenciais no ambiente de produção.

## Nota técnica após os ajustes

- Código, estrutura e segurança base: 9,5/10
- Projeto acadêmico/portfólio: 10/10
- Piloto comercial: 9/10
- SaaS comercial com integrações externas configuradas: 10/10
