import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';

function money(value: unknown) {
  return Number(value || 0);
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

type RankingItem = { name: string; appointments: number; revenue: number };

/** Métricas avançadas preservando os tipos inferidos pelo Prisma. */
export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/admin/analytics/advanced', async (request) => {
    const tenant = getTenant(request);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const nextMonth = endOfMonth(now);
    const last90 = new Date(now);
    last90.setDate(now.getDate() - 90);
    const last30 = new Date(now);
    last30.setDate(now.getDate() - 30);

    const [appointments, financialEntries, clients, inventory, professionals, services] = await Promise.all([
      prisma.appointment.findMany({
        where: { salonId: tenant.salonId },
        include: { service: true, professional: true, client: true },
        orderBy: { startTime: 'desc' }
      }),
      prisma.financialEntry.findMany({ where: { salonId: tenant.salonId }, orderBy: { referenceDate: 'desc' } }),
      prisma.client.findMany({ where: { salonId: tenant.salonId } }),
      prisma.inventoryProduct.findMany({ where: { salonId: tenant.salonId, active: true } }),
      prisma.professional.findMany({ where: { salonId: tenant.salonId, active: true } }),
      prisma.service.findMany({ where: { salonId: tenant.salonId, active: true } })
    ]);

    const monthRevenue = financialEntries
      .filter((entry) => entry.type === 'REVENUE' && entry.referenceDate >= monthStart && entry.referenceDate < nextMonth)
      .reduce((sum, entry) => sum + money(entry.amount), 0);
    const monthExpenses = financialEntries
      .filter((entry) => entry.type === 'EXPENSE' && entry.referenceDate >= monthStart && entry.referenceDate < nextMonth)
      .reduce((sum, entry) => sum + money(entry.amount), 0);
    const totalRevenue = financialEntries.filter((entry) => entry.type === 'REVENUE').reduce((sum, entry) => sum + money(entry.amount), 0);

    const appointments90 = appointments.filter((item) => item.startTime >= last90);
    const appointments30 = appointments.filter((item) => item.startTime >= last30);
    const completed = appointments.filter((item) => ['COMPLETED', 'CONFIRMED'].includes(item.status));
    const totalServiceRevenue = completed.reduce((sum, item) => sum + money(item.service?.price), 0);
    const averageTicket = completed.length ? totalServiceRevenue / completed.length : 0;

    const customerKey = (appointment: (typeof appointments)[number]) => appointment.clientId || appointment.clientPhone || appointment.clientName;
    const clientFrequency = appointments.reduce<Record<string, number>>((acc, appointment) => {
      const key = customerKey(appointment);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const uniqueClients = Object.keys(clientFrequency).length;
    const recurringClients = Object.values(clientFrequency).filter((count) => count > 1).length;
    const retentionRate = uniqueClients ? Math.round((recurringClients / uniqueClients) * 100) : 0;

    const activeKeys30 = new Set(appointments30.map(customerKey).filter(Boolean));
    const activeKeys90 = new Set(appointments90.map(customerKey).filter(Boolean));
    const churnRiskClients = [...activeKeys90].filter((key) => !activeKeys30.has(key)).length;
    const churnRiskRate = activeKeys90.size ? Math.round((churnRiskClients / activeKeys90.size) * 100) : 0;

    const daysPassed = Math.max(1, now.getDate());
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const revenueForecast = Math.round((monthRevenue / daysPassed) * daysInMonth);
    const profit = monthRevenue - monthExpenses;
    const estimatedVisitsPerClient = uniqueClients ? completed.length / uniqueClients : 0;
    const estimatedLtv = averageTicket * Math.max(1, estimatedVisitsPerClient) * 6;

    const workingDays = daysBetween(monthStart, nextMonth);
    const capacity = Math.max(1, professionals.length * 9 * workingDays);
    const occupied = appointments.filter((item) => item.startTime >= monthStart && item.startTime < nextMonth).length;
    const occupancyRate = Math.min(100, Math.round((occupied / capacity) * 100));

    const serviceRanking = Object.values(appointments.reduce<Record<string, RankingItem>>((acc, appointment) => {
      const name = appointment.service?.name || 'Serviço não informado';
      const item = acc[name] || { name, appointments: 0, revenue: 0 };
      item.appointments += 1;
      item.revenue += money(appointment.service?.price);
      acc[name] = item;
      return acc;
    }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    const professionalRanking = Object.values(appointments.reduce<Record<string, RankingItem>>((acc, appointment) => {
      const name = appointment.professional?.name || 'Profissional não informado';
      const item = acc[name] || { name, appointments: 0, revenue: 0 };
      item.appointments += 1;
      item.revenue += money(appointment.service?.price);
      acc[name] = item;
      return acc;
    }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    const lowStock = inventory.filter((item) => Number(item.quantity || 0) <= Number(item.minimumQuantity || 0));
    const inventoryValue = inventory.reduce((sum, item) => sum + money(item.costPrice) * Number(item.quantity || 0), 0);

    const score = Math.max(0, Math.min(100,
      45 +
      (retentionRate >= 40 ? 15 : retentionRate / 3) +
      (occupancyRate >= 50 ? 15 : occupancyRate / 4) +
      (profit > 0 ? 15 : 0) -
      (churnRiskRate > 40 ? 10 : 0) -
      Math.min(10, lowStock.length)
    ));

    return {
      period: { from: monthStart.toISOString(), to: nextMonth.toISOString(), generatedAt: now.toISOString() },
      kpis: {
        monthRevenue,
        monthExpenses,
        profit,
        revenueForecast,
        totalRevenue,
        averageTicket,
        retentionRate,
        churnRiskRate,
        churnRiskClients,
        occupancyRate,
        estimatedLtv: Math.round(estimatedLtv),
        activeClients30d: activeKeys30.size,
        clientsTotal: clients.length,
        servicesTotal: services.length,
        professionalsTotal: professionals.length,
        lowStockCount: lowStock.length,
        inventoryValue: Math.round(inventoryValue),
        businessScore: Math.round(score)
      },
      rankings: { services: serviceRanking, professionals: professionalRanking },
      alerts: [
        lowStock.length ? `${lowStock.length} produto(s) estão abaixo do estoque mínimo.` : 'Estoque saudável nos produtos ativos.',
        churnRiskRate > 35 ? 'Há risco de perda de clientes. Crie campanha de retorno para os últimos 90 dias.' : 'Risco de churn controlado para a base recente.',
        occupancyRate < 35 ? 'Ocupação baixa. Considere promoções em horários ociosos.' : 'Ocupação dentro de uma faixa comercial interessante.',
        profit < 0 ? 'Despesas acima da receita no mês. Revise custos fixos e comissões.' : 'Lucro operacional positivo no mês.'
      ],
      opportunities: [
        'Oferecer pacote mensal para clientes recorrentes.',
        'Criar campanha para clientes que não voltam há 30 dias.',
        'Dar destaque na vitrine aos serviços com maior ticket médio.',
        'Usar WhatsApp para confirmação automática 24h antes do atendimento.'
      ]
    };
  });
}
