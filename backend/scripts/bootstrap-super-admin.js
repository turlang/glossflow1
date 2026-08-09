require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} é obrigatório.`);
  return value;
}

async function main() {
  const email = required('SUPER_ADMIN_EMAIL').toLowerCase();
  const password = required('SUPER_ADMIN_PASSWORD');
  const name = String(process.env.SUPER_ADMIN_NAME || 'Super Admin GlossFlow').trim();

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

  const passwordHash = await bcrypt.hash(password, 12);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, password: passwordHash, role: 'SUPER_ADMIN', active: true, salonId: platformSalon.id }
      })
    : await prisma.user.create({
        data: { name, email, password: passwordHash, role: 'SUPER_ADMIN', active: true, salonId: platformSalon.id }
      });

  console.log(`✅ Super Admin configurado: ${user.email}`);
  console.log('🔐 Nenhuma senha foi exibida. Guarde a credencial em um gerenciador de senhas.');
}

main()
  .catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
