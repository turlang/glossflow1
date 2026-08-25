# GlossFlow Smart — Inventário de Componentes e Direitos de Terceiros

**Objetivo:** separar claramente o código/material próprio do que permanece sujeito a licenças e direitos de terceiros antes do protocolo no INPI.

Revisar este documento contra a baseline `58ce16ed8321d913f155f7f5bf29786ca50a4af1` antes do pedido.

## 1. Código próprio declarado do projeto

Categorias a validar como desenvolvimento próprio:

- arquitetura SaaS multi-tenant;
- regras de negócio de Agenda, CRM, Estoque, Financeiro, Fidelidade e módulos operacionais;
- fluxos de checkout, portal, recursos, equipe, clínico e homologação;
- UI/UX, CSS/design system próprios;
- automações, integrações, prompts e políticas próprias;
- testes, documentação e observabilidade desenvolvidos para o GlossFlow.

## 2. Dependências de software de terceiros

Revisar manifests e lockfiles para versões/licenças exatas. Componentes identificados incluem, entre outros:

- React / React DOM;
- Vite;
- Fastify e `@fastify/cors`;
- Prisma / `@prisma/client`;
- Zod;
- bcryptjs;
- jsonwebtoken;
- dotenv;
- TypeScript, ESLint, Vitest, Testing Library e ferramentas de desenvolvimento.

### Ação obrigatória

- [ ] preservar manifests e lockfiles da baseline;
- [ ] gerar relatório de licenças das dependências;
- [ ] verificar licenças incompatíveis com o uso comercial pretendido;
- [ ] não incluir `node_modules` no pacote técnico.

## 3. APIs, serviços e provedores externos

Não são propriedade do GlossFlow:

- MongoDB Atlas;
- Groq/OpenAI e modelos associados;
- Twilio, Meta e demais providers de WhatsApp;
- Mercado Pago e Stripe;
- Vercel, Render e serviços de infraestrutura;
- Prometheus/Sentry ou outros serviços de observabilidade, quando utilizados.

## 4. Marcas, dados e conteúdo de clientes

- [ ] garantir que o pacote não contenha dados reais de salões/clientes;
- [ ] remover dumps, backups, uploads ou segredos;
- [ ] não reivindicar marcas/logos de estabelecimentos terceiros;
- [ ] classificar templates/assets comerciais de terceiros por licença.

## 5. Assets, fontes e mídia

Para cada imagem, fonte, ícone, vídeo ou material gráfico, classificar como:

- [ ] criação própria;
- [ ] licença comercial válida;
- [ ] open source/open content compatível;
- [ ] domínio público;
- [ ] conteúdo de cliente;
- [ ] remover/substituir antes do protocolo.

## 6. Colaborações e cessões

- [ ] identificar contribuições autorais de terceiros na baseline;
- [ ] verificar contratos/cessões aplicáveis;
- [ ] obter documentação de cessão/licença quando necessário;
- [ ] guardar instrumentos fora do repositório público.

## 7. Resultado esperado antes do protocolo

O pacote técnico deve distinguir claramente:

**código próprio do GlossFlow** + **dependências legitimamente utilizadas** + **conteúdo/serviços externos não reivindicados**.

Este inventário não substitui a leitura das licenças de cada dependência nem parecer jurídico.