/**
 * Serviço de WhatsApp do GlossFlow.
 *
 * Providers suportados:
 * - Meta WhatsApp Cloud API
 * - Twilio WhatsApp
 * - Provider HTTP personalizado legado
 *
 * Mensagens livres são usadas dentro da janela de atendimento.
 * Notificações iniciadas pelo salão usam templates quando disponíveis.
 * Falhas do provider nunca derrubam fluxos de negócio já persistidos.
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

function defaultCountryCode() {
  return String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '55').replace(/\D/g, '');
}

function normalizePhone(phone: string) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';

  // Aceita o formato brasileiro comum digitado no site, por exemplo
  // (11) 96137-2048, e converte para o formato internacional exigido
  // pelos providers: 5511961372048. O DDI pode ser sobrescrito por ENV.
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  const countryCode = defaultCountryCode();
  if (countryCode && (digits.length === 10 || digits.length === 11)) {
    digits = `${countryCode}${digits}`;
  }

  return digits;
}

function providerConfig(phoneNumberId?: string) {
  return {
    provider: String(process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase(),
    token: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0'
  };
}

function twilioConfig() {
  const from = String(process.env.TWILIO_WHATSAPP_FROM || '').trim();
  return {
    accountSid: String(process.env.TWILIO_ACCOUNT_SID || '').trim(),
    authToken: String(process.env.TWILIO_AUTH_TOKEN || '').trim(),
    from: from.startsWith('whatsapp:') ? from : from ? `whatsapp:${from}` : '',
    trialMode: process.env.TWILIO_TRIAL_MODE === 'true',
    trialContentSid: String(process.env.TWILIO_TRIAL_CONTENT_SID || '').trim()
  };
}

function twilioStatusCallbackUrl() {
  const configured = String(process.env.TWILIO_STATUS_CALLBACK_URL || '').trim();
  if (configured) return configured;

  const inboundWebhook = String(process.env.TWILIO_WEBHOOK_URL || '').trim().replace(/\/$/, '');
  if (inboundWebhook) return `${inboundWebhook}/status`;

  const apiBase = String(process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  return apiBase ? `${apiBase}/webhooks/whatsapp/twilio/status` : '';
}

function whatsappAddress(phone: string) {
  const normalized = normalizePhone(phone);
  return normalized ? `whatsapp:+${normalized}` : '';
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

async function postTwilioMessage(input: {
  to: string;
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}) {
  const config = twilioConfig();
  if (!config.accountSid || !config.authToken || !config.from) {
    return {
      ok: false,
      provider: 'twilio',
      code: 'TWILIO_NOT_CONFIGURED',
      message: 'Twilio não configurado. Preencha TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_FROM.'
    };
  }

  const form = new URLSearchParams();
  form.set('To', whatsappAddress(input.to));
  form.set('From', config.from);
  const statusCallback = twilioStatusCallbackUrl();
  if (statusCallback) form.set('StatusCallback', statusCallback);

  if (input.contentSid) {
    form.set('ContentSid', input.contentSid);
    if (input.contentVariables && Object.keys(input.contentVariables).length > 0) {
      form.set('ContentVariables', JSON.stringify(input.contentVariables));
    }
  } else if (input.body) {
    form.set('Body', input.body);
  } else {
    return {
      ok: false,
      provider: 'twilio',
      code: 'TWILIO_EMPTY_MESSAGE',
      message: 'Mensagem Twilio sem Body ou ContentSid.'
    };
  }

  try {
    const basicAuth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`
        },
        body: form.toString()
      }
    );
    const data = await response.json().catch(() => ({}));
    const errorMessage = String(data?.message || data?.error_message || '');
    return {
      ok: response.ok,
      provider: 'twilio',
      statusCode: response.status,
      messageId: String(data?.sid || ''),
      deliveryStatus: String(data?.status || ''),
      statusCallbackConfigured: Boolean(statusCallback),
      data,
      ...(response.ok
        ? {}
        : {
            errorCode: data?.code || null,
            errorMessage: errorMessage || 'Falha ao enviar mensagem pela Twilio.'
          })
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'twilio',
      code: 'TWILIO_NETWORK_ERROR',
      message: 'Não foi possível conectar à Twilio.',
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

  const provider = providerConfig().provider;
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

  if (provider === 'twilio') {
    return postTwilioMessage({ to, body: input.message });
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
 * Envia template aprovado/configurado no provider ativo.
 *
 * Meta: templateName é o nome aprovado no WhatsApp Manager.
 * Twilio: templateName é o ContentSid HX... em produção. No Trial,
 * TWILIO_TRIAL_CONTENT_SID prevalece e as variáveis são omitidas porque
 * o template de demonstração é controlado pela própria Twilio.
 */
