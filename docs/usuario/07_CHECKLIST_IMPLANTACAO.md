# Checklist de Implantação — GlossFlow

Use esta lista antes de considerar um salão pronto para operação.

## Acesso e segurança

- [ ] proprietário possui usuário `ADMIN` próprio;
- [ ] recepção e profissionais usam contas separadas;
- [ ] senhas temporárias foram trocadas;
- [ ] sessões desconhecidas foram encerradas;
- [ ] módulos contratados estão habilitados corretamente.

## Cadastro operacional

- [ ] dados básicos do salão revisados;
- [ ] serviços cadastrados com preço e duração;
- [ ] profissionais cadastrados;
- [ ] serviços atendidos por profissional configurados;
- [ ] jornadas, intervalos e bloqueios cadastrados;
- [ ] agenda futura revisada.

## Clientes e estoque

- [ ] clientes iniciais importados/cadastrados quando aplicável;
- [ ] telefones revisados;
- [ ] produtos ativos cadastrados;
- [ ] saldo inicial conferido;
- [ ] estoque mínimo definido;
- [ ] fornecedores e custos revisados.

## WhatsApp e IA

- [ ] provider configurado no ambiente;
- [ ] número/sender associado ao salão correto;
- [ ] webhook validado;
- [ ] callback de status validado;
- [ ] pergunta sobre serviços testada;
- [ ] consulta de disponibilidade testada;
- [ ] criação de agendamento testada;
- [ ] handoff humano aberto e encerrado em teste;
- [ ] fallback da IA testado sem inventar dados.

## Financeiro e fidelidade

- [ ] categorias financeiras definidas;
- [ ] regras de comissão revisadas;
- [ ] programa de fidelidade configurado, se utilizado.

## Homologação

- [ ] login por perfil validado;
- [ ] Agenda validada em desktop e mobile;
- [ ] reagendamento e conflito validados;
- [ ] CRM validado;
- [ ] estoque validado;
- [ ] notificações revisadas;
- [ ] backup lógico executado;
- [ ] responsáveis treinados com os manuais em `docs/usuario/`.

A implantação só deve ser marcada como concluída quando os fluxos usados pelo salão tiverem sido testados com dados de homologação e os responsáveis souberem como agir em caso de conflito, falha de provider ou handoff humano.
