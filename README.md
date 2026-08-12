# GlossFlow Smart

SaaS multi-tenant white-label para salões de beleza, barbearias e clínicas de estética. O GlossFlow centraliza vitrine pública, Agenda, CRM, Estoque, financeiro, fidelidade, automações, WhatsApp e apoio operacional com IA.

## Estado atual

O projeto está em **piloto comercial com ambiente de produção ativo**.

Os **Marcos 1–20 estão concluídos e validados em produção**. O Marco 20 fechou o assistente IA/WhatsApp com base factual por tenant, confirmação server-side de mutações de Agenda, handoff com contexto, política de janela/template, follow-up seguro por provider e métricas operacionais.

Validação do Marco 20:

- merge em `main`: `238fdd4c2401424f12af26e5feb660a6f1cb1e1c`;
- backend: **68/68 testes**;
- frontend: **54/54 testes**;
- Quality Gate pós-merge: **success**;
- Production Gate pós-merge: **success**;
- checks Vercel: **success**;
- Production Smoke Validation: **success**.

Resultados acumulados:

- higienização e modularização estrutural concluídas;
- RBAC e multi-tenant homologados;
- Agenda comercial operacional;
- Estoque operacional com reposição e conciliação;
- CRM de retenção com consentimento e reativação;
- agente WhatsApp com base factual do tenant, confirmação server-side de mutações, handoff com contexto e política de envio por janela/template;
- gates, testes automatizados e smoke pós-deploy permanentes.

## Stack

### Frontend

- React 18
- Vite 8.2.1
- ESLint 9
- Vitest 4.1.10
- Testing Library
- CSS próprio / Design System por domínio
- PWA
- Vercel

### Backend

- Node.js `>=20.19 <23`
- Fastify 5.11.3
- TypeScript `strict`
- Zod
- JWT / RBAC
- Prisma 5.22
- Render

### Dados e integrações

- MongoDB Atlas
- Prisma ORM
- Groq como provider principal de IA
- OpenAI como fallback opcional
- Twilio / Meta / provider HTTP para WhatsApp
- Sentry opcional

## Arquitetura resumida

```text
Cliente WhatsApp
      |
      v
Webhook / tenant / módulos
      |
      +--> histórico + handoff
      |
      +--> Assistente IA
             |
             +--> Base factual do tenant
             +--> Ferramentas de consulta
             +--> Proposta de mutação
                       |
                       v
              Ação pendente no servidor
                       |
                 nova mensagem
                       |
           CONFIRMAR / CANCELAR AÇÃO
                       |
                       v
            revalidação + execução
```

```text
Follow-up CRM
      |
      +--> opt-out / tenant / módulo
      +--> conteúdo interno
      +--> janela de atendimento
             |
             +--> aberta  -> texto livre
             |
             +--> fechada -> template oficial obrigatório
      |
      +--> provider
             |
             +--> sucesso -> registra outbound/follow-up
             +--> falha   -> erro real, sem sucesso falso
```

## Funcionalidades principais

- vitrine pública white-label;
- agendamento online;
- Agenda Enterprise e central comercial;
- Smart Fit, lista de espera e reaproveitamento de vagas;
- confirmação, cancelamento, lembretes e rastreamento WhatsApp;
- CRM com segmentação por aniversário, inatividade e frequência;
- histórico de cliente e preferência de marketing;
- follow-up manual e por provider;
- Estoque operacional com entrada, saída, ajuste físico, histórico e reposição;
- financeiro, comissões e fidelidade;
- Super Admin separado do tenant;
- módulos/entitlements por salão;
- Site & Marca white-label;
- agente IA com Groq/fallback;
- PWA, auditoria, segurança e observabilidade.

## Marco 20 — Assistente IA e WhatsApp em produção

O Marco 20 fecha os principais riscos de automação do canal.

### Base factual por salão

O prompt é montado com fatos cadastrados no tenant: nome, descrição, horário, endereço, telefone, Instagram e catálogo ativo. Disponibilidade e profissionais são obtidos por ferramentas. Informação ausente não deve ser inventada.

### Mutações com confirmação server-side

Criar, cancelar e reagendar não são executados diretamente por function calling. A ferramenta exposta ao modelo cria uma **proposta pendente**. Somente uma mensagem posterior reconhecida pelo servidor como confirmação explícita pode executar a mutação.

Ações pendentes:

- são auditadas;
- possuem TTL configurável;
- aceitam cancelamento explícito;
- permanecem pendentes em mensagens ambíguas;
- são revalidadas contra a Agenda antes da execução.

### Handoff com contexto

O handoff humano registra motivo e contexto recente da conversa quando disponível. Uma falha ao recuperar contexto não impede o encaminhamento.

### Política de WhatsApp

Mensagens iniciadas pelo salão são controladas no servidor:

- janela de atendimento aberta: texto livre;
- janela fechada: exige identificador de template oficial configurado;
- falha do provider: gera evento de falha e não persiste mensagem como enviada;
- follow-up do CRM só entra na métrica depois de sucesso confirmado pela API do provider.

### Métricas

O read model `/admin/whatsapp/metrics` acompanha:

- contatos e mensagens;
- falhas do provider;
- handoffs;
- ações propostas, confirmadas, canceladas, expiradas e com falha;
- taxa operacional de resolução automática;
- taxa de sucesso do provider.

A tela **WhatsApp · Homologação** mostra esses indicadores e continua sem enviar mensagem real ao provider.

## Testes e qualidade

### Backend

**68/68 testes automatizados** cobrindo autenticação, RBAC, Agenda, Estoque, CRM, agente IA, confirmação posterior, janela de atendimento, templates, falha de provider, handoff e métricas.

### Frontend

**54/54 testes automatizados** cobrindo Agenda, Estoque, CRM de retenção e envio de follow-up pelo provider somente após confirmação do operador.

### Gates

```bash
cd backend
npm ci
npm run prisma:generate
npm run lint
npm test
npm run build
```

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
```

Workflows permanentes:

- `GlossFlow Quality Gate`;
- `Production Gate`;
- `Production Smoke Validation`.

## Configuração de WhatsApp do Marco 20

Consulte `backend/.env.example`. Variáveis adicionais incluem:

```text
WHATSAPP_ACTION_CONFIRMATION_TTL_MINUTES
WHATSAPP_TEMPLATE_RETENTION_BIRTHDAY
WHATSAPP_TEMPLATE_RETENTION_INACTIVE
WHATSAPP_TEMPLATE_RETENTION_FREQUENT
WHATSAPP_TEMPLATE_RETENTION_FOLLOWUP
```

Nunca versionar credenciais reais e nunca desativar `WHATSAPP_DRY_RUN` apenas porque o playground local funciona.

## Documentação

- [`ROADMAP.md`](ROADMAP.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md`](docs/usuario/09_HOMOLOGACAO_POR_PAPEL.md)
- [`docs/usuario/10_AGENDA_COMERCIAL.md`](docs/usuario/10_AGENDA_COMERCIAL.md)
- [`docs/usuario/11_ESTOQUE_OPERACIONAL.md`](docs/usuario/11_ESTOQUE_OPERACIONAL.md)
- [`docs/usuario/12_CRM_RETENCAO.md`](docs/usuario/12_CRM_RETENCAO.md)
- [`docs/usuario/13_IA_WHATSAPP_PRODUCAO.md`](docs/usuario/13_IA_WHATSAPP_PRODUCAO.md)

## Próximo marco oficial

**Marco 21 — Super Admin, planos e ciclo de vida SaaS**.

A sequência canônica está em [`ROADMAP.md`](ROADMAP.md).
