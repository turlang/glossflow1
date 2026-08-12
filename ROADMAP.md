# GlossFlow Smart — Roadmap Oficial

Data-base: 2026-08-12.

Este documento é a fonte canônica para a evolução do GlossFlow.

## Estado do produto

O GlossFlow está em **piloto comercial com produção ativa**.

Os **Marcos 1–22 estão concluídos e validados em produção**. O **Marco 23 — Segurança e LGPD comercial** está **CONCLUÍDO FUNCIONALMENTE NO PR #17**, aguardando merge, deploy convergido e `Production Smoke Validation` para receber a marca oficial de produção.

Estado automatizado do head funcional do Marco 23:

- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- `npm audit` backend/frontend: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- builds backend/frontend: **success**;
- Production Gate: **success**;
- sessões revogáveis e refresh token de uso único;
- direitos do titular com exportação e eliminação/anônimização;
- retenção explícita e controlada;
- rate limit por superfície e tenant;
- backup lógico assinado e restore protegido por kill switch;
- auditoria correlacionada por request/session sem conteúdo sensível;
- runbooks de Segurança, LGPD, incidente e recuperação.

---

# Ciclo concluído em produção — Marcos 1–22

## Marco 1 — Higienização estrutural inicial — CONCLUÍDO
Artefatos legados removidos, schema Prisma canônico, documentação e repository hygiene.

## Marco 2 — Decomposição do Admin — CONCLUÍDO
Dashboard dividido por domínio, lint e base técnica atualizados.

## Marco 3 — Agenda Enterprise e regras de data — CONCLUÍDO
Calendário isolado, datas locais e capacidade mensal corrigidas.

## Marco 4 — Componentização da Agenda — CONCLUÍDO
Toolbar, cards e visões separados.

## Marco 5 — Reagendamento acessível — CONCLUÍDO
Formulário explícito, persistência unificada e feedback de conflito/sucesso.

## Marco 6 — Tipagem e serviço de reagendamento backend — CONCLUÍDO
Serviço dedicado, payload estrito e sobreposição correta.

## Marco 7 — Fastify testável — CONCLUÍDO
`buildApp()` testável e bootstrap isolado.

## Marco 8 — Rotas de Agenda modularizadas — CONCLUÍDO
Público, gestão, lista de espera, admin, contratos e acesso separados.

## Marco 9 — Agente WhatsApp modularizado — CONCLUÍDO
Contratos, repositório, ferramentas, orquestrador e fallback seguro.

## Marco 10 — CSS administrativo + contratos do agente — CONCLUÍDO
Estilos extraídos e contratos protegidos por testes.

## Marco 11 — Webhook Twilio modularizado — CONCLUÍDO
Segurança, tenant, status e inbound separados.

## Marco 12 — Cobertura de regressão ampliada — CONCLUÍDO
Estoque, CRM, Twilio e agente protegidos.

## Marco 13 — Domínio comercial modularizado — CONCLUÍDO
CRM, financeiro, comissões, fidelidade, assinatura, templates e IA separados.

## Marco 14 — Documentação de usuário — CONCLUÍDO
Manuais, FAQ, curso, implantação e boas práticas.

## Marco 15 — Hygiene final — CONCLUÍDO
Gates permanentes e limpeza final da base.

## Marco 16 — Homologação funcional por papel — CONCLUÍDO
RBAC homologado para `SUPER_ADMIN`, `ADMIN`, `RECEPTION` e `PROFESSIONAL`.

## Marco 17 — Agenda comercial e jornada do cliente — CONCLUÍDO
Central de operação diária, Smart Fit, lista de espera, confirmações e comunicação.

## Marco 18 — Estoque operacional e reposição — CONCLUÍDO
Movimentação, conciliação, ruptura, histórico, capital e plano de reposição.

## Marco 19 — CRM, retenção e automações — CONCLUÍDO
Segmentação, histórico, consentimento, opt-out e follow-up.

## Marco 20 — Assistente IA e WhatsApp em produção — CONCLUÍDO
Base factual, confirmação server-side, handoff, política de janela/template e métricas.

## Marco 21 — Super Admin, planos e ciclo de vida SaaS — CONCLUÍDO
Provisionamento canônico, estados `TRIAL/ACTIVE/PAST_DUE/CANCELED`, módulos, billing preparado, white-label e auditoria. Merge de produção `8b8aa0f2a07061b84aaa72db96c1511dae62a369`; Quality Gate, Production Gate, Vercel e smoke verdes.