export async function sendWhatsAppTemplateMessage(input: SendWhatsAppTemplateInput) {
  const to = normalizePhone(input.to || input.phone || '');
  if (!to || to.length < 10) {
    return { ok: false, provider: 'validation', code: 'INVALID_PHONE', message: 'Telefone inválido. Use DDI + DDD + número.' };
  }

  const provider = providerConfig().provider;
  const twilio = twilioConfig();
  const effectiveTemplate = provider === 'twilio' && twilio.trialMode
    ? twilio.trialContentSid || input.templateName?.trim()
    : input.templateName?.trim();

  if (!effectiveTemplate) {
    return { ok: false, provider: 'validation', code: 'TEMPLATE_NOT_CONFIGURED', message: 'Template de WhatsApp não configurado para esta notificação.' };
  }

  if (input.dryRun || process.env.WHATSAPP_DRY_RUN === 'true') {
    return {
      ok: true,
      provider: 'dry-run',
      to,
      templateName: effectiveTemplate,
      languageCode: input.languageCode || process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR',
      bodyParameters: input.bodyParameters || [],
      sentAt: new Date().toISOString()
    };
  }

  if (provider === 'twilio') {
    if (!effectiveTemplate.startsWith('HX')) {
      return {
        ok: false,
        provider,
        code: 'TWILIO_CONTENT_SID_INVALID',
        message: 'Template Twilio inválido. Use um ContentSid iniciado por HX.'
      };
    }
    const contentVariables = Object.fromEntries(
      (input.bodyParameters || []).map((value, index) => [String(index + 1), String(value)])
    );
    return postTwilioMessage({
      to,
      contentSid: effectiveTemplate,
      contentVariables: twilio.trialMode ? undefined : contentVariables
    });
  }

  if (provider !== 'meta') {
    return {
      ok: false,
      provider,
      code: 'TEMPLATE_PROVIDER_UNSUPPORTED',
      message: `Envio por template não está implementado para o provider ${provider}.`
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
        name: effectiveTemplate,
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
  const twilio = twilioConfig();
  return {
    provider: config.provider,
    dryRun: process.env.WHATSAPP_DRY_RUN === 'true',
    apiVersion: config.provider === 'meta' ? config.apiVersion : undefined,
    accessTokenConfigured: config.provider === 'meta' ? Boolean(config.token) : undefined,
    phoneNumberIdConfigured: config.provider === 'meta' ? Boolean(config.phoneNumberId) : undefined,
    appSecretConfigured: config.provider === 'meta' ? Boolean(process.env.WHATSAPP_APP_SECRET) : undefined,
    twilio: config.provider === 'twilio'
      ? {
          accountSidConfigured: Boolean(twilio.accountSid),
          authTokenConfigured: Boolean(twilio.authToken),
          fromConfigured: Boolean(twilio.from),
          trialMode: twilio.trialMode,
          trialContentSidConfigured: Boolean(twilio.trialContentSid),
          statusCallbackConfigured: Boolean(twilioStatusCallbackUrl()),
          defaultCountryCode: defaultCountryCode()
        }
      : undefined,
    templates: {
      appointmentConfirmed: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_CONFIRMED || '',
      appointmentCancelled: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_CANCELLED || '',
      reminder24h: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER_24H || '',
      reminder2h: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER_2H || '',
      language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR'
    }
  };
}
