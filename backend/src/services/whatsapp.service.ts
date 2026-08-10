/**
 * Serviço de WhatsApp do GlossFlow.
 *
 * - Mensagens de conversa/resposta continuam usando texto livre.
 * - Notificações iniciadas pelo salão (confirmação, lembrete, cancelamento)
 *   podem usar templates aprovados da Meta por meio de sendWhatsAppTemplateMessage.
 * - Falhas do provider nunca derrubam fluxos de negócio já persistidos.
 */
type SendWhatsAppInput = {
  to?: string;
  phone?: string;
  message: string;
  dryRun?: boolean;
  phoneNumberId?: string;
};

type TemplateParameter = string | number;

type SendWhatsAppTemplateInput = {
  to?: string;
  phone?: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: TemplateParameter[];
  dryRun?: boolean;
  phoneNumberId?: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function providerConfig(phoneNumberId?: string) {
  return {
    provider: process.env.WHATSAPP_PROVIDER || 'meta',
    token: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0'
  };
}

function metaErrorDetails(data: any) {
  const error = data?.error || {};
  return {
    errorCode: Number(error.code || 0) || null,
    errorSubcode: Number(error.error_subcode || 0) || null,
    errorType: String(error.type || ''),
    errorMessage: String(error.message || ''),
    fbtraceId: String(error.fbtrace_id || '')
  };
}

async function postMetaMessage(input: {
  to: string;
  phoneNumberId?: string;
  payload: Record<string, unknown>;
}) {
  const config = providerConfig(input.phoneNumberId);
  if (!config.token || !config.phoneNumberId) {
    return {
      ok: false,
      provider: config.provider,
      code: 'META_NOT_CONFIGURED',
      message: 'WhatsApp não configurado. Preencha WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.'
    };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: input.to, ...input.payload })
    });

    const data = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      provider: config.provider,
      phoneNumberId: config.phoneNumberId,
      apiVersion: config.apiVersion,
      statusCode: response.status,
      data,
      ...(response.ok ? {} : metaErrorDetails(data))
    };
  } catch (error) {
    return {
      ok: false,
      provider: config.provider,
      code: 'META_NETWORK_ERROR',
      message: 'Não foi possível conectar ao provedor de WhatsApp.',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function sendWhatsAppMessage(input: SendWhatsAppInput) {
  const to = normalizePhone(input.to || input.phone || '');
  if (!to || to.length < 10) {
    return { ok: false, provider: 'validation', code: 'INVALID_PHONE', message: 'Telefone inválido. Use DDI + DDD + número.' };
  }

  if (input.dryRun || process.env.WHATSAPP_DRY_RUN === 'true') {
    return {
      ok: true,
      provider: 'dry-run',
      to,
      phoneNumberId: input.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      message: input.message,
      sentAt: new Date().toISOString()
    };
  }

  const provider = process.env.WHATSAPP_PROVIDER || 'meta';
  if (provider === 'meta') {
    return postMetaMessage({
      to,
      phoneNumberId: input.phoneNumberId,
      payload: {
        type: 'text',
        text: { preview_url: false, body: input.message }
      }
    });
  }

  try {
    const url = process.env.WHATSAPP_API_URL;
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!url || !token) {
      return { ok: false, provider, code: 'CUSTOM_PROVIDER_NOT_CONFIGURED', message: 'Provider personalizado sem WHATSAPP_API_URL ou WHATSAPP_API_TOKEN.' };
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
      code: 'CUSTOM_PROVIDER_NETWORK_ERROR',
      message: 'Não foi possível conectar ao provedor de WhatsApp.',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Envia um template previamente aprovado no WhatsApp Manager.
 * Os parâmetros são enviados na ordem {{1}}, {{2}}, {{3}}... do corpo.
 */
export async function sendWhatsAppTemplateMessage(input: SendWhatsAppTemplateInput) {
  const to = normalizePhone(input.to || input.phone || '');
  if (!to || to.length < 10) {
    return { ok: false, provider: 'validation', code: 'INVALID_PHONE', message: 'Telefone inválido. Use DDI + DDD + número.' };
  }
  if (!input.templateName?.trim()) {
    return { ok: false, provider: 'validation', code: 'TEMPLATE_NOT_CONFIGURED', message: 'Template de WhatsApp não configurado para esta notificação.' };
  }

  if (input.dryRun || process.env.WHATSAPP_DRY_RUN === 'true') {
    return {
      ok: true,
      provider: 'dry-run',
      to,
      templateName: input.templateName,
      languageCode: input.languageCode || process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR',
      bodyParameters: input.bodyParameters || [],
      sentAt: new Date().toISOString()
    };
  }

  const provider = process.env.WHATSAPP_PROVIDER || 'meta';
  if (provider !== 'meta') {
    return {
      ok: false,
      provider,
      code: 'TEMPLATE_PROVIDER_UNSUPPORTED',
      message: 'Envio por template está disponível no provider Meta.'
    };
  }

  const bodyParameters = (input.bodyParameters || []).map((value) => ({
    type: 'text',
    text: String(value)
  }));

  return postMetaMessage({
    to,
    phoneNumberId: input.phoneNumberId,
    payload: {
      type: 'template',
      template: {
        name: input.templateName.trim(),
        language: { code: input.languageCode || process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR' },
        ...(bodyParameters.length
          ? { components: [{ type: 'body', parameters: bodyParameters }] }
          : {})
      }
    }
  });
}

export function whatsappRuntimeDiagnostics() {
  const config = providerConfig();
  return {
    provider: config.provider,
    dryRun: process.env.WHATSAPP_DRY_RUN === 'true',
    apiVersion: config.apiVersion,
    accessTokenConfigured: Boolean(config.token),
    phoneNumberIdConfigured: Boolean(config.phoneNumberId),
    appSecretConfigured: Boolean(process.env.WHATSAPP_APP_SECRET),
    templates: {
      appointmentConfirmed: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_CONFIRMED || '',
      appointmentCancelled: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_CANCELLED || '',
      reminder24h: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER_24H || '',
      reminder2h: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER_2H || '',
      language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR'
    }
  };
}
