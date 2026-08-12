# GlossFlow — Segurança, LGPD e Resposta a Incidentes

Data-base: 2026-08-12.

Este documento descreve os controles técnicos do Marco 23. Ele não substitui orientação jurídica, política de privacidade, contrato com clientes ou decisões do encarregado/DPO.

## 1. Modelo de acesso

### Sessões revogáveis

O login cria uma `UserSession` e o access token recebe `sessionId`.

Em produção, uma rota autenticada só aceita o token quando:

1. a assinatura JWT é válida;
2. o `sessionId` existe;
3. a sessão não foi revogada;
4. a sessão não expirou;
5. o usuário continua ativo;
6. o `salonId` da sessão continua compatível com o usuário.

`role`, `email` e `salonId` usados pela autorização são reidratados a partir do usuário persistido. Assim uma redução de privilégio não precisa aguardar o TTL do JWT antigo.

### Refresh token de uso único

Cada `/auth/refresh` troca o hash do refresh token da sessão. O token anterior deixa de ser válido. O `updateMany` condicional impede duas renovações concorrentes de reutilizarem o mesmo token.

### Revogação

- `POST /admin/security/sessions/:id/revoke`: encerra uma sessão específica;
- `POST /admin/security/sessions/revoke-all`: encerra as demais sessões do tenant e preserva a sessão atual por padrão.

Depois da revogação, o access token vinculado deixa de ser aceito pelo servidor.

## 2. RBAC e isolamento multi-tenant

A composição de rotas mantém quatro papéis principais:

- `SUPER_ADMIN`: plataforma, clientes SaaS, planos, lifecycle, Site & Marca, custos e observabilidade global;
- `ADMIN`: operação completa do próprio tenant e Segurança/LGPD;
- `RECEPTION`: operação comercial do salão sem controles críticos de Segurança;
- `PROFESSIONAL`: escopo operacional restrito, com Agenda somente leitura conforme contrato de homologação.

Toda operação de Segurança usa o `salonId` autenticado. IDs recebidos na URL nunca substituem o contexto do tenant.

## 3. Rate limit

O limiter local aplica duas camadas.

### Por IP e superfície

Defaults por minuto:

| Superfície | Variável | Default |
|---|---|---:|
| login | `AUTH_LOGIN_RATE_LIMIT_PER_MINUTE` | 12 |
| refresh | `AUTH_REFRESH_RATE_LIMIT_PER_MINUTE` | 60 |
| escrita pública | `PUBLIC_WRITE_RATE_LIMIT_PER_MINUTE` | 90 |
| webhooks | `WEBHOOK_RATE_LIMIT_PER_MINUTE` | 600 |
| tráfego geral | `RATE_LIMIT_PER_MINUTE` | 180 |

### Por tenant autenticado

| Superfície | Variável | Default |
|---|---|---:|
| tenant autenticado | `TENANT_RATE_LIMIT_PER_MINUTE` | 600 |
| escrita de Segurança | `TENANT_SECURITY_RATE_LIMIT_PER_MINUTE` | 30 |

Respostas excedentes retornam `429`, `Retry-After`, `code=RATE_LIMITED` e o nome da superfície.

O limiter permanece local ao processo. Em escala horizontal com múltiplas instâncias, migrar contadores para Redis/API Gateway antes de considerar os limites globalmente compartilhados.

## 4. Auditoria sensível

Mutações administrativas registram:

- ação/método;
- recurso e path sem query string;
- IP e user-agent;
- `requestId`;
- `sessionId`;
- status HTTP e outcome;
- somente os nomes de campos não sensíveis do body.

Não são persistidos valores do corpo. Chaves sensíveis como senha, token, segredo, API key, refresh token e snapshot de backup são removidas até da lista de campos.

Use `requestId + sessionId` para correlacionar auditoria, observabilidade e sessão em um incidente.

## 5. Direitos do titular — fluxo operacional

### Exportação

`GET /admin/security/lgpd/export/:clientId`

O pacote é isolado pelo tenant e reúne, quando vinculados ao titular:

- perfil do cliente;
- atendimentos;
- lista de espera;
- fidelidade;
- consentimentos;
- eventos de processamento operacional relacionados ao cliente/telefone/atendimento.

A resposta usa `Cache-Control: no-store`. O frontend baixa o JSON localmente. O arquivo exportado deve ser tratado como dado pessoal e armazenado/compartilhado apenas pelo canal definido pela operação do salão.

### Eliminação/anônimização

`POST /admin/security/lgpd/erase/:clientId`

Exige:

```json
{
  "confirmation": "EXCLUIR DADOS",
  "reason": "motivo operacional documentado"
}
```

A transação:

1. redige eventos relacionados ao titular;
2. anonimiza PII dos atendimentos históricos;
3. remove lista de espera;
4. remove lançamentos de fidelidade;
5. remove consentimentos;
6. remove o perfil do cliente;
7. cria auditoria anônima `LGPD_SUBJECT_ERASED`.

O histórico de atendimento pode permanecer sem PII para preservar coerência operacional/financeira. Não usar eliminação para corrigir cadastro ou resolver duplicidade de cliente.

## 6. Retenção de dados

A rotina é deliberadamente manual/controlada no Marco 23. Não existe cron destrutivo habilitado silenciosamente.

Defaults:

