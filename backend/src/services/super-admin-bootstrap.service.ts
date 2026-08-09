import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

type BootstrapLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Garante a conta global da plataforma sem depender de Shell no provedor.
 *
 * - Se SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD não estiverem configurados,
 *   não faz nada.
 * - Se apenas uma das variáveis estiver presente, falha explicitamente para
 *   evitar uma implantação parcialmente configurada.
 * - A senha nunca é escrita em logs.
 * - É idempotente: pode rodar a cada inicialização do serviço.
 */
export async function ensureSuperAdminFromEnv(logger?: BootstrapLogger) {
  const email = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || '');
  const name = String(process.env.SUPER_ADMIN_NAME || 'Super Admin GlossFlow').trim() || 'Super Admin GlossFlow';

  if (!email && !password) {
    logger?.info('Super Admin automático não configurado; SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD ausentes.');
    return { configured: false as const };
  }

  if (!email || !password) {
    throw new Error('Configure SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD juntos.');
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('SUPER_ADMIN_EMAIL inválido.');
  }

  if (password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'SUPER_ADMIN') {
    throw new Error(`O e-mail ${email} já pertence a um usuário de salão. Use outro e-mail para o Super Admin.`);
  }

  const platformSalon = await prisma.salon.upsert({
    where: { slug: 'glossflow-platform' },
    update: { name: 'GlossFlow Platform' },
    create: {
      slug: 'glossflow-platform',
      name: 'GlossFlow Platform',
      description: 'Tenant técnico reservado à administração global da plataforma GlossFlow.',
      phone: '0000000000',
      whatsapp: '',
      address: 'Plataforma GlossFlow',
      openingHours: '24/7',
      instagram: '',
      heroImage: ''
    }
  });

  if (existing) {
    const passwordMatches = await bcrypt.compare(password, existing.password);
    const needsUpdate = !passwordMatches
      || existing.name !== name
      || existing.role !== 'SUPER_ADMIN'
      || !existing.active
      || existing.salonId !== platformSalon.id;

    if (needsUpdate) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          role: 'SUPER_ADMIN',
          active: true,
          salonId: platformSalon.id,
          ...(!passwordMatches ? { password: await bcrypt.hash(password, 12) } : {})
        }
      });
    }

    logger?.info(`Super Admin garantido: ${email}`);
    return { configured: true as const, created: false as const, email };
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role: 'SUPER_ADMIN',
      active: true,
      salonId: platformSalon.id
    }
  });

  logger?.info(`Super Admin criado automaticamente: ${email}`);
  logger?.warn('A senha do Super Admin não é exibida. Mantenha SUPER_ADMIN_PASSWORD protegida no provedor.');
  return { configured: true as const, created: true as const, email };
}
