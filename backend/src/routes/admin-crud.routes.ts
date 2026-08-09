import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import { inventoryMovementSchema, inventoryProductSchema, objectIdSchema, portfolioSchema, professionalSchema, salonSchema, serviceSchema, userSchema } from './schemas';
import { z } from 'zod';

function requireRouteRoles(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenant = getTenant(request);
    if (!roles.includes(tenant.role)) {
      return reply.status(403).send({ message: 'Permissão insuficiente para esta operação.' });
    }
  };
}

const adminOnly = { preHandler: requireRouteRoles(['ADMIN']) };
const adminOrReception = { preHandler: requireRouteRoles(['ADMIN', 'RECEPTION']) };

/**
 * Rotas administrativas de CRUD.
 * Cada consulta usa salonId vindo do token para garantir isolamento multi-tenant.
 */
export async function adminCrudRoutes(app: FastifyInstance) {
  app.put('/admin/salon', adminOnly, async (request) => {
    const tenant = getTenant(request);
    const data = salonSchema.parse(request.body);
    return prisma.salon.update({ where: { id: tenant.salonId }, data });
  });

  app.get('/admin/users', adminOnly, async (request) => {
    const tenant = getTenant(request);
    return prisma.user.findMany({ where: { salonId: tenant.salonId }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } });
  });

  app.post('/admin/users', adminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const data = userSchema.parse(request.body);
    if (!data.password) {
      return reply.status(400).send({ message: 'Defina uma senha temporária segura para o novo usuário.' });
    }
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, role: data.role, active: data.active, password: await bcrypt.hash(data.password, 10), salonId: tenant.salonId }
    });
    return reply.status(201).send({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active });
  });

  app.put('/admin/users/:id', adminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = userSchema.parse(request.body);
    const updateData: any = { name: data.name, email: data.email, role: data.role, active: data.active };
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);
    const result = await prisma.user.updateMany({ where: { id, salonId: tenant.salonId }, data: updateData });
    if (result.count === 0) return reply.status(404).send({ message: 'Usuário não encontrado neste salão.' });
    const user = await prisma.user.findFirst({ where: { id, salonId: tenant.salonId } });
    if (!user) return reply.status(404).send({ message: 'Usuário não encontrado neste salão.' });
    return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
  });

  app.delete('/admin/users/:id', adminOnly, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    if (id === tenant.id) return reply.status(400).send({ message: 'Você não pode desativar o próprio usuário.' });
    const result = await prisma.user.updateMany({ where: { id, salonId: tenant.salonId }, data: { active: false } });
    if (result.count === 0) return reply.status(404).send({ message: 'Usuário não encontrado neste salão.' });
    return reply.status(204).send();
  });

  app.post('/admin/services', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const data = serviceSchema.parse(request.body);
    return reply.status(201).send(await prisma.service.create({ data: { ...data, salonId: tenant.salonId } }));
  });

  app.put('/admin/services/:id', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.service.updateMany({ where: { id, salonId: tenant.salonId }, data: serviceSchema.parse(request.body) });
    if (result.count === 0) return reply.status(404).send({ message: 'Serviço não encontrado neste salão.' });
    return prisma.service.findFirst({ where: { id, salonId: tenant.salonId } });
  });

  app.delete('/admin/services/:id', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.service.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Serviço não encontrado neste salão.' });
    return reply.status(204).send();
  });

  app.post('/admin/professionals', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const data = professionalSchema.parse(request.body);
    return reply.status(201).send(await prisma.professional.create({ data: { ...data, salonId: tenant.salonId } }));
  });

  app.put('/admin/professionals/:id', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.professional.updateMany({ where: { id, salonId: tenant.salonId }, data: professionalSchema.parse(request.body) });
    if (result.count === 0) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    return prisma.professional.findFirst({ where: { id, salonId: tenant.salonId } });
  });

  app.delete('/admin/professionals/:id', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.professional.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Profissional não encontrado neste salão.' });
    return reply.status(204).send();
  });

  app.post('/admin/portfolio', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const data = portfolioSchema.parse(request.body);
    return reply.status(201).send(await prisma.portfolioItem.create({ data: { ...data, salonId: tenant.salonId } }));
  });

  app.put('/admin/portfolio/:id', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.portfolioItem.updateMany({ where: { id, salonId: tenant.salonId }, data: portfolioSchema.parse(request.body) });
    if (result.count === 0) return reply.status(404).send({ message: 'Item de portfólio não encontrado neste salão.' });
    return prisma.portfolioItem.findFirst({ where: { id, salonId: tenant.salonId } });
  });

  app.delete('/admin/portfolio/:id', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.portfolioItem.deleteMany({ where: { id, salonId: tenant.salonId } });
    if (result.count === 0) return reply.status(404).send({ message: 'Item de portfólio não encontrado neste salão.' });
    return reply.status(204).send();
  });

  app.get('/admin/inventory', adminOrReception, async (request) => {
    const tenant = getTenant(request);
    return prisma.inventoryProduct.findMany({ where: { salonId: tenant.salonId }, include: { movements: { orderBy: { createdAt: 'desc' }, take: 20 } }, orderBy: { name: 'asc' } });
  });

  app.post('/admin/inventory', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const data = inventoryProductSchema.parse(request.body);
    const product = await prisma.inventoryProduct.create({ data: { ...data, salonId: tenant.salonId } });
    if (product.quantity > 0) {
      await prisma.inventoryMovement.create({ data: { type: 'IN', quantity: product.quantity, reason: 'Estoque inicial cadastrado no painel administrativo.', productId: product.id, salonId: tenant.salonId } });
    }
    return reply.status(201).send(product);
  });

  app.put('/admin/inventory/:id', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = inventoryProductSchema.parse(request.body);
    const current = await prisma.inventoryProduct.findFirst({ where: { id, salonId: tenant.salonId } });
    if (!current) return reply.status(404).send({ message: 'Produto não encontrado neste salão.' });

    const quantityChanged = data.quantity !== current.quantity;
    const operations = [
      prisma.inventoryProduct.updateMany({
        where: { id, salonId: tenant.salonId },
        data
      })
    ];

    if (quantityChanged) {
      operations.push(prisma.inventoryMovement.create({
        data: {
          type: 'ADJUSTMENT',
          quantity: data.quantity,
          reason: `Ajuste pelo cadastro do produto. Saldo anterior: ${current.quantity}; novo saldo: ${data.quantity}.`,
          productId: id,
          salonId: tenant.salonId
        }
      }) as any);
    }

    await prisma.$transaction(operations as any);
    return prisma.inventoryProduct.findFirst({ where: { id, salonId: tenant.salonId }, include: { movements: { orderBy: { createdAt: 'desc' }, take: 20 } } });
  });

  /**
   * Produtos não são apagados fisicamente porque as movimentações compõem o
   * histórico operacional. DELETE funciona como desativação segura.
   */
  app.delete('/admin/inventory/:id', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const result = await prisma.inventoryProduct.updateMany({ where: { id, salonId: tenant.salonId }, data: { active: false } });
    if (result.count === 0) return reply.status(404).send({ message: 'Produto não encontrado neste salão.' });
    return reply.status(204).send();
  });

  app.post('/admin/inventory/movements', adminOrReception, async (request, reply) => {
    const tenant = getTenant(request);
    const data = inventoryMovementSchema.parse(request.body);
    const product = await prisma.inventoryProduct.findFirst({ where: { id: data.productId, salonId: tenant.salonId, active: true } });
    if (!product) return reply.status(404).send({ message: 'Produto ativo não encontrado no estoque.' });

    const nextQuantity = data.type === 'IN'
      ? product.quantity + data.quantity
      : data.type === 'OUT'
        ? product.quantity - data.quantity
        : data.quantity;

    if (nextQuantity < 0) return reply.status(400).send({ message: 'Movimentação inválida: estoque não pode ficar negativo.' });

    const movementData = data.type === 'ADJUSTMENT'
      ? { ...data, quantity: nextQuantity, salonId: tenant.salonId }
      : { ...data, salonId: tenant.salonId };

    const [movement] = await prisma.$transaction([
      prisma.inventoryMovement.create({ data: movementData }),
      prisma.inventoryProduct.updateMany({ where: { id: product.id, salonId: tenant.salonId }, data: { quantity: nextQuantity } })
    ]);
    const updatedProduct = await prisma.inventoryProduct.findFirst({ where: { id: product.id, salonId: tenant.salonId }, include: { movements: { orderBy: { createdAt: 'desc' }, take: 20 } } });
    return reply.status(201).send({ movement, product: updatedProduct });
  });
}
