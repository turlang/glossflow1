import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import {
  clientSchema,
  commissionRuleSchema,
  financialEntrySchema,
  loyaltyEntrySchema,
  loyaltyProgramSchema,
  objectIdSchema,
  salonSubscriptionSchema,
  subscriptionPlanSchema,
  whatsappTemplateSchema
} from './schemas';

/**
 * Rotas SaaS Pro.
 * Centralizam módulos comerciais que transformam o projeto em uma base real de produto:
 * clientes, financeiro, comissões, fidelidade, comunicação, assinatura e insights.
 */
export async function businessRoutes(app: FastifyInstance) {
  app.get('/admin/clients', async (request) => {
    const tenant = getTenant(request);
    return prisma.client.findMany({
      where: { salonId: tenant.salonId },
      include: { loyaltyEntries: { orderBy: { createdAt: 'desc' }, take: 5 }, appointments: { orderBy: { startTime: 'desc' }, take: 5 } },
      orderBy: { name: 'asc' }
    });
  });

  app.post('/admin/clients', async (request, reply) => {
    const tenant = getTenant(request);
    const data = clientSchema.parse(request.body);
    return reply.status(201).send(await prisma.client.create({
      data: { ...data, email: data.email || null, birthDate: data.birthDate ? new Date(data.birthDate) : null, salonId: tenant.salonId }
    }));
  });

  app.put('/admin/clients/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = clientSchema.parse(request.body);
    const result = await prisma.client.updateMany({
      where: { id, salonId: tenant.salonId },
      data: { ...data, email: data.email || null, birthDate: data.birthDate ? new Date(data.birthDate) : null }
    });
    if (result.count === 0) return reply.status(404).send({ message: 'Cliente não encontrado neste salão.' });
    return prisma.client.findUnique({ where: { id } });
  });

  app.delete('/admin/clients/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.client.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Cliente não encontrado neste salão.' });
    return reply.status(204).send();
  });

  app.get('/admin/financial', async (request) => {
    const tenant = getTenant(request);
    return prisma.financialEntry.findMany({ where: { salonId: tenant.salonId }, orderBy: { referenceDate: 'desc' } });
  });

  app.post('/admin/financial', async (request, reply) => {
    const tenant = getTenant(request);
    const data = financialEntrySchema.parse(request.body);
    return reply.status(201).send(await prisma.financialEntry.create({
      data: { ...data, paymentMethod: data.paymentMethod || null, referenceDate: data.referenceDate ? new Date(data.referenceDate) : new Date(), salonId: tenant.salonId }
    }));
  });

  app.put('/admin/financial/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = financialEntrySchema.parse(request.body);
    const result = await prisma.financialEntry.updateMany({
      where: { id, salonId: tenant.salonId },
      data: { ...data, paymentMethod: data.paymentMethod || null, referenceDate: data.referenceDate ? new Date(data.referenceDate) : new Date() }
    });
    if (result.count === 0) return reply.status(404).send({ message: 'Lançamento financeiro não encontrado neste salão.' });
    return prisma.financialEntry.findUnique({ where: { id } });
  });

  app.delete('/admin/financial/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.financialEntry.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Lançamento financeiro não encontrado neste salão.' });
    return reply.status(204).send();
  });

  app.get('/admin/commissions', async (request) => {
    const tenant = getTenant(request);
    const [rules, appointments] = await Promise.all([
      prisma.commissionRule.findMany({ where: { salonId: tenant.salonId }, include: { professional: true }, orderBy: { createdAt: 'desc' } }),
      prisma.appointment.findMany({ where: { salonId: tenant.salonId, status: { in: ['CONFIRMED', 'COMPLETED'] } }, include: { service: true, professional: true } })
    ]);

    const projections = appointments.map((appointment: any) => {
      const rule = rules.find((item: any) => item.professionalId === appointment.professionalId && item.active);
      const percentage = rule?.percentage ?? 40;
      return { appointmentId: appointment.id, professional: appointment.professional.name, service: appointment.service.name, baseValue: appointment.service.price, percentage, commission: appointment.service.price * (percentage / 100), commissionPaid: appointment.commissionPaid };
    });

    return { rules, projections };
  });

  app.post('/admin/commissions/rules', async (request, reply) => {
    const tenant = getTenant(request);
    const data = commissionRuleSchema.parse(request.body);
    return reply.status(201).send(await prisma.commissionRule.create({ data: { ...data, salonId: tenant.salonId } }));
  });

  app.put('/admin/commissions/rules/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.commissionRule.updateMany({ where: { id, salonId: tenant.salonId }, data: commissionRuleSchema.parse(request.body) });
    if (result.count === 0) return reply.status(404).send({ message: 'Regra de comissão não encontrada neste salão.' });
    return prisma.commissionRule.findUnique({ where: { id } });
  });

  app.delete('/admin/commissions/rules/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.commissionRule.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Regra de comissão não encontrada neste salão.' });
    return reply.status(204).send();
  });

  app.get('/admin/loyalty', async (request) => {
    const tenant = getTenant(request);
    const [program, entries] = await Promise.all([
      prisma.loyaltyProgram.findUnique({ where: { salonId: tenant.salonId } }),
      prisma.loyaltyEntry.findMany({ where: { salonId: tenant.salonId }, include: { client: true }, orderBy: { createdAt: 'desc' } })
    ]);
    return { program, entries };
  });

  app.put('/admin/loyalty/program', async (request) => {
    const tenant = getTenant(request);
    const data = loyaltyProgramSchema.parse(request.body);
    return prisma.loyaltyProgram.upsert({ where: { salonId: tenant.salonId }, create: { ...data, salonId: tenant.salonId }, update: data });
  });

  app.post('/admin/loyalty/entries', async (request, reply) => {
    const tenant = getTenant(request);
    const data = loyaltyEntrySchema.parse(request.body);
    return reply.status(201).send(await prisma.loyaltyEntry.create({ data: { ...data, salonId: tenant.salonId } }));
  });

  app.get('/admin/subscription', async (request) => {
    const tenant = getTenant(request);
    const [plans, subscription] = await Promise.all([
      prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { price: 'asc' } }),
      prisma.salonSubscription.findUnique({ where: { salonId: tenant.salonId }, include: { plan: true } })
    ]);
    return { plans, subscription };
  });

  app.post('/admin/subscription/plans', async (request, reply) => {
    const data = subscriptionPlanSchema.parse(request.body);
    return reply.status(201).send(await prisma.subscriptionPlan.create({ data }));
  });

  app.put('/admin/subscription', async (request) => {
    const tenant = getTenant(request);
    const data = salonSubscriptionSchema.parse(request.body);
    return prisma.salonSubscription.upsert({
      where: { salonId: tenant.salonId },
      create: { ...data, endsAt: data.endsAt ? new Date(data.endsAt) : null, salonId: tenant.salonId },
      update: { ...data, endsAt: data.endsAt ? new Date(data.endsAt) : null }
    });
  });

  app.get('/admin/whatsapp/templates', async (request) => {
    const tenant = getTenant(request);
    return prisma.whatsAppTemplate.findMany({ where: { salonId: tenant.salonId }, orderBy: { event: 'asc' } });
  });

  app.post('/admin/whatsapp/templates', async (request, reply) => {
    const tenant = getTenant(request);
    const data = whatsappTemplateSchema.parse(request.body);
    return reply.status(201).send(await prisma.whatsAppTemplate.create({ data: { ...data, salonId: tenant.salonId } }));
  });

  app.put('/admin/whatsapp/templates/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = whatsappTemplateSchema.parse(request.body);
    const result = await prisma.whatsAppTemplate.updateMany({ where: { id, salonId: tenant.salonId }, data });
    if (result.count === 0) return reply.status(404).send({ error: 'Template não encontrado.' });
    return prisma.whatsAppTemplate.findUnique({ where: { id } });
  });

  app.delete('/admin/whatsapp/templates/:id', async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.whatsAppTemplate.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ error: 'Template não encontrado.' });
    return reply.status(204).send();
  });


  app.post('/admin/ai/assistant', async (request) => {
    const tenant = getTenant(request);
    const { question } = z.object({ question: z.string().min(3).max(500) }).parse(request.body);

    /**
     * Assistente IA operacional — implementação determinística local.
     * ------------------------------------------------------------------
     * Esta rota entrega valor sem depender de chave externa. Em produção,
     * este ponto pode ser conectado a OpenAI, filas, cache e auditoria.
     * Mantemos as análises sempre limitadas ao salonId do token.
     */
    const [appointments, inventory, clients, financialEntries, services, professionals] = await Promise.all([
      prisma.appointment.findMany({ where: { salonId: tenant.salonId }, include: { service: true, professional: true } }),
      prisma.inventoryProduct.findMany({ where: { salonId: tenant.salonId } }),
      prisma.client.findMany({ where: { salonId: tenant.salonId } }),
      prisma.financialEntry.findMany({ where: { salonId: tenant.salonId } }),
      prisma.service.findMany({ where: { salonId: tenant.salonId } }),
      prisma.professional.findMany({ where: { salonId: tenant.salonId } })
    ]);

    const normalized = question.toLowerCase();
    const revenue = financialEntries.filter((entry: any) => entry.type === 'REVENUE').reduce((sum: number, entry: any) => sum + entry.amount, 0);
    const expenses = financialEntries.filter((entry: any) => entry.type === 'EXPENSE').reduce((sum: number, entry: any) => sum + entry.amount, 0);
    const profit = revenue - expenses;
    const lowStock = inventory.filter((item: any) => item.quantity <= item.minimumQuantity);
    const appointmentsValue = appointments.reduce((sum: number, appointment: any) => sum + Number(appointment.service?.price || 0), 0);
    const averageTicket = appointments.length ? appointmentsValue / appointments.length : 0;
    const topService = [...services].sort((a: any, b: any) => Number(b.price || 0) - Number(a.price || 0))[0] as any;

    let answer: string;

    if (normalized.includes('cliente')) {
      answer = [
        'Análise de clientes:',
        `• Base atual: ${clients.length} cliente(s).`,
        '• Priorize clientes com maior recorrência, aniversariantes e clientes sem retorno recente.',
        `• Campanha sugerida: oferecer retorno para ${topService?.name || 'um serviço estratégico'} com mensagem personalizada.`,
        '• Próximo passo: enriquecer cadastro com aniversário, preferência e histórico.'
      ].join('\n');
    } else if (normalized.includes('fatur') || normalized.includes('lucro') || normalized.includes('financeiro')) {
      answer = [
        'Análise financeira:',
        `• Receita registrada: R$ ${revenue.toFixed(2)}.`,
        `• Despesas registradas: R$ ${expenses.toFixed(2)}.`,
        `• Resultado estimado: R$ ${profit.toFixed(2)}.`,
        `• Ticket médio da agenda: R$ ${averageTicket.toFixed(2)}.`,
        profit < 0 ? '• Atenção: despesas superaram receitas. Revise custos, comissões e promoções.' : '• Recomendação: criar metas semanais e promover serviços acima do ticket médio.'
      ].join('\n');
    } else if (normalized.includes('produto') || normalized.includes('estoque') || normalized.includes('reposição')) {
      answer = [
        'Análise de estoque:',
        `• Produtos monitorados: ${inventory.length}.`,
        `• Produtos em alerta: ${lowStock.length}.`,
        lowStock.length ? `• Prioridade: ${lowStock.slice(0, 3).map((item: any) => item.name).join(', ')}.` : '• Nenhum produto abaixo do mínimo agora.',
        '• Boa prática: vincular consumo de produto ao serviço para previsão automática.'
      ].join('\n');
    } else if (normalized.includes('campanha') || normalized.includes('promo')) {
      answer = [
        'Campanha sugerida:',
        '• Objetivo: preencher horários vagos e elevar ticket médio.',
        `• Serviço foco: ${topService?.name || 'serviço de maior margem'}.`,
        '• Mensagem: "Olá {nome}! Temos horários selecionados esta semana com condição especial. Quer reservar?"',
        '• Métrica: respostas, agendamentos criados e receita recuperada.'
      ].join('\n');
    } else if (normalized.includes('profissional')) {
      const ranking = professionals.map((professional: any) => {
        const total = appointments.filter((appointment: any) => appointment.professionalId === professional.id).reduce((sum: number, appointment: any) => sum + Number(appointment.service?.price || 0), 0);
        return { name: professional.name, total };
      }).sort((a: any, b: any) => b.total - a.total);
      answer = [
        'Análise por profissional:',
        ...ranking.slice(0, 5).map((item: any, index: number) => `• ${index + 1}. ${item.name}: R$ ${item.total.toFixed(2)} em agenda.`),
        '• Recomendação: compare ocupação, ticket médio e recorrência antes de definir metas.'
      ].join('\n');
    } else {
      answer = [
        'Resumo executivo:',
        `• Serviços ativos: ${services.length}.`,
        `• Profissionais cadastrados: ${professionals.length}.`,
        `• Agendamentos registrados: ${appointments.length}.`,
        `• Receita registrada: R$ ${revenue.toFixed(2)} e resultado estimado de R$ ${profit.toFixed(2)}.`,
        `• Estoque em alerta: ${lowStock.length} produto(s).`,
        '• Próxima ação: revisar horários vagos, ativar campanha de retorno e acompanhar ticket médio.'
      ].join('\n');
    }


    if (process.env.OPENAI_API_KEY) {
      try {
        const context = {
          services: services.length,
          professionals: professionals.length,
          appointments: appointments.length,
          clients: clients.length,
          revenue,
          expenses,
          profit,
          averageTicket,
          lowStock: lowStock.map((item: any) => item.name).slice(0, 8)
        };

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.35,
            messages: [
              { role: 'system', content: 'Você é o assistente executivo do GlossFlow, um SaaS de gestão para salões de beleza. Responda em português do Brasil, com recomendações práticas, objetivas e baseadas nos dados fornecidos. Não invente dados ausentes.' },
              { role: 'user', content: `Pergunta: ${question}\n\nDados resumidos do salão: ${JSON.stringify(context)}` }
            ]
          })
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json() as any;
          const connectedAnswer = data?.choices?.[0]?.message?.content?.trim();
          if (connectedAnswer) {
            answer = connectedAnswer;
          }
        }
      } catch {
        // Fallback silencioso: mantém a inteligência local para não quebrar a operação do salão.
      }
    }

    return {
      question,
      answer,
      generatedAt: new Date().toISOString(),
      source: process.env.OPENAI_API_KEY ? 'OpenAI + GlossFlow Context' : 'GlossFlow Local Intelligence'
    };
  });

  app.get('/admin/insights', async (request) => {
    const tenant = getTenant(request);
    const [appointments, inventory, clients, financialEntries, saved] = await Promise.all([
      prisma.appointment.findMany({ where: { salonId: tenant.salonId }, include: { service: true } }),
      prisma.inventoryProduct.findMany({ where: { salonId: tenant.salonId } }),
      prisma.client.findMany({ where: { salonId: tenant.salonId } }),
      prisma.financialEntry.findMany({ where: { salonId: tenant.salonId } }),
      prisma.aiSuggestion.findMany({ where: { salonId: tenant.salonId }, orderBy: { createdAt: 'desc' } })
    ]);

    const lowStock = inventory.filter((item: any) => item.quantity <= item.minimumQuantity);
    const revenue = financialEntries.filter((e: any) => e.type === 'REVENUE').reduce((sum: number, e: any) => sum + e.amount, 0);
    const expenses = financialEntries.filter((e: any) => e.type === 'EXPENSE').reduce((sum: number, e: any) => sum + e.amount, 0);

    const suggestions = [
      lowStock.length ? { title: 'Reposição de estoque', category: 'Estoque', priority: 'HIGH', content: `${lowStock.length} produto(s) estão no limite mínimo. Priorize reposição antes dos próximos atendimentos.` } : null,
      appointments.length < 8 ? { title: 'Campanha para horários vagos', category: 'Marketing', priority: 'MEDIUM', content: 'A agenda ainda tem espaço. Crie uma promoção de baixa demanda e envie por WhatsApp para clientes recentes.' } : null,
      clients.length < 20 ? { title: 'Base de clientes pequena', category: 'CRM', priority: 'MEDIUM', content: 'Cadastre clientes atendidos manualmente para criar histórico, fidelidade e campanhas futuras.' } : null,
      revenue - expenses < 0 ? { title: 'Margem negativa', category: 'Financeiro', priority: 'HIGH', content: 'As despesas superaram receitas registradas. Revise custos de produto, comissão e promoções.' } : null
    ].filter(Boolean);

    return { saved, suggestions };
  });
}
