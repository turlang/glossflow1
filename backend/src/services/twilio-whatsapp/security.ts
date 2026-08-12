import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyRequest } from 'fastify';

export type TwilioForm = Record<string, string>;

export function stripWhatsappAddress(value: string) {
  return String(value || '').replace(/^whatsapp:/i, '').trim();
}

/** Resolve a URL exatamente como a Twilio a enxerga para validar HMAC. */
export function webhookUrl(request: FastifyRequest) {
  const path = request.url.split('?')[0];
  const configuredInbound = String(process.env.TWILIO_WEBHOOK_URL || '').trim().replace(/\/$/, '');
  const configuredStatus = String(process.env.TWILIO_STATUS_CALLBACK_URL || '').trim();

  if (path === '/webhooks/whatsapp/twilio/status') {
    if (configuredStatus) return configuredStatus;
    if (configuredInbound) return `${configuredInbound}/status`;
  } else if (configuredInbound) {
    return configuredInbound;
  }

  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProto || 'https';
  const host = forwardedHost || String(request.headers.host || '').trim();
  return `${protocol}://${host}${request.url}`;
}

export function validTwilioSignature(url: string, params: TwilioForm, signature: string, authToken: string) {
  if (!url || !signature || !authToken) return false;

  const signed = Object.keys(params)
    .sort()
    .reduce((value, key) => `${value}${key}${String(params[key] ?? '')}`, url);
  const expected = createHmac('sha1', authToken).update(signed).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function twilioTrialReplyEnabled() {
  return String(process.env.WHATSAPP_PROVIDER || '').toLowerCase() === 'twilio'
    && process.env.TWILIO_TRIAL_MODE === 'true'
    && Boolean(String(process.env.TWILIO_TRIAL_CONTENT_SID || '').trim());
}
