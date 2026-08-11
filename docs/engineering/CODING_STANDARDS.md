# GlossFlow — Padrões de Código

Este documento define o padrão de engenharia do GlossFlow. O objetivo é manter o produto legível, seguro e fácil de evoluir sem transformar comentários ou abstrações em ruído.

## 1. Princípios

1. **Uma responsabilidade por módulo.** Rotas coordenam HTTP; serviços concentram regra de negócio; acesso a dados permanece encapsulado em serviços/rotas apropriadas; componentes React cuidam de apresentação e interação.
2. **Regra de negócio não deve depender da interface.** Agenda, estoque, WhatsApp, CRM e financeiro devem validar as mesmas regras no backend, independentemente do canal que chamou a API.
3. **Multi-tenant sempre explícito.** Toda consulta privada deve usar o `salonId` vindo da sessão autenticada. Nunca aceitar `salonId` arbitrário do cliente em rotas administrativas.
4. **Falha de integração externa não desfaz transação de negócio já persistida.** Ex.: falha do WhatsApp não cancela um agendamento confirmado.
5. **Sem segredos no Git.** Tokens, senhas, chaves e URLs sensíveis ficam em variáveis de ambiente.

## 2. Comentários

O projeto deve ser comentado, mas comentários precisam explicar **por que** algo existe, contratos, riscos e decisões não óbvias. Não comentar instruções triviais linha a linha.

Use comentários para:
- contrato de um módulo ou função exportada;
- regras de segurança e multi-tenant;
- comportamento de fallback;
- limitações de providers externos;
- decisões que parecem estranhas sem contexto;
- efeitos colaterais importantes.

Evite comentários como `// incrementa contador` antes de `count += 1`.

## 3. Backend

- TypeScript `strict` permanece habilitado.
- `zod` valida entrada HTTP.
- `FastifyReply` define códigos HTTP explícitos para erros esperados.
- Funções de regra de negócio devem ser pequenas e testáveis.
- Não usar `any` sem necessidade documentada.
- Prisma deve receber filtros por tenant em operações privadas.
- Integrações externas devem retornar resultado estruturado (`ok`, provider, código/erro) em vez de lançar erro para fluxo esperado.
- Logs não devem conter senha, token, Auth Token, JWT completo ou payload sensível.

### Convenções

- Rotas: `*.routes.ts`
- Serviços: `*.service.ts`
- Middlewares: arquivos em `src/middlewares`
- Configuração: arquivos em `src/config`
- Funções e variáveis: `camelCase`
- Tipos: `PascalCase`
- Constantes realmente globais: `UPPER_SNAKE_CASE`

## 4. Frontend

- `App.jsx` é o orquestrador; lógica de autenticação, navegação e carregamento deve ficar em módulos próprios.
- Componentes grandes devem ser divididos por domínio.
- Chamadas HTTP passam por `services/api.js`.
- Regras de permissão ficam centralizadas, não repetidas em JSX.
- Estado derivado usa `useMemo` somente quando há ganho real de legibilidade/performance.
- Evitar `setState` em sequências longas quando um helper pode representar o mesmo conceito.
- A interface nunca deve afirmar que uma integração foi concluída antes de o backend possuir evidência suficiente.

## 5. Tratamento de erros

- Erro esperado de usuário: mensagem objetiva e código 4xx.
- Erro inesperado: log estruturado, resposta genérica em produção e captura de observabilidade.
- `catch` não deve esconder erro relevante sem log ou fallback explícito.
- Uma falha em recurso opcional não deve encerrar toda a sessão administrativa.

## 6. Commits

Preferir Conventional Commits:

- `feat:` nova funcionalidade
- `fix:` correção
- `refactor:` mudança estrutural sem alterar comportamento esperado
- `chore:` manutenção/infra
- `docs:` documentação
- `test:` testes

Cada commit deve ser pequeno o suficiente para ser revertido com segurança.

## 7. Definição de pronto

Antes de considerar uma alteração pronta:

```bash
cd backend
npm run prisma:generate
npm run lint
npm test
npm run build

cd ../frontend
npm run build
```

Além dos gates, validar manualmente o fluxo de negócio afetado quando houver integração externa ou comportamento visual.
