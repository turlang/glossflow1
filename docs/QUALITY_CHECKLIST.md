# Checklist de Qualidade — GlossFlow Enterprise

Este checklist organiza critérios técnicos, funcionais e de produção para elevar a confiabilidade do GlossFlow como projeto SaaS Full Stack.

## 1. Instalação e ambiente

- [ ] `backend/.env.example` atualizado.
- [ ] `frontend/.env.example` atualizado.
- [ ] Versão do Node documentada.
- [ ] Comandos de instalação testados.
- [ ] Comandos de build testados.
- [ ] Banco MongoDB Atlas configurado em ambiente de teste.

## 2. Back-end

- [ ] API inicia sem erros.
- [ ] Rotas principais documentadas.
- [ ] Autenticação JWT validada.
- [ ] Perfis de acesso testados.
- [ ] Validação de dados aplicada nas entradas críticas.
- [ ] Erros retornam mensagens padronizadas.
- [ ] Prisma Client gerado corretamente.
- [ ] `prisma db push` validado.
- [ ] Seed testado.

## 3. Front-end

- [ ] Build do front-end executa sem erro.
- [ ] Login administrativo funcionando.
- [ ] Navegação principal validada.
- [ ] Layout responsivo testado em mobile.
- [ ] Formulários possuem labels claros.
- [ ] Estados vazios são tratados.
- [ ] Mensagens de erro e sucesso são visíveis.

## 4. Módulos de negócio

- [ ] Serviços: criar, editar e listar.
- [ ] Profissionais: criar, editar e listar.
- [ ] Clientes: criar, editar e listar.
- [ ] Agenda: criar e visualizar agendamentos.
- [ ] Estoque: registrar e consultar itens.
- [ ] Financeiro: registrar entradas e saídas.
- [ ] Comissões: cálculo validado.
- [ ] Fidelidade: regras verificadas.
- [ ] Templates WhatsApp: criação e prévia validadas.
- [ ] Dashboard executivo: indicadores coerentes.

## 5. Segurança

- [ ] `.env` real fora do repositório.
- [ ] `JWT_SECRET` forte em produção.
- [ ] CORS restrito ao domínio correto.
- [ ] Senhas criptografadas.
- [ ] Rotas administrativas protegidas.
- [ ] Dados multiempresa isolados por `salonId`.
- [ ] Credenciais de teste removidas antes de produção.

## 6. Deploy

- [ ] Backend publicado no Render.
- [ ] Frontend publicado na Vercel.
- [ ] Variáveis de ambiente configuradas.
- [ ] Health check validado.
- [ ] CORS funcionando entre front-end e back-end.
- [ ] Build de produção validado.

## 7. Documentação

- [ ] README atualizado.
- [ ] `CASE_TECNICO.md` criado.
- [ ] Checklist de produção atualizado.
- [ ] Plano de QA atualizado.
- [ ] Guia de uso para usuário final atualizado.
- [ ] Prints adicionados ao README.

## 8. Melhorias futuras

- [ ] Testes automatizados de autenticação.
- [ ] Testes de regras financeiras.
- [ ] Documentação OpenAPI/Swagger.
- [ ] Logs estruturados.
- [ ] Integração real com WhatsApp.
- [ ] Integração real com pagamento.
- [ ] Monitoramento de erros.

## Nota de maturidade esperada

Quando a maior parte deste checklist estiver concluída, o projeto pode ser apresentado como SaaS Full Stack candidato a piloto comercial e case forte de empregabilidade.