## Marco 22 — Observabilidade, performance e confiabilidade — CONCLUÍDO

Entregue:

- `X-Request-Id` e Build ID rastreável;
- `/health` para liveness;
- `/ready` com ping real do MongoDB;
- p50/p95/p99, erros, slow requests, memória e métricas por dependência;
- exportação Prometheus;
- painel global de observabilidade para `SUPER_ADMIN`;
- instrumentação de IA, MongoDB e webhooks;
- índices MongoDB idempotentes;
- paginação CRM;
- `React.lazy`/`Suspense` para backoffice;
- bundle principal reduzido de ~405,82 kB para ~192,67 kB;
- budget permanente de bundle.

Validação final de produção:

- backend: **83/83 testes**;
- frontend: **58/58 testes**;
- merge do Marco 22: `9e28744ca157f0677c85dd07aaee0dbd51a2fac4`;
- correções de convergência/rastreabilidade: PRs #11 e #12;
- build efetivamente servido e validado: `f61ba1268bb135d1e5cab4f85bf28acfb011d196`;
- `/health`: Build ID no header e body;
- `/ready`: mesmo Build ID e `database.ok=true`;
- Quality Gate / Production Gate: **success**;
- Production Smoke Validation após atualização do Render: **success**.

O incidente de deploy stale foi registrado na Issue #13 e encerrado somente depois do Render servir o build correto.

---

# Marco 23 — Segurança e LGPD comercial — CONCLUÍDO FUNCIONALMENTE NO PR #17

Objetivo funcional atingido: responder a revogação de acesso, direitos do titular, retenção, incidente e recuperação sem depender de edição improvisada no banco e sem criar operações destrutivas silenciosas.

## Sessões e refresh tokens

- access token vinculado a `UserSession` via `sessionId`;
- sessão revogada ou expirada invalida imediatamente o token no servidor;
- usuário desativado deixa de autenticar imediatamente;
- `role`, `email` e `salonId` são revalidados contra o usuário persistido;
- token legado sem `sessionId` é rejeitado em produção;
- refresh token é rotacionado a cada uso;
- replay do refresh anterior é rejeitado, inclusive por update condicional concorrente;
- ADMIN pode encerrar sessão específica ou todas as demais sessões do tenant.

## Revisão de RBAC

Mantido o contrato canônico:

- `SUPER_ADMIN`: plataforma e tenants;
- `ADMIN`: operação do próprio salão + Segurança/LGPD;
- `RECEPTION`: operação comercial sem superfície crítica de Segurança;
- `PROFESSIONAL`: escopo restrito, com Agenda somente leitura.

Rotas críticas continuam isoladas por `salonId` do contexto autenticado.

## Auditoria sensível

Mutações administrativas registram:

- ação, recurso e path;
- IP/user-agent;
- `requestId`;
- `sessionId`;
- status HTTP e outcome;
- nomes de campos não sensíveis do body.

Valores não são persistidos; senha, token, segredo, API key, refresh token e snapshot são excluídos até da lista de chaves.

## Direitos do titular — LGPD

### Exportação

`GET /admin/security/lgpd/export/:clientId`

Pacote tenant-safe com perfil, atendimentos, lista de espera, fidelidade, consentimentos e eventos operacionais relacionados. Resposta com `Cache-Control: no-store`.

### Eliminação/anônimização

`POST /admin/security/lgpd/erase/:clientId`

Exige confirmação `EXCLUIR DADOS` e motivo documentado.

A transação:

- redige eventos relacionados;
- anonimiza PII de atendimentos históricos;
- remove lista de espera;
- remove fidelidade;
- remove consentimentos;
- remove perfil;
- cria auditoria anônima `LGPD_SUBJECT_ERASED`.

## Retenção de dados

Política explícita e manual/controlada:

```text
SESSION_RECORD_RETENTION_DAYS=30
WHATSAPP_CONTENT_RETENTION_DAYS=180
AUDIT_LOG_RETENTION_DAYS=730
BACKUP_METADATA_RETENTION_DAYS=180
```

- preview antes de qualquer limpeza;
- execução exige `APLICAR RETENCAO`;
- conteúdo antigo do WhatsApp é redigido;
- sessões e metadados vencidos são removidos conforme janela;
- execução gera `DATA_RETENTION_APPLIED`.

Nenhum cron destrutivo é habilitado silenciosamente neste marco.

## Rate limits

Duas camadas:

