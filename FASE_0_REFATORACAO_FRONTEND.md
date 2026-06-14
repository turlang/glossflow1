# GlossFlow — Fase 0: Refatoração Arquitetural do Frontend

Esta versão prepara o projeto para a Fase 1 — Agenda Enterprise.

## O que foi alterado

O frontend deixou de concentrar praticamente toda a aplicação em `src/App.jsx`.

Antes:

```txt
src/App.jsx  -> arquivo monolítico com mais de 1400 linhas
```

Agora:

```txt
src/
├── App.jsx
├── components/
│   ├── admin/
│   │   └── AdminDashboard.jsx
│   ├── public/
│   │   └── PublicExperience.jsx
│   └── ui/
│       ├── Feedback.jsx
│       └── Forms.jsx
├── services/
└── utils/
```

## Benefícios técnicos

- `App.jsx` passa a ser responsável apenas por estado global, carregamento de dados e roteamento simples.
- A vitrine pública, o login e o agendamento público ficam separados do painel administrativo.
- Componentes reutilizáveis de formulário/lista/feedback foram isolados.
- O build do frontend foi testado com sucesso após a refatoração.
- A base fica preparada para receber uma Agenda Enterprise sem aumentar ainda mais o arquivo principal.

## Como rodar

```bash
cd frontend
npm install
npm run dev
```

Para gerar build:

```bash
npm run build
```
