# Runbook Operacional GlossFlow

Este runbook é usado na operação da plataforma e em incidentes de produção. A regra principal é **preservar dados, confirmar o build realmente servido e evitar ações destrutivas improvisadas**.

## 1. Incidente: API fora do ar

1. Acesse `/health`.
2. Se não responder 200, consulte os logs do Render e o status do deploy.
3. Confirme `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, `PORT` e demais variáveis obrigatórias sem copiar segredos para tickets/chat.
4. Confirme qual commit deveria estar em produção.
5. Rode `npm run deploy:verify` em ambiente de desenvolvimento/CI quando precisar reproduzir o gate.
6. Não execute `seed`, `prisma:push` ou restore como tentativa genérica de “consertar” indisponibilidade.

## 2. Incidente: API responde, mas não está pronta

1. Acesse `/ready`.
2. Confirme `ok`, `build` e `database.ok`.
3. Compare o Build ID com os 12 primeiros caracteres do SHA de `main` esperado.
4. Se `/health` e `/ready` apontarem build antigo, trate como **deploy stale** e não como aplicação saudável.
5. Se `database.ok=false`, investigar Atlas/rede/credencial antes de qualquer alteração de schema.

## 3. Incidente: frontend e backend em versões diferentes

1. Confirme o SHA publicado pelo Vercel.
2. Confirme `/health.build` e `X-GlossFlow-Build` no Render.
3. O `Production Smoke Validation` deve falhar quando o backend não servir o SHA esperado.
4. Não considere a release concluída até Vercel, Render e smoke convergirem.

## 4. Incidente: integrações falham

1. Acesse `/ready` e, quando autorizado, `/admin/ecosystem/integrations`.
2. Identifique se a integração é obrigatória ao plano do tenant ou opcional.
3. Confirme somente presença/configuração; nunca exponha o valor do token em log/ticket.
4. Use dry-run, sandbox ou trial antes de qualquer ação externa real.
5. WhatsApp real só deve ser disparado com autorização explícita e número de teste apropriado.
6. Stripe/Mercado Pago ausentes não são incidente quando billing automático não foi vendido.
7. Sentry ausente não deve ser apresentado como conectado; tratar como hardening opcional enquanto não fizer parte do SLA.

## 5. Incidente: build falhando

1. Confirme versão de Node compatível com `backend/package.json` / `frontend/package.json`.
2. Use `npm ci` em CI.
3. Rode Prisma generate antes do build do backend.
4. Rode lint, testes e build localmente/CI.
5. Não apague lockfile como primeira tentativa. Alteração de lock é mudança de dependência e deve ser revisada/versionada conscientemente.

## 6. Incidente: dados cruzados entre salões

**Classificação: P0 / segurança multi-tenant.**

1. Pare a promoção da release e suspenda a operação afetada quando necessário.
2. Preserve logs/auditoria e anote `requestId`, `sessionId`, tenant e horário.
3. Verifique se a rota usa `salonId` do contexto autenticado.
4. Para mutações, exigir filtro tenant-safe como `{ id, salonId }` no contrato aplicável.
5. Não “corrija” dados manualmente antes de entender o alcance.
6. Abra issue de incidente e mantenha a release em NO-GO até correção, testes e revalidação.

## 7. Incidente: sessão/credencial comprometida

1. ADMIN: encerrar a sessão específica ou as demais sessões pelo painel Segurança.
2. Se necessário, desativar o usuário afetado.
3. Correlacionar auditoria por `requestId`/`sessionId`.
4. Rotacionar segredo externo somente no provider responsável e atualizar o ambiente seguro.
5. Nunca publicar token, senha, auth secret, API key ou snapshot de backup no GitHub.

## 8. Solicitação LGPD

### Exportação

- usar o fluxo administrativo de exportação do titular;
- confirmar o tenant e o cliente correto;
- armazenar/entregar o arquivo de forma segura;
- resposta da API usa `Cache-Control: no-store`.

### Eliminação/anônimização

- confirmar identidade/processo interno antes da operação;
- exigir a frase `EXCLUIR DADOS` e motivo;
- não usar a operação como correção cadastral ou teste;
- em homologação, usar fixtures/mocks em vez de cliente real.

## 9. Retenção

1. Executar primeiro o preview.
2. Revisar quantidade/tipos de registros candidatos.
3. Aplicar somente com confirmação `APLICAR RETENCAO` e dentro da política aprovada.
4. Nunca ativar cron destrutivo sem decisão explícita de produto/operação.

## 10. Backup lógico e recuperação

### Backup

- gerar snapshot assinado pelo fluxo administrativo;
- guardar em local controlado;
- não expor snapshot em issue/chat/log público.

### Restore

Restore é procedimento extraordinário:

1. validar runbook e causa do incidente;
2. confirmar snapshot, tenant, schema e assinatura;
3. habilitar `BACKUP_RESTORE_ENABLED=true` apenas durante a janela autorizada;
4. exigir confirmação `RESTAURAR BACKUP`;
5. executar somente com responsável técnico presente;
6. validar aplicação após restore;
7. retornar imediatamente `BACKUP_RESTORE_ENABLED=false`;
8. preservar auditoria `TENANT_BACKUP_RESTORED`.

**Não executar restore real somente para homologar uma release.** O contrato é coberto por testes automatizados.

## 11. WhatsApp com falha

1. Verificar webhook inbound e callback de status.
2. Confirmar assinatura/provider e tenant resolvido.
3. Consultar status da mensagem sem reenviar em loop.
4. Preservar idempotência.
5. Se provider estiver indisponível, usar handoff/canal alternativo definido pelo salão.

## 12. Agenda com conflito operacional

1. Confirmar profissional, serviço, duração e horário.
2. Reexecutar disponibilidade/Smart Fit em vez de forçar sobreposição.
3. Usar reagendamento oficial para mudança de horário.
4. Não editar diretamente o registro no banco como procedimento normal.

## 13. Checklist pós-deploy obrigatório

- [ ] Quality Gate verde;
- [ ] Production Gate verde;
- [ ] Vercel `READY` no SHA esperado;
- [ ] `/health` responde 200 e Build ID = 12 primeiros chars do SHA esperado;
- [ ] `X-GlossFlow-Build` = `/health.build`;
- [ ] `/ready` responde 200, mesmo build e `database.ok=true`;
- [ ] `Production Smoke Validation` verde;
- [ ] vitrine pública responde;
- [ ] serviços/profissionais/portfólio respondem;
- [ ] Agenda read model responde;
- [ ] nenhuma regressão P0/P1 conhecida permanece aberta.

Fluxos que exigem escrita, credencial ou provider real pertencem ao checklist de implantação do tenant e não ao smoke global read-only.

## 14. Escalonamento

Classificação sugerida:

- **P0**: vazamento/cross-tenant, corrupção/perda de dados, indisponibilidade total, bypass crítico de autenticação/autorização;
- **P1**: Agenda/Estoque/CRM/WhatsApp indisponível para operação principal sem workaround aceitável;
- **P2**: degradação parcial, UX ou integração opcional com workaround;
- **P3**: melhoria/cosmético/documentação.

P0/P1 bloqueiam promoção de release comercial até correção e revalidação.