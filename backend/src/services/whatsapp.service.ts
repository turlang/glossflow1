/**
 * Serviço de WhatsApp do GlossFlow.
 *
 * Funciona em dois modos:
 * 1. dry-run: retorna sucesso simulado sem chamar API externa.
 * 2. real: chama Meta WhatsApp Cloud API ou um provider personalizado.
 *
 * Importante: falhas do provider nunca devem derrubar fluxos de negócio que já
 * foram persistidos, como criação/cancelamento de agendamento. Por isso toda
 * falha externa é convertida em retorno { ok: false }.
 */
type SendWhatsAppInput = {
  to?: string;
  phone?: string;
  message: string;
  dryRun?: boolean;
  phoneNumberId?: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

export async function sendWhatsAppMessage(input: SendWhatsAppInput) {
  const to = normalizePhone(input.to || input.phone || '');
  if (!to || to.length < 10) {
    return { ok: false, provider: 'validation', message: 'Telefone inválido. Use DDI + DDD + número.' };
  }

  if (input.dryRun || process.env.WHATSAPP_DRY_RUN === 'true') {
    return { ok: true, provider: 'dry-run', to, phoneNumberId: input.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '', message: input.message, sentAt: new Date().toISOString() };
  }

  const provider = process.env.WHATSAPP_PROVIDER || 'meta';

  try {
    if (provider === 'meta') {
      const token = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = input.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

      if (!token || !phoneNumberId) {
        return { ok: false, provider, message: 'WhatsApp não configurado. Preencha WHATSAPP_ACCESS_TOKEN e informe o Phone Number ID.' };
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
      return { ok: response.ok, provider, phoneNumberId, statusCode: response.status, data };
    }

    const url = process.env.WHATSAPP_API_URL;
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!url || !token) {
      return { ok: false, provider, message: 'Provider personalizado sem WHATSAPP_API_URL ou WHATSAPP_API_TOKEN.' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, message: input.message, phoneNumberId: input.phoneNumberId })
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, provider, statusCode: response.status, data };
  } catch (error) {
    return {
      ok: false,
      provider,
      message: 'Não foi possível conectar ao provedor de WhatsApp.',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
