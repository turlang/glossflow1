# Plano de Testes — GlossFlow Enterprise v8.5

## Teste 1 — Vitrine pública

1. Abrir `http://localhost:5173`.
2. Verificar hero, serviços, portfólio e profissionais.
3. Confirmar que os cards têm tamanhos proporcionais.
4. Confirmar que nenhuma imagem invade o texto.

## Teste 2 — Agendamento

1. Clicar em `Agendar`.
2. Selecionar serviço e profissional.
3. Inserir nome, WhatsApp, e-mail opcional e data.
4. Confirmar agendamento.
5. Entrar no admin e verificar se aparece na agenda.

## Teste 3 — Admin

1. Acessar o painel admin.
2. Fazer login.
3. Navegar por todos os menus da sidebar.
4. Confirmar que a sidebar tem rolagem quando necessário.
5. Confirmar que textos e descrições não ficam aglomerados.

## Teste 4 — CRUDs

Validar criar, editar e excluir:

- Serviços
- Profissionais
- Vitrine
- Produtos do estoque
- Clientes
- Financeiro
- Comissões
- Fidelidade

## Teste 5 — Responsividade

Testar em:

- 1366x768
- 1920x1080
- 2560x1440
- Tablet vertical
- Celular grande
- Celular pequeno

## Teste 6 — Segurança

1. Confirmar que não existe `.env` real no ZIP.
2. Confirmar que `.env.example` existe.
3. Confirmar que rotas admin exigem token.
4. Confirmar logout.
