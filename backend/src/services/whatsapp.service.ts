/**
 * Serviço de WhatsApp do GlossFlow.
 *
 * Funciona em dois modos:
 * 1. dry-run: retorna sucesso simulado sem chamar API externa.
 * 2. real: chama Meta WhatsApp Cloud API ou um provider personalizado.
 *
 * Esse desenho permite que outro dev teste fluxo, UI e rotas sem possuir
 * conta Meta Business configurada. Para produção, preencha as variáveis
 * WHATSAPP_* no .env e altere WHATSAPP_DRY_RUN para false.
 */
type SendWhatsAppInput = {
  to: string;
  message: string;
  dryRun?: boolean;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

export async function sendWhatsAppMessage(input: SendWhatsAppInput) {
  const to = normalizePhone(input.to);
  if (!to || to.length < 10) {
    return { ok: false, provider: 'validation', message: 'Telefone inválido. Use DDI + DDD + número.' };
  }

  if (input.dryRun || process.env.WHATSAPP_DRY_RUN === 'true') {
    return { ok: true, provider: 'dry-run', to, message: input.message, sentAt: new Date().toISOString() };
  }

  const provider = process.env.WHATSAPP_PROVIDER || 'meta';

  if (provider === 'meta') {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    if (!token || !phoneNumberId) {
      return { ok: false, provider, message: 'WhatsApp não configurado. Preencha WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.' };
    }

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body: input.message }
      })
    });

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, provider, statusCode: response.status, data };
  }

  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!url || !token) {
    return { ok: false, provider, message: 'Provider personalizado sem WHATSAPP_API_URL ou WHATSAPP_API_TOKEN.' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, message: input.message })
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, provider, statusCode: response.status, data };
}