- IP + superfície para login, refresh, escrita pública, webhooks e tráfego geral;
- tenant autenticado, com limite mais estrito para mutações de Segurança.

HTTP `429` devolve `Retry-After`, código `RATE_LIMITED` e superfície atingida.

## Backup e restore

Snapshot lógico `glossflow-tenant-backup/v1` assinado por HMAC SHA-256.

Inclui domínio operacional do tenant, mas exclui usuários, senhas, sessões, lifecycle SaaS, domínio e audit logs.

Restore:

- verifica schema, tenant e assinatura;
- fica bloqueado com `BACKUP_RESTORE_ENABLED=false` durante operação normal;
- exige segredo explícito em produção quando habilitado;
- exige confirmação `RESTAURAR BACKUP`;
- usa estratégia `REPLACE` apenas para o domínio operacional incluído;
- gera `TENANT_BACKUP_RESTORED`;
- possui runbook de recuperação.

## Secrets e configuração

O validador de ambiente bloqueia:

- JWT ausente, curto ou placeholder;
- segredo de backup curto;
- URI de banco incompatível com MongoDB em produção;
- origem do frontend ausente em produção;
- restore habilitado sem segredo dedicado de backup.

`render.yaml` mantém o restore desligado por padrão e documenta rate limit/retenção.

## Interface e documentação

Tela Segurança do ADMIN ganhou:

- painel de controles;
- sessões e ação de incidente;
- exportação LGPD;
- eliminação com dupla confirmação/motivo;
- consentimentos;
- prévia/execução de retenção;
- criação/download do backup assinado.

Restore destrutivo não é exposto como botão de rotina.

Documentação:

- `docs/engineering/SECURITY_LGPD.md`;
- `docs/usuario/15_SEGURANCA_LGPD.md`.

## Cobertura funcional

- backend: **100/100 testes**;
- frontend: **61/61 testes**;
- `npm audit`: **0 vulnerabilidades**;
- TypeScript/ESLint: **success**;
- builds: **success**;
- Production Gate do head funcional: **success**.

Nenhum cliente real foi apagado, nenhum restore real foi executado e nenhuma mensagem WhatsApp real foi enviada durante os testes do Marco 23.

A marca **validado em produção** depende do merge do PR #17, convergência do Render/Vercel e `Production Smoke Validation` com Build ID correto e MongoDB pronto.

---

# Próximo ciclo após a validação do Marco 23

## Marco 24 — Release comercial estável — PRÓXIMO APÓS SMOKE

Objetivo: fechar o produto para venda e implantação repetível.

Critérios mínimos:

- Marcos 16–23 encerrados em produção;
- checklist de produção revisado;
- homologação desktop/mobile final;
- Agenda, Estoque, CRM e WhatsApp revalidados;
- Super Admin e provisionamento revalidados;
- Segurança/LGPD e recuperação revalidadas;
- documentação de implantação e suporte atualizada;
- Quality Gate verde;
- Production Gate verde;
- Vercel/Render no build esperado;
- Production Smoke Validation verde;
- nenhuma regressão P0/P1 aberta.

Resultado esperado:

**GlossFlow apto a ser vendido e operado como SaaS multi-tenant com implantação repetível.**

---

# Prioridade de execução

```text
Marco 23 — fechamento de produção
   ↓
Marco 24 — Release comercial estável
```

## Regra de avanço

Um marco somente é considerado concluído em produção quando:

1. código e documentação estão atualizados;
2. testes relevantes estão verdes;
3. `GlossFlow Quality Gate` está verde;
4. `Production Gate` está verde quando houver impacto de produção;
5. deploy realmente serve o Build ID esperado;
6. smoke/homologação específica foi executada;
7. nenhuma regressão crítica conhecida permanece aberta.

## Referências

- [`README.md`](README.md)
- [`HYGIENE_REPORT.md`](HYGIENE_REPORT.md)
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
- [`QUALITY_GATE.md`](QUALITY_GATE.md)
- [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md)
- [`docs/engineering/OBSERVABILITY.md`](docs/engineering/OBSERVABILITY.md)
- [`docs/engineering/SECURITY_LGPD.md`](docs/engineering/SECURITY_LGPD.md)
- [`docs/usuario/14_SUPER_ADMIN_SAAS.md`](docs/usuario/14_SUPER_ADMIN_SAAS.md)
- [`docs/usuario/15_SEGURANCA_LGPD.md`](docs/usuario/15_SEGURANCA_LGPD.md)
