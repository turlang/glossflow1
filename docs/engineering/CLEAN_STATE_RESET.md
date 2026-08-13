# GlossFlow — Reset controlado para estado limpo

## Objetivo

Remover dados usados em desenvolvimento/homologação e deixar a plataforma em um estado comercial vazio, preservando somente:

- o tenant técnico `glossflow-platform`;
- o usuário configurado em `SUPER_ADMIN_EMAIL` com papel `SUPER_ADMIN`;
- a senha já existente desse Super Admin (o reset não lê, mostra nem altera a senha);
- schema, índices, variáveis de ambiente, secrets e código da aplicação.

A rotina **não recria dados de demonstração**.

## O que é removido

A execução limpa integralmente:

- sessões;
- auditoria antiga;
- metadados de backup;
- consentimentos LGPD de dados de teste;
- fidelidade;
- comissões;
- financeiro;
- estoque e movimentações;
- lista de espera;
- agenda;
- clientes/CRM;
- templates WhatsApp;
- sugestões de IA;
- portfólio;
- profissionais;
- serviços;
- assinaturas de tenants;
- planos comerciais de teste;
- todos os usuários exceto o `SUPER_ADMIN` configurado;
- todos os salões/tenants exceto `glossflow-platform`.

O tenant técnico é normalizado para dados neutros de plataforma e fica sem módulos, branding ou domínio de cliente.

## Proteções obrigatórias

O script aborta se:

1. `SUPER_ADMIN_EMAIL` não estiver definido;
2. o e-mail não existir no banco;
3. o usuário não for `SUPER_ADMIN` ativo;
4. o Super Admin não pertencer a `glossflow-platform`;
5. `--execute` for usado sem a frase de confirmação correta;
6. em `NODE_ENV=production`, `ALLOW_PRODUCTION_DATA_RESET=true` não estiver presente.

Todas as sessões são apagadas. Depois da limpeza é obrigatório fazer login novamente.

## Passo 1 — Dry-run

No diretório `backend`:

```bash
npm run data:reset:clean
```

Esse comando **não remove nada**. Ele mostra somente as quantidades de registros que seriam apagados e identifica o Super Admin/tenant técnico que serão preservados.

Revise as contagens antes de continuar.

## Passo 2 — Execução fora de produção

```bash
RESET_CONFIRM=RESET_GLOSSFLOW_TEST_DATA npm run data:reset:clean -- --execute
```

## Passo 3 — Execução em produção

Somente quando os dados existentes forem de teste/homologação e a decisão de limpeza estiver confirmada:

```bash
RESET_CONFIRM=RESET_GLOSSFLOW_TEST_DATA \
ALLOW_PRODUCTION_DATA_RESET=true \
npm run data:reset:clean -- --execute
```

No PowerShell:

```powershell
$env:RESET_CONFIRM="RESET_GLOSSFLOW_TEST_DATA"
$env:ALLOW_PRODUCTION_DATA_RESET="true"
npm run data:reset:clean -- --execute
Remove-Item Env:RESET_CONFIRM
Remove-Item Env:ALLOW_PRODUCTION_DATA_RESET
```

Não grave `RESET_CONFIRM` nem `ALLOW_PRODUCTION_DATA_RESET=true` permanentemente no Render.

## Verificação automática pós-reset

O script só encerra com sucesso quando confirma:

- exatamente 1 usuário;
- esse usuário é o Super Admin protegido;
- exatamente 1 salão;
- esse salão é `glossflow-platform`;
- todas as coleções comerciais/operacionais listadas acima estão zeradas.

Caso uma dessas condições falhe, o comando retorna erro.

## Comportamento da aplicação sem tenant comercial

Depois do reset não existe mais o antigo salão de demonstração `glossflow`. As rotas públicas usam `glossflow-platform` somente como fallback técnico para manter:

- frontend inicializável;
- login do Super Admin acessível;
- `/health` e `/ready` inalterados;
- smoke de produção capaz de validar arrays vazios de serviços/profissionais/portfólio/agenda.

Esse fallback não cria um novo cliente e não deve ser tratado como tenant comercial.

## Como iniciar o primeiro cliente real

1. entrar como Super Admin;
2. cadastrar os planos comerciais reais desejados;
3. usar o provisionamento SaaS para criar o primeiro salão e seu ADMIN;
4. configurar módulos, marca, catálogo e integrações contratadas;
5. concluir o checklist de implantação do tenant.

## Proibições

- Não executar `npm run seed` depois do reset em produção; o seed recria dados demonstrativos.
- Não apagar manualmente coleções no MongoDB Atlas para obter o mesmo resultado.
- Não remover `glossflow-platform` nem o Super Admin diretamente no banco.
- Não usar esse reset em uma base que já contenha dados reais de clientes sem um procedimento específico de migração/backup e autorização adequada.
