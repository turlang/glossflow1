# Checklist de Implantação — GlossFlow

Use esta lista para cada novo salão. A implantação do tenant é separada da validação da release base: primeiro a plataforma precisa estar verde; depois os dados, módulos e integrações do cliente são homologados.

## 1. Identificação da implantação

- [ ] nome/slug do tenant conferidos;
- [ ] responsável do salão definido;
- [ ] responsável técnico definido;
- [ ] plano e módulos contratados registrados;
- [ ] data de início/trial/go-live definida;
- [ ] itens opcionais não contratados marcados como N/A.

## 2. Acesso e segurança

- [ ] proprietário possui usuário `ADMIN` próprio;
- [ ] recepção e profissionais usam contas separadas;
- [ ] senhas temporárias foram trocadas;
- [ ] sessões desconhecidas foram encerradas;
- [ ] módulos contratados estão habilitados corretamente;
- [ ] ninguém do salão recebeu credencial `SUPER_ADMIN`;
- [ ] política de suporte e recuperação de acesso foi explicada.

## 3. Marca e dados do salão

- [ ] nome público revisado;
- [ ] telefone/WhatsApp revisados;
- [ ] endereço revisado;
- [ ] horários de atendimento revisados;
- [ ] logo e imagens aprovados;
- [ ] cores/template white-label aprovados;
- [ ] domínio personalizado validado quando contratado.

## 4. Serviços e equipe

- [ ] serviços cadastrados com preço e duração;
- [ ] profissionais cadastrados;
- [ ] serviços atendidos por cada profissional configurados;
- [ ] jornadas configuradas;
- [ ] intervalos e pausas configurados;
- [ ] bloqueios/indisponibilidades revisados;
- [ ] agenda futura existente foi conciliada antes do go-live.

## 5. Agenda e fluxo público

- [ ] vitrine pública mostra o tenant correto;
- [ ] página de agendamento abre em desktop e mobile;
- [ ] serviço disponível aparece corretamente;
- [ ] profissional compatível aparece corretamente;
- [ ] horários respeitam duração/jornada/bloqueios;
- [ ] conflito é recusado;
- [ ] reagendamento usa o fluxo oficial;
- [ ] cancelamento respeita a política do salão;
- [ ] Smart Fit/lista de espera foram explicados aos operadores quando habilitados.

Quando a homologação exigir criação de agendamento, usar **registro QA autorizado**, claramente identificável e removível pelo fluxo normal. Não usar cliente real sem necessidade.

## 6. Clientes e CRM

- [ ] clientes iniciais foram importados/cadastrados quando aplicável;
- [ ] telefone/e-mail foram revisados;
- [ ] origem/segmentação inicial foi conferida quando usada;
- [ ] consentimentos existentes foram tratados corretamente;
- [ ] opt-out foi explicado à equipe;
- [ ] automações/follow-ups ativados possuem texto e gatilho aprovados.

Não criar consentimento fictício para cliente real apenas para completar checklist.

## 7. Estoque

- [ ] produtos ativos cadastrados;
- [ ] unidade de medida revisada;
- [ ] saldo inicial conferido fisicamente;
- [ ] estoque mínimo definido;
- [ ] fornecedores e custos revisados;
- [ ] responsável pela reposição definido;
- [ ] equipe sabe registrar entrada, saída e ajuste.

Não alterar saldo real para “testar” depois do go-live. Para treinamento, usar dados QA antes da operação real ou ambiente apropriado.

## 8. WhatsApp e IA

- [ ] módulo contratado e habilitado;
- [ ] provider configurado no ambiente correto;
- [ ] número/sender pertence ao tenant correto;
- [ ] webhook inbound validado;
- [ ] callback de status validado quando disponível;
- [ ] serviços/produtos/base factual do agente revisados;
- [ ] regras de handoff humano aprovadas;
- [ ] tom de comunicação aprovado;
- [ ] templates obrigatórios aprovados pelo provider quando aplicável;
- [ ] fallback não inventa informação do salão.

### Regra de homologação externa

- usar sandbox/trial/número de teste quando disponível;
- envio real somente com autorização explícita do responsável;
- Trial Twilio não deve ser apresentado como linha definitiva de produção;
- registrar o resultado do provider (`sent`/`delivered`/`read`) quando o escopo exigir.

## 9. Financeiro, fidelidade e billing

- [ ] categorias financeiras definidas quando o módulo for usado;
- [ ] regras de comissão revisadas;
- [ ] programa de fidelidade configurado quando contratado;
- [ ] Stripe/Mercado Pago homologados somente se cobrança automática fizer parte do plano vendido;
- [ ] integração opcional não contratada marcada como N/A em vez de “pendente eterno”.

## 10. Segurança e LGPD

- [ ] ADMIN sabe encerrar sessão desconhecida;
- [ ] fluxo de exportação do titular foi explicado;
- [ ] eliminação/anônimização foi explicada como operação sensível;
- [ ] política de retenção foi apresentada;
- [ ] responsável sabe onde encontrar o runbook de incidente;
- [ ] backup lógico pode ser gerado pelo operador autorizado;
- [ ] restore não fica habilitado na operação normal.

**Não executar eliminação LGPD, retenção destrutiva ou restore real apenas para homologar o tenant.** Esses contratos são validados automaticamente com fixtures/mocks; produção só usa as operações quando houver necessidade real e autorização.

## 11. Homologação por papel

- [ ] `ADMIN` validado;
- [ ] `RECEPTION` validado para funções operacionais contratadas;
- [ ] `PROFESSIONAL` validado no escopo permitido;
- [ ] links/telas incompatíveis não ficam disponíveis para o papel;
- [ ] 403 de permissão não causa logout indevido.

`SUPER_ADMIN` pertence à operação da plataforma e é homologado separadamente pela equipe técnica.

## 12. Dispositivos

- [ ] desktop principal do salão validado;
- [ ] celular usado pela recepção/proprietário validado;
- [ ] tablet validado quando fizer parte da operação;
- [ ] tema/contraste e selects legíveis;
- [ ] não existe overflow horizontal impeditivo nos fluxos utilizados.

## 13. Backup, suporte e incidente

- [ ] responsável sabe como gerar backup lógico;
- [ ] local seguro de armazenamento foi definido;
- [ ] canal de suporte foi informado;
- [ ] responsável sabe informar horário, usuário e ação em caso de falha;
- [ ] equipe sabe diferenciar falha da plataforma de indisponibilidade do provider externo;
- [ ] P0/P1 possuem canal de escalonamento definido.

## 14. Treinamento

- [ ] proprietário recebeu o manual correspondente;
- [ ] recepção recebeu o manual correspondente;
- [ ] profissionais receberam orientação do seu escopo;
- [ ] Agenda foi treinada;
- [ ] CRM foi treinado quando contratado;
- [ ] Estoque foi treinado quando contratado;
- [ ] WhatsApp/handoff foi treinado quando contratado;
- [ ] Segurança/LGPD foi apresentada ao ADMIN.

## 15. GO-LIVE DO TENANT

Marcar o tenant como pronto somente quando:

1. a release base do GlossFlow estiver verde no checklist de produção;
2. módulos vendidos estiverem habilitados;
3. dados iniciais tiverem sido conferidos;
4. fluxos realmente usados pelo salão tiverem sido homologados;
5. integrações externas contratadas tiverem evidência suficiente;
6. responsáveis tiverem sido treinados;
7. não existir bloqueio operacional conhecido.

Registrar data, responsável e exceções/N/A da implantação. Não esconder pendência classificando-a como aprovada.