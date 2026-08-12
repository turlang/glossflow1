# GlossFlow — Guia de Segurança e LGPD para o ADMIN

Este guia explica a tela **Segurança** do salão. Operações destrutivas devem ser usadas somente quando houver uma necessidade real e documentada.

## O que o ADMIN encontra na tela Segurança

- score e controles de segurança;
- sessões administrativas;
- auditoria recente;
- exportação de dados de um cliente;
- eliminação/anônimização de dados pessoais;
- registro de consentimento;
- prévia e execução da política de retenção;
- criação e download de backup lógico assinado.

## Encerrar uma sessão

Use **Encerrar sessão** quando um dispositivo não for mais confiável, um funcionário saiu da operação ou houver suspeita de acesso indevido.

A revogação passa a valer no servidor: o access token daquela sessão deixa de ser aceito.

## Encerrar outras sessões

**Encerrar outras sessões** é uma ação de resposta a incidente. Ela encerra as demais sessões do salão e preserva a sessão atual do ADMIN por padrão.

Use quando:

- uma senha pode ter sido compartilhada;
- um computador/celular foi perdido;
- não é possível identificar qual sessão é suspeita.

Depois, altere as credenciais do usuário afetado.

## Exportar dados LGPD

1. selecione o cliente;
2. clique em **Exportar dados**;
3. o navegador baixa um arquivo JSON;
4. guarde ou envie o arquivo somente pelo canal definido pelo salão.

O arquivo pode conter dados pessoais, histórico de atendimento, consentimentos e eventos relacionados ao titular. Não anexe em grupos públicos, tickets ou conversas que não precisam desses dados.

## Eliminar dados pessoais

Essa operação **não é exclusão comum de cadastro**.

1. selecione o titular correto;
2. informe um motivo documentado;
3. clique em **Eliminar dados pessoais**;
4. digite exatamente `EXCLUIR DADOS` quando solicitado;
5. confira a mensagem de conclusão.

O GlossFlow remove dados operacionais dispensáveis e anonimiza PII do histórico que precisa permanecer coerente. A ação gera uma trilha anônima de auditoria.

Não use para:

- corrigir telefone/e-mail;
- remover cadastro duplicado sem análise;
- limpar base de testes indiscriminadamente.

## Consentimento

O formulário de consentimento registra:

- cliente;
- tipo;
- concedido/negado;
- evidência operacional.

A evidência deve descrever de forma objetiva como o registro foi obtido. Não cole documentos completos ou informações desnecessárias nesse campo.

## Retenção

A tela mostra uma **prévia** antes de qualquer limpeza:

- sessões antigas;
- eventos WhatsApp cujo conteúdo será redigido;
- logs além da janela configurada;
- metadados antigos de backup.

Para executar, clique em **Aplicar retenção** e digite `APLICAR RETENCAO`.

A rotina não roda automaticamente no Marco 23. Isso permite revisar a prévia antes da operação.

## Backup lógico assinado

Clique em **Criar e baixar backup** para receber um arquivo JSON assinado do domínio operacional do salão.

Ele inclui, entre outros:

- serviços/profissionais;
- clientes;
- Agenda e lista de espera;
- estoque;
- financeiro/comissões;
- fidelidade;
- templates e consentimentos.

Ele não inclui usuários, senhas, sessões, assinatura SaaS, domínio ou auditoria.

Guarde backups em local restrito. O arquivo pode conter dados pessoais do salão.

## Restore

O restore não fica exposto como botão de uso diário. Por padrão, a API informa **restore bloqueado**.

Se uma recuperação real for necessária, o responsável técnico deve seguir o runbook `docs/engineering/SECURITY_LGPD.md`, validar a assinatura do arquivo e habilitar temporariamente o kill switch de restore.

## Em caso de incidente

1. preserve evidências e não compartilhe credenciais no chat;
2. encerre a sessão suspeita ou todas as outras sessões;
3. troque a senha do usuário afetado;
4. revise a auditoria por horário e ação;
5. se uma chave externa foi exposta, peça a rotação no provider;
6. acione o responsável técnico antes de executar restore ou eliminação em massa.

A tela Segurança ajuda na resposta operacional, mas decisões jurídicas e políticas de privacidade devem seguir as orientações responsáveis pelo tratamento de dados da organização.
