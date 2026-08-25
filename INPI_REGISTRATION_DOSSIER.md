# GlossFlow Smart — Dossiê de Preparação para Registro no INPI

**Data de preparação:** 24/08/2026  
**Repositório:** `turlang/glossflow1`  
**Baseline técnica indicada para o pedido:** `58ce16ed8321d913f155f7f5bf29786ca50a4af1`  
**Branch preservada:** `ip-provenance-ready-2026-08-24`  
**Tag de evidência planejada:** `ip-provenance-2026-08-24`

## 1. Objeto do registro

GlossFlow Smart é um SaaS multi-tenant white-label para salões, barbearias e clínicas de estética, com Agenda, CRM, Estoque, Financeiro, Fidelidade, IA, WhatsApp e módulos operacionais avançados. O objeto pretendido do registro é a expressão concreta do programa de computador contida na baseline acima.

## 2. Titular e autoria — confirmação obrigatória antes do protocolo

Titular pretendido conforme os avisos internos atuais: **Evandro Ricardo**.

Antes de assinar a Declaração de Veracidade, confirmar documentalmente:

- [ ] nome/razão social exatamente como consta no certificado ICP-Brasil e cadastro e-INPI;
- [ ] se o pedido será feito por pessoa física ou jurídica;
- [ ] relação completa de autores/coautores do código incluído na baseline;
- [ ] eventual cessão de direitos patrimoniais de colaboradores, prestadores ou empresas;
- [ ] autorização/licença para qualquer código de terceiro incorporado diretamente;
- [ ] inexistência de material confidencial de clientes ou terceiros dentro do pacote técnico.

**Não declarar autoria exclusiva se houver contribuição autoral relevante de terceiros sem documentação adequada.**

## 3. Identificação técnica

- Frontend: React 18, Vite 8.2.1, CSS próprio/PWA.
- Backend: Node.js, Fastify 5.11.3, TypeScript, Zod, JWT/RBAC.
- Dados: MongoDB Atlas via Prisma 5.22.
- Integrações: Groq/OpenAI, WhatsApp via providers, Mercado Pago/Stripe e observabilidade.
- Arquitetura: SaaS multi-tenant com isolamento por salão/tenant e módulos de negócio.
- Licenciamento do código próprio: proprietário / all rights reserved.

## 4. Documentação jurídica e de evidência relacionada

- `LICENSE.md`
- `COPYRIGHT.md`
- `IP_EVIDENCE_2026-08-24.md`
- `.github/workflows/ip-provenance.yml`
- `CREATE_SIGNED_IP_TAG.ps1`

## 5. Requisitos externos do pedido — checklist operacional

Conferir novamente no portal oficial no dia do protocolo.

- [ ] cadastro ativo no e-INPI;
- [ ] certificado digital **qualificado ICP-Brasil** válido;
- [ ] emitir e pagar GRU, serviço código **730**;
- [ ] guardar o número da GRU;
- [ ] baixar a Declaração de Veracidade vinculada à GRU;
- [ ] assinar digitalmente a DV com certificado qualificado apropriado;
- [ ] gerar o pacote técnico da baseline usando `GENERATE_INPI_PACKAGE.ps1`;
- [ ] conferir e guardar o SHA-256 produzido;
- [ ] preencher o formulário eletrônico e-Software com o hash e o algoritmo SHA-256;
- [ ] anexar a DV assinada;
- [ ] anexar procuração somente se houver procurador;
- [ ] arquivar ZIP, hash, manifesto, DV, GRU e recibo/protocolo fora do GitHub.

## 6. Valor de referência

Na tabela oficial consultada em agosto de 2026, o Pedido de Registro de Programa de Computador — código 730 — está em **R$ 210,00**. Confirmar o valor no portal do INPI antes da emissão da GRU.

## 7. Pacote técnico a ser mantido pelo titular

O INPI recebe o resumo hash; a documentação técnica que originou o hash deve permanecer sob guarda do titular. Recomenda-se manter:

1. ZIP gerado diretamente do commit registrado;
2. arquivo `.sha256` correspondente;
3. lista de arquivos rastreados no commit;
4. este dossiê e o manifesto de evidência;
5. comprovante da tag assinada e attestation Sigstore quando criada;
6. inventário de componentes de terceiros;
7. protocolo e certificado do INPI depois da publicação.

## 8. Dados do formulário que ainda dependem de decisão humana

Preencher somente com dados confirmados:

- título do programa no pedido;
- data de criação;
- data de publicação, se aplicável;
- titular pessoa física ou jurídica;
- autores/coautores;
- linguagem/campo de aplicação conforme opções do e-Software;
- eventual derivação autorizada de software pré-existente;
- procuração, se houver.

## 9. Limites do registro

Este dossiê não reivindica titularidade sobre React, Fastify, Prisma, MongoDB, APIs, provedores, marcas, bibliotecas, fontes, imagens ou outros materiais de terceiros. O pedido deve se limitar ao código e demais expressão protegível criada legitimamente para o GlossFlow Smart.

## 10. Fontes oficiais a conferir no protocolo

- Guia Básico — INPI: `https://www.gov.br/inpi/pt-br/servicos/programas-de-computador/guia-basico`
- Sistema e-Software: `https://www.gov.br/inpi/pt-br/servicos/programas-de-computador/e-software`
- Perguntas Frequentes: `https://www.gov.br/inpi/pt-br/acesso-a-informacao/perguntas-frequentes/programas-de-computador`
- Custos e pagamento: `https://www.gov.br/inpi/pt-br/servicos/custos-e-pagamento`

Este documento é preparatório e não substitui orientação jurídica nem as instruções oficiais vigentes no momento do protocolo.