# Arquitetura do Frontend GlossFlow

Esta versão aplica a Fase 0 de refatoração arquitetural.

## Objetivo

Reduzir o acoplamento do `App.jsx`, separando a aplicação em domínios visuais:

- `public/`: vitrine pública, agendamento e login.
- `admin/`: painel administrativo e módulos operacionais.
- `ui/`: componentes reutilizáveis de formulário, listas e estados visuais.

## Benefícios

- O `App.jsx` passa a coordenar estado global e roteamento simples.
- A interface fica preparada para a Fase 1: Agenda Enterprise.
- Componentes reutilizáveis reduzem duplicação e facilitam padronização visual.
- O projeto fica mais próximo de uma arquitetura profissional de SaaS.