| Dado | Variável | Default |
|---|---|---:|
| sessão expirada/revogada | `SESSION_RECORD_RETENTION_DAYS` | 30 dias |
| conteúdo WhatsApp em auditoria | `WHATSAPP_CONTENT_RETENTION_DAYS` | 180 dias |
| audit log | `AUDIT_LOG_RETENTION_DAYS` | 730 dias |
| metadata de backup | `BACKUP_METADATA_RETENTION_DAYS` | 180 dias |

Fluxo:

1. `GET /admin/security/retention/preview`;
2. revisar os candidatos;
3. confirmar `APLICAR RETENCAO`;
4. `POST /admin/security/retention/run`.

Conteúdo antigo de WhatsApp é redigido antes de o audit log atingir sua janela final. A rotina registra `DATA_RETENTION_APPLIED` com contagens, sem copiar conteúdo pessoal.

## 7. Backup lógico assinado

`POST /admin/security/backups`

Gera envelope `glossflow-tenant-backup/v1` assinado com HMAC SHA-256. O arquivo contém domínio operacional do tenant:

- serviços;
- profissionais;
- portfólio;
- clientes;
- Agenda/lista de espera;
- estoque e movimentações;
- financeiro/comissões;
- fidelidade;
- templates WhatsApp;
- consentimentos LGPD.

Não inclui:

- usuários/senhas;
- sessões;
- contrato/assinatura SaaS;
- domínio/configuração gerenciada pela plataforma;
- audit logs;
- histórico de backups.

A assinatura usa `BACKUP_SIGNING_SECRET`. Se ele não estiver configurado, o backend pode usar `JWT_SECRET`; em produção recomenda-se segredo dedicado e estável para que snapshots antigos continuem verificáveis mesmo após rotação do JWT.

### Validação

`POST /admin/security/backups/validate`

Valida schema, tenant e assinatura antes de qualquer tentativa de restore.

## 8. Restore

Restore é uma operação destrutiva de recuperação, não uma função cotidiana.

Pré-condições:

1. incidente/necessidade de recuperação documentada;
2. snapshot do mesmo tenant;
3. assinatura válida;
4. janela de manutenção;
5. `BACKUP_SIGNING_SECRET` correto;
6. `BACKUP_RESTORE_ENABLED=true` temporariamente;
7. confirmação exata `RESTAURAR BACKUP`.

Endpoint:

`POST /admin/security/backups/restore`

O modo atual é `REPLACE` para o domínio operacional incluído no snapshot. Usuários, sessões e lifecycle SaaS não são substituídos.

### Procedimento de restore

1. avisar responsáveis e interromper alterações operacionais no tenant;
2. confirmar o tenant alvo;
3. validar o arquivo em `/backups/validate`;
4. guardar evidência do build atual em `/health` e `/ready`;
5. habilitar `BACKUP_RESTORE_ENABLED=true` no Render;
6. executar restore uma única vez;
7. validar Agenda, clientes, estoque e financeiro por amostragem;
8. validar `/health` e `/ready`;
9. confirmar auditoria `TENANT_BACKUP_RESTORED`;
10. voltar `BACKUP_RESTORE_ENABLED=false` imediatamente;
11. registrar encerramento do incidente.

Nunca deixar o kill switch habilitado após a recuperação.

## 9. Secrets de produção

O `check-env.js` rejeita:

- `JWT_SECRET` ausente ou menor que 32 caracteres;
- placeholder conhecido de JWT;
- `BACKUP_SIGNING_SECRET` configurado com menos de 32 caracteres;
- `DATABASE_URL` incompatível com MongoDB em produção;
- restore habilitado em produção sem `BACKUP_SIGNING_SECRET` explícito;
- `FRONTEND_ORIGIN` ausente em produção.

Segredos reais nunca devem entrar no Git, screenshots, logs, tickets ou metadados de auditoria.

## 10. Resposta a incidente

### Suspeita de conta comprometida

1. identificar usuário/sessionId nos audit logs;
2. encerrar a sessão suspeita;
3. se escopo incerto, encerrar todas as outras sessões do tenant;
4. rotacionar senha do usuário;
5. revisar ações por `requestId/sessionId`;
6. se houver risco de segredo externo, rotacionar o segredo no provider;
7. registrar impacto e período do incidente.

### Suspeita de vazamento de credencial do provider

1. não publicar o valor comprometido em ticket/chat;
2. rotacionar no provider;
3. atualizar variável no Render/Vercel conforme escopo;
4. redeploy quando necessário;
5. revisar métricas de provider/webhook e audit logs;
6. invalidar sessões administrativas se houver possibilidade de comprometimento correlato.

### Integridade de dados

1. não executar restore por reflexo;
2. identificar período afetado;
3. gerar/guardar evidências atuais;
4. validar snapshot candidato;
5. seguir o procedimento de restore controlado acima.

## 11. Validação antes de release

Marco 23 exige:

- `npm audit --audit-level=high` backend/frontend;
- TypeScript/ESLint;
- testes de sessão, LGPD, retenção, rate limit, auditoria e backup/restore;
- builds;
- Quality Gate;
- Production Gate;
- deploy convergido;
- Production Smoke Validation com build rastreável e MongoDB pronto.

Nenhum teste do Marco 23 deve apagar cliente real, executar restore real ou enviar mensagem WhatsApp real.
