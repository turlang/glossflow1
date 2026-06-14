# GlossFlow v9.5 — Polimento Enterprise, Ecossistema, IA e Observabilidade

Esta versão consolida a evolução do GlossFlow como SaaS comercial avançado para salões.

## Entregas principais

- **UX de nível líder de mercado**
  - Nova área `UX Premium` com atalhos de tarefa, tour recomendado e navegação orientada por valor.
  - Redução de carga cognitiva para donos de salão, recepção e gestores.

- **Agenda nível Enterprise**
  - Mantida a agenda v9.0 com Dia, Semana, Mês e Timeline por profissional.
  - Base pronta para evoluir drag/resize avançado e sincronização com Google Calendar.

- **IA realmente conectada**
  - Mantida integração opcional com OpenAI via `OPENAI_API_KEY`.
  - Fallback local preservado para demonstração sem custo externo.

- **Observabilidade**
  - Métricas em memória de requisições, latência, erros, rotas mais acessadas, memória e uptime.
  - Nova tela administrativa `Observabilidade`.
  - Recomendações de operação para produção.

- **Ecossistema**
  - Nova tela `Ecossistema` com conectores reais preparados:
    - OpenAI
    - WhatsApp Business
    - Mercado Pago
    - Stripe
    - Google Calendar
    - Cloudinary
    - Sentry
    - Meta Ads

## Variáveis novas de ambiente

Veja `backend/.env.example`.

## Comandos

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Nota técnica estimada

- MVP comercial: 9.5/10
- SaaS profissional em piloto: 9.2/10
- Produção enterprise: depende de conectar integrações reais, monitoramento externo e testes com clientes.
