# Marco 36 — Bootstrap seguro de tenant QA

Objetivo: criar ou reusar um tenant **isolado de QA** para homologar os oito módulos `VALIDATION_REQUIRED` sem utilizar clientes reais e sem executar o seed destrutivo do projeto.

## Princípios de segurança

O comando `npm run qa:bootstrap`:

- não executa `seed`;
- não executa `reset`;
- não chama `deleteMany`;
- reutiliza `provisionTenant`, `updateTenantLifecycle` e `updateTenantOwner` do ciclo SaaS canônico;
- exige confirmação explícita de ambiente QA;
- valida que `DATABASE_URL` aponta exatamente para `QA_DATABASE_NAME`;
- exige que o nome do banco contenha `qa`, `test` ou `staging`;
- exige slug contendo `qa`;
- nunca imprime a senha do administrador;
- é idempotente por slug: se o tenant QA já existir, ele é reconfigurado para os 19 módulos e o acesso ADMIN é rotacionado.

> O arquivo `backend/prisma/seed.js` é destrutivo e não deve ser usado para esta homologação.

## Preparação

No diretório `backend`, copie `.env.qa.example` para `.env.qa` e preencha somente valores do ambiente isolado.

Exemplo em PowerShell:

```powershell
cd backend
Copy-Item .env.qa.example .env.qa
```

Campos obrigatórios:

```text
QA_TENANT_BOOTSTRAP_ENABLED=true
QA_ENVIRONMENT=qa
QA_CONFIRMATION=CREATE_ISOLATED_QA_TENANT
QA_DATABASE_NAME=<nome-do-banco-qa>
DATABASE_URL=<mongodb-do-banco-qa>
QA_ADMIN_EMAIL=<email-qa-autorizado>
QA_ADMIN_PASSWORD=<senha-com-12-ou-mais-caracteres>
```

O `QA_DATABASE_NAME` precisa ser exatamente o nome encontrado ao final da `DATABASE_URL` e precisa identificar um banco `qa`, `test` ou `staging`.

Se o runtime QA usar `NODE_ENV=production` somente para otimização, é necessário adicionar conscientemente:

```text
QA_ALLOW_NODE_ENV_PRODUCTION=true
```

Isso não remove o guard do banco; `DATABASE_URL` ainda precisa apontar para o banco QA declarado.

## Execução

```powershell
cd backend
npm ci
npm run prisma:generate
npm run qa:bootstrap
```

Saída esperada, sem senha:

```json
{
  "ok": true,
  "reused": false,
  "salonId": "...",
  "slug": "glossflow-qa",
  "adminEmail": "...",
  "modules": 19,
  "database": "glossflow-qa"
}
```

Uma segunda execução deve retornar `reused: true` e não criar um segundo tenant com o mesmo slug.

## O que o bootstrap prepara

- tenant com slug QA;
- usuário `ADMIN` QA;
- assinatura `ACTIVE` em plano interno de QA;
- billing `MANUAL`, sem cobrança real;
- os 19 módulos habilitados;
- auditoria do ciclo SaaS preservada.

Ele **não** cria automaticamente vendas, prontuários, mensagens, compras ou clientes fictícios. Os dados de cada cenário devem ser criados durante a homologação manual seguindo `MARCO36_COMMERCIAL_HOMOLOGATION.md`.

## Ordem de homologação após o bootstrap

1. POS + Pacotes + Recursos, usando um atendimento QA controlado;
2. Compras, com fornecedor/produto QA e recebimento completo;
3. Equipe, com profissional QA, ponto e folha operacional;
4. Clínico, com cliente QA e consentimento explícito;
5. Portal do Cliente, verificando rotação/expiração/revogação;
6. WhatsApp por último, somente com sandbox/provider autorizado; Twilio Trial não promove o módulo para `READY`.

## Critério para promoção de maturidade

O bootstrap sozinho não muda `module-readiness.service.ts`. Um módulo só pode migrar de `VALIDATION_REQUIRED` para `READY` quando a evidência automática e a evidência humana/provider do protocolo estiverem concluídas.
