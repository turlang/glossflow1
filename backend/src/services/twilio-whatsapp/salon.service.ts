import { prisma } from '../../lib/prisma';
import { hasSalonModule } from '../module-access.service';
import { normalizePhone } from '../whatsapp-agent.service';
import { stripWhatsappAddress } from './security';

/** Valida os três módulos exigidos pelo atendimento autônomo. */
export async function agentModulesEnabled(salonId: string) {
  const entitlement = await prisma.salon.findUnique({
    where: { id: salonId },
    select: { modulesConfigured: true, enabledModules: true }
  });
  if (!entitlement) return false;
  return hasSalonModule(entitlement, 'WHATSAPP')
    && hasSalonModule(entitlement, 'IA')
    && hasSalonModule(entitlement, 'AGENDA');
}

/**
 * Fallback restrito ao sender configurado na Twilio. Evita resolver outro
 * tenant apenas pelo slug quando a mensagem chegou por um número diferente.
 */
export async function fallbackTwilioSalon(to: string) {
  const configuredFrom = normalizePhone(stripWhatsappAddress(process.env.TWILIO_WHATSAPP_FROM || ''));
  const target = normalizePhone(stripWhatsappAddress(to));
  if (configuredFrom && target && configuredFrom !== target) return null;

  const slug = process.env.TWILIO_DEFAULT_SALON_SLUG
    || process.env.DEFAULT_PUBLIC_SALON_SLUG
    || 'glossflow';
  return prisma.salon.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, whatsapp: true, openingHours: true }
  });
}
