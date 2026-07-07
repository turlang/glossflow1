# Case Técnico — GlossFlow Enterprise

## Problema

Salões de beleza, barbearias e clínicas de estética costumam depender de várias ferramentas separadas para agenda, clientes, serviços, estoque, financeiro, fidelização e comunicação. Isso dificulta a operação diária, reduz previsibilidade e prejudica a experiência do cliente.

## Solução

O GlossFlow centraliza a operação em uma plataforma SaaS com vitrine pública, agendamento online, painel administrativo, CRM, financeiro, estoque, comissões, fidelidade, automações e estrutura multiempresa.

## Público-alvo

- Salões de beleza.
- Barbearias.
- Clínicas de estética.
- Profissionais autônomos com agenda recorrente.
- Pequenas redes de atendimento.

## Principais módulos

- Autenticação e perfis de acesso.
- Vitrine pública.
- Serviços.
- Profissionais.
- Agenda.
- Clientes.
- Estoque.
- Financeiro.
- Comissões.
- Fidelidade.
- Templates de WhatsApp.
- Central de automações.
- Dashboard executivo.
- Estrutura multiempresa.

## Arquitetura

```text
Frontend React/Vite
        |
        v
API Fastify/TypeScript
        |
        v
Prisma ORM
        |
        v
MongoDB Atlas
```

## Decisões técnicas

### Separação entre front-end e back-end

Permite deploy independente, evolução da interface sem afetar a API e melhor organização para manutenção.

### Uso de TypeScript no back-end

Melhora previsibilidade, reduz erros em regras de negócio e facilita evolução do sistema.

### Uso de Prisma com MongoDB

Ajuda a estruturar entidades, padronizar acesso ao banco e manter clareza no modelo de dados.

### Multiempresa via `salonId`

Permite que a mesma base do SaaS atenda múltiplos salões, mantendo dados separados por contexto de negócio.

### JWT e perfis de acesso

Permite autenticação stateless e controle básico de permissões para área administrativa.

## Diferenciais para empregabilidade

- Demonstra arquitetura SaaS.
- Demonstra domínio de produto real.
- Usa stack moderna.
- Possui módulos administrativos complexos.
- Tem documentação de produção e QA.
- Mostra preocupação com segurança, integrações e operação.

## Riscos e pontos de melhoria

- Ampliar cobertura de testes automatizados.
- Validar integrações externas em produção.
- Melhorar observabilidade real.
- Adicionar screenshots e vídeo de demonstração.
- Documentar endpoints da API.

## Evolução recomendada

1. Criar documentação de API.
2. Adicionar testes para regras críticas.
3. Adicionar imagens de demonstração ao README.
4. Refinar onboarding do salão.
5. Implementar integração real com WhatsApp.
6. Melhorar controle de assinatura e pagamento.

## Como apresentar em entrevista

Este projeto deve ser apresentado como um SaaS Full Stack desenvolvido para resolver um problema real de gestão em negócios de beleza. O ponto forte não é apenas a tela, mas a combinação de regra de negócio, arquitetura, multiempresa, autenticação, módulos administrativos e visão de produto.
