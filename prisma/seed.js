const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.backupJob.deleteMany();
  await prisma.lgpdConsent.deleteMany();
  await prisma.loyaltyEntry.deleteMany();
  await prisma.loyaltyProgram.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.financialEntry.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryProduct.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.whatsAppTemplate.deleteMany();
  await prisma.aiSuggestion.deleteMany();
  await prisma.portfolioItem.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.service.deleteMany();
  await prisma.salonSubscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.user.deleteMany();
  await prisma.salon.deleteMany();

  const salon = await prisma.salon.create({
    data: {
      slug: 'glossflow',
      name: 'GlossFlow Studio',
      description: 'Salão premium especializado em beleza, coloração, tratamentos e experiência personalizada.',
      phone: '11999999999',
      whatsapp: '5511999999999',
      address: 'Rua das Flores, 120 - São Paulo/SP',
      openingHours: 'Segunda a sábado, 9h às 19h',
      instagram: '@glossflow.studio',
      heroImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1600&auto=format&fit=crop'
    }
  });

  const admin = await prisma.user.create({
    data: { name: 'Admin GlossFlow', email: 'admin@glossflow.com', password: await bcrypt.hash('123456', 10), role: 'ADMIN', salonId: salon.id }
  });

  const [roberta, carla, ana] = await Promise.all([
    prisma.professional.create({ data: { name: 'Roberta Lima', specialty: 'Coloração e mechas', bio: 'Especialista em transformação de cor e diagnóstico capilar.', photoUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=900&auto=format&fit=crop', salonId: salon.id } }),
    prisma.professional.create({ data: { name: 'Carla Mendes', specialty: 'Cortes e finalização', bio: 'Foco em cortes modernos, escovas e experiência premium.', photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=900&auto=format&fit=crop', salonId: salon.id } }),
    prisma.professional.create({ data: { name: 'Ana Souza', specialty: 'Tratamentos', bio: 'Especialista em cronograma capilar e reconstrução.', photoUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=900&auto=format&fit=crop', salonId: salon.id } })
  ]);

  const services = await Promise.all([
    prisma.service.create({ data: { name: 'Escova Progressiva', description: 'Alinhamento capilar com diagnóstico profissional.', price: 180, durationMin: 120, imageUrl: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?q=80&w=900&auto=format&fit=crop', salonId: salon.id } }),
    prisma.service.create({ data: { name: 'Corte Feminino', description: 'Corte personalizado conforme rosto, estilo e rotina.', price: 85, durationMin: 60, imageUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=900&auto=format&fit=crop', salonId: salon.id } }),
    prisma.service.create({ data: { name: 'Mechas Premium', description: 'Iluminação sofisticada com acabamento natural.', price: 320, durationMin: 180, imageUrl: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=900&auto=format&fit=crop', salonId: salon.id } }),
    prisma.service.create({ data: { name: 'Hidratação Profunda', description: 'Tratamento para brilho, maciez e reposição de água.', price: 95, durationMin: 45, imageUrl: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?q=80&w=900&auto=format&fit=crop', salonId: salon.id } })
  ]);

  await prisma.portfolioItem.createMany({ data: [
    { title: 'Loiro iluminado', category: 'Mechas', description: 'Resultado natural com contraste suave.', imageUrl: services[2].imageUrl, salonId: salon.id },
    { title: 'Finalização premium', category: 'Escova', description: 'Brilho e movimento para evento especial.', imageUrl: services[0].imageUrl, salonId: salon.id },
    { title: 'Corte moderno', category: 'Corte', description: 'Novo visual com acabamento profissional.', imageUrl: services[1].imageUrl, salonId: salon.id }
  ]});

  const client = await prisma.client.create({ data: { name: 'Juliana Alencar', phone: '11988887777', email: 'juliana@email.com', preferences: 'Prefere horários à tarde.', salonId: salon.id } });

  await prisma.appointment.create({ data: {
    clientName: client.name, clientPhone: client.phone, clientEmail: client.email, clientId: client.id,
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
    status: 'CONFIRMED', salonId: salon.id, serviceId: services[0].id, professionalId: roberta.id
  }});

  const product = await prisma.inventoryProduct.create({ data: { name: 'Shampoo Premium', category: 'Tratamento', supplier: 'Beauty Pro', unit: 'un', quantity: 12, minimumQuantity: 4, costPrice: 32, salePrice: 59, salonId: salon.id } });
  await prisma.inventoryMovement.create({ data: { type: 'IN', quantity: 12, reason: 'Estoque inicial', productId: product.id, salonId: salon.id } });

  await prisma.financialEntry.createMany({ data: [
    { type: 'REVENUE', category: 'Serviços', description: 'Receita de atendimentos', amount: 2450, paymentMethod: 'PIX', referenceDate: new Date(), salonId: salon.id },
    { type: 'EXPENSE', category: 'Produtos', description: 'Reposição de estoque', amount: 620, paymentMethod: 'Cartão', referenceDate: new Date(), salonId: salon.id }
  ]});

  await prisma.commissionRule.create({ data: { professionalId: roberta.id, percentage: 40, notes: 'Regra padrão para serviços técnicos.', salonId: salon.id } });
  await prisma.loyaltyProgram.create({ data: { name: 'Clube GlossFlow', pointsPerCurrency: 1, rewardDescription: 'A cada 1000 pontos, cliente ganha R$ 50 de desconto.', salonId: salon.id } });
  await prisma.loyaltyEntry.create({ data: { clientId: client.id, type: 'EARN', points: 180, reason: 'Pontuação inicial por atendimento.', salonId: salon.id } });

  const trial = await prisma.subscriptionPlan.create({ data: { name: 'Trial', price: 0, maxUsers: 2, maxSalons: 1, features: 'Teste por 14 dias, vitrine, agenda e cadastros essenciais.' } });
  await prisma.subscriptionPlan.createMany({ data: [
    { name: 'Start', price: 79, maxUsers: 3, maxSalons: 1, features: 'Agenda, serviços, profissionais, estoque básico e vitrine.' },
    { name: 'Profissional', price: 149, maxUsers: 8, maxSalons: 1, features: 'CRM, financeiro, comissões, fidelidade, automações e dashboard executivo.' },
    { name: 'Enterprise', price: 299, maxUsers: 25, maxSalons: 5, features: 'Multiunidades, segurança corporativa, IA conectada, PWA e auditoria.' }
  ]});
  await prisma.salonSubscription.create({ data: { salonId: salon.id, planId: trial.id, status: 'TRIAL', endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } });

  await prisma.whatsAppTemplate.createMany({ data: [
    { name: 'Confirmação de agendamento', event: 'APPOINTMENT_CREATED', message: 'Olá {nome}! Seu horário para {servico} foi confirmado para {data} às {hora}.', salonId: salon.id },
    { name: 'Lembrete 24h', event: 'REMINDER', message: 'Oi {nome}, passando para lembrar do seu horário amanhã às {hora}.', salonId: salon.id }
  ]});

  await prisma.aiSuggestion.createMany({ data: [
    { title: 'Campanha de retorno', content: 'Clientes sem retorno há mais de 30 dias devem receber uma oferta personalizada.', category: 'CRM', priority: 'HIGH', salonId: salon.id },
    { title: 'Reposição inteligente', content: 'Monitore produtos abaixo do mínimo antes dos fins de semana.', category: 'ESTOQUE', priority: 'MEDIUM', salonId: salon.id }
  ]});

  await prisma.lgpdConsent.create({ data: { clientId: client.id, type: 'MARKETING_WHATSAPP', granted: true, evidence: 'Consentimento demonstrativo registrado no seed.', salonId: salon.id } });
  await prisma.auditLog.create({ data: { action: 'SEED', resource: 'database', method: 'SYSTEM', path: 'prisma/seed.js', userId: admin.id, salonId: salon.id, metadata: { version: 'v9.4' } } });
  await prisma.backupJob.create({ data: { kind: 'SEED', status: 'COMPLETED', summary: 'Snapshot inicial de demonstração criado com sucesso.', salonId: salon.id } });

  console.log('✅ Banco populado com dados de demonstração v9.4.');
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
