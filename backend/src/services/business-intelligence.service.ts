import { z } from 'zod';
import { prisma } from '../lib/prisma';

/**
 * Inteligência executiva do salão. Regras locais são sempre suficientes para
 * operar; OpenAI continua opcional e nunca pode quebrar a resposta do painel.
 */
export async function answerBusinessQuestion(salonId: string, question: string) {
  const [appointments, inventory, clients, financialEntries, services, professionals] = await Promise.all([
    prisma.appointment.findMany({ where: { salonId }, include: { service: true, professional: true } }),
    prisma.inventoryProduct.findMany({ where: { salonId } }),
    prisma.client.findMany({ where: { salonId } }),
    prisma.financialEntry.findMany({ where: { salonId } }),
    prisma.service.findMany({ where: { salonId } }),
    prisma.professional.findMany({ where: { salonId } })
  ]);

  const normalized = question.toLowerCase();
  const revenue = financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = financialEntries.filter((entry) => entry.type === 'EXPENSE').reduce((sum, entry) => sum + entry.amount, 0);
  const profit = revenue - expenses;
  const lowStock = inventory.filter((item) => item.quantity <= item.minimumQuantity);
  const appointmentsValue = appointments.reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
  const averageTicket = appointments.length ? appointmentsValue / appointments.length : 0;
  const topService = [...services].sort((a, b) => Number(b.price || 0) - Number(a.price || 0))[0];

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
      profit < 0
        ? '• Atenção: despesas superaram receitas. Revise custos, comissões e promoções.'
        : '• Recomendação: criar metas semanais e promover serviços acima do ticket médio.'
    ].join('\n');
  } else if (normalized.includes('produto') || normalized.includes('estoque') || normalized.includes('reposição')) {
    answer = [
      'Análise de estoque:',
      `• Produtos monitorados: ${inventory.length}.`,
      `• Produtos em alerta: ${lowStock.length}.`,
      lowStock.length ? `• Prioridade: ${lowStock.slice(0, 3).map((item) => item.name).join(', ')}.` : '• Nenhum produto abaixo do mínimo agora.',
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
    const ranking = professionals
      .map((professional) => {
        const total = appointments
          .filter((appointment) => appointment.professionalId === professional.id)
          .reduce((sum, appointment) => sum + Number(appointment.service?.price || 0), 0);
        return { name: professional.name, total };
      })
      .sort((a, b) => b.total - a.total);
    answer = [
      'Análise por profissional:',
      ...ranking.slice(0, 5).map((item, index) => `• ${index + 1}. ${item.name}: R$ ${item.total.toFixed(2)} em agenda.`),
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
        lowStock: lowStock.map((item) => item.name).slice(0, 8)
      };
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.35,
          messages: [
            {
              role: 'system',
              content: 'Você é o assistente executivo do GlossFlow, um SaaS de gestão para salões de beleza. Responda em português do Brasil, com recomendações práticas, objetivas e baseadas nos dados fornecidos. Não invente dados ausentes.'
            },
            { role: 'user', content: `Pergunta: ${question}\n\nDados resumidos do salão: ${JSON.stringify(context)}` }
          ]
        })
      });
      if (aiResponse.ok) {
        const rawResponse: unknown = await aiResponse.json();
        const parsedResponse = z.object({
          choices: z.array(z.object({
            message: z.object({ content: z.string().optional().nullable() })
          })).optional().default([])
        }).safeParse(rawResponse);
        const connectedAnswer = parsedResponse.success
          ? parsedResponse.data.choices[0]?.message.content?.trim()
          : undefined;
        if (connectedAnswer) answer = connectedAnswer;
      }
    } catch {
      // Fallback silencioso preserva a inteligência local já calculada.
    }
  }

  return {
    question,
    answer,
    generatedAt: new Date().toISOString(),
    source: process.env.OPENAI_API_KEY ? 'OpenAI + GlossFlow Context' : 'GlossFlow Local Intelligence'
  };
}

export async function buildBusinessInsights(salonId: string) {
  const [appointments, inventory, clients, financialEntries, saved] = await Promise.all([
    prisma.appointment.findMany({ where: { salonId }, include: { service: true } }),
    prisma.inventoryProduct.findMany({ where: { salonId } }),
    prisma.client.findMany({ where: { salonId } }),
    prisma.financialEntry.findMany({ where: { salonId } }),
    prisma.aiSuggestion.findMany({ where: { salonId, resolved: false }, orderBy: { createdAt: 'desc' } })
  ]);

  const lowStock = inventory.filter((item) => item.quantity <= item.minimumQuantity);
  const revenue = financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = financialEntries.filter((entry) => entry.type === 'EXPENSE').reduce((sum, entry) => sum + entry.amount, 0);

  const suggestions = [
    lowStock.length ? {
      title: 'Reposição de estoque',
      category: 'Estoque',
      priority: 'HIGH',
      content: `${lowStock.length} produto(s) estão no limite mínimo. Priorize reposição antes dos próximos atendimentos.`
    } : null,
    appointments.length < 8 ? {
      title: 'Campanha para horários vagos',
      category: 'Marketing',
      priority: 'MEDIUM',
      content: 'A agenda ainda tem espaço. Crie uma promoção de baixa demanda e envie por WhatsApp para clientes recentes.'
    } : null,
    clients.length < 20 ? {
      title: 'Base de clientes pequena',
      category: 'CRM',
      priority: 'MEDIUM',
      content: 'Cadastre clientes atendidos manualmente para criar histórico, fidelidade e campanhas futuras.'
    } : null,
    revenue - expenses < 0 ? {
      title: 'Margem negativa',
      category: 'Financeiro',
      priority: 'HIGH',
      content: 'As despesas superaram receitas registradas. Revise custos de produto, comissão e promoções.'
    } : null
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return { saved, suggestions };
}
