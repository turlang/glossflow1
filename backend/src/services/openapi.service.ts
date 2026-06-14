/**
 * Documento OpenAPI mínimo do GlossFlow.
 *
 * Mantém um contrato público das principais rotas para facilitar integração
 * com Swagger UI, Postman, Insomnia ou outros consumidores da API. Sempre que
 * uma rota pública ou comercial importante for criada, atualize este arquivo.
 */
export function buildOpenApiDocument() {
  const baseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3333';

  return {
    openapi: '3.0.3',
    info: {
      title: 'GlossFlow API',
      version: '10.0.0',
      description: 'API SaaS para gestão de salões com agenda, pagamentos, WhatsApp, IA, auditoria e operação comercial.'
    },
    servers: [{ url: baseUrl }],
    tags: [
      { name: 'Health' },
      { name: 'Public' },
      { name: 'Auth' },
      { name: 'Admin' },
      { name: 'Integrations' },
      { name: 'Commercial' }
    ],
    paths: {
      '/health': { get: { tags: ['Health'], summary: 'Healthcheck simples', responses: { '200': { description: 'API ativa' } } } },
      '/ready': { get: { tags: ['Health'], summary: 'Readiness com diagnóstico de integrações', responses: { '200': { description: 'API pronta' } } } },
      '/openapi.json': { get: { tags: ['Health'], summary: 'Documento OpenAPI', responses: { '200': { description: 'Contrato da API' } } } },
      '/commercial/plans': { get: { tags: ['Commercial'], summary: 'Lista planos comerciais públicos', responses: { '200': { description: 'Planos disponíveis' } } } },
      '/commercial/leads': { post: { tags: ['Commercial'], summary: 'Captura lead comercial', responses: { '201': { description: 'Lead registrado' } } } },
      '/commercial/trial': { post: { tags: ['Commercial'], summary: 'Solicita trial de 7 dias', responses: { '201': { description: 'Trial solicitado' } } } },
      '/commercial/affiliate/referral': { post: { tags: ['Commercial'], summary: 'Registra indicação de afiliado', responses: { '201': { description: 'Indicação registrada' } } } },
      '/admin/ecosystem/integrations': { get: { tags: ['Integrations'], summary: 'Status das integrações', responses: { '200': { description: 'Status de WhatsApp, pagamentos, IA e Sentry' } } } }
    }
  };
}
