import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { getTenant } from './helpers';
import { inventoryMovementSchema, inventoryProductSchema, objectIdSchema, portfolioSchema, professionalSchema, salonSchema, serviceSchema, userSchema } from './schemas';
import { z } from 'zod';

/**
 * Rotas administrativas de CRUD.
 * Cada consulta usa salonId vindo do token para garantir isolamento multi-tenant.
 */
export async function adminCrudRoutes(app: FastifyInstance) {
  app.put('/admin/salon', async (request) => {
    const tenant = getTenant(request);
    const data = salonSchema.parse(request.body);
    return prisma.salon.update({ where: { id: tenant.salonId }, data });
  });

  app.get('/admin/users', async (request) => {
    const tenant = getTenant(request);
    return prisma.user.findMany({ where: { salonId: tenant.salonId }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } });
  });

  app.post('/admin/users', async (request, reply) => {
    const tenant = getTenant(request);
    const data = userSchema.parse(request.body);
    const password = data.password || '123456';
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, role: data.role, active: data.active, password: await bcrypt.hash(password, 10), salonId: tenant.salonId }
    });
    return reply.status(201).send({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active });
  });

  app.put('/admin/users/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    const data = userSchema.parse(request.body);
    const updateData: any = { name: data.name, email: data.email, role: data.role, active: data.active };
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.update({ where: { id }, data: updateData });
    return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
  });

  app.delete('/admin/users/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.user.update({ where: { id }, data: { active: false } });
  });

  app.post('/admin/services', async (request, reply) => {
    const tenant = getTenant(request);
    const data = serviceSchema.parse(request.body);
    return reply.status(201).send(await prisma.service.create({ data: { ...data, salonId: tenant.salonId } }));
  });
  app.put('/admin/services/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.service.update({ where: { id }, data: serviceSchema.parse(request.body) });
  });
  app.delete('/admin/services/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.service.delete({ where: { id } });
  });

  app.post('/admin/professionals', async (request, reply) => {
    const tenant = getTenant(request);
    const data = professionalSchema.parse(request.body);
    return reply.status(201).send(await prisma.professional.create({ data: { ...data, salonId: tenant.salonId } }));
  });
  app.put('/admin/professionals/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.professional.update({ where: { id }, data: professionalSchema.parse(request.body) });
  });
  app.delete('/admin/professionals/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.professional.delete({ where: { id } });
  });

  app.post('/admin/portfolio', async (request, reply) => {
    const tenant = getTenant(request);
    const data = portfolioSchema.parse(request.body);
    return reply.status(201).send(await prisma.portfolioItem.create({ data: { ...data, salonId: tenant.salonId } }));
  });
  app.put('/admin/portfolio/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.portfolioItem.update({ where: { id }, data: portfolioSchema.parse(request.body) });
  });
  app.delete('/admin/portfolio/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.portfolioItem.delete({ where: { id } });
  });

  app.get('/admin/inventory', async (request) => {
    const tenant = getTenant(request);
    return prisma.inventoryProduct.findMany({ where: { salonId: tenant.salonId }, include: { movements: { orderBy: { createdAt: 'desc' }, take: 6 } }, orderBy: { name: 'asc' } });
  });

  app.post('/admin/inventory', async (request, reply) => {
    const tenant = getTenant(request);
    const data = inventoryProductSchema.parse(request.body);
    const product = await prisma.inventoryProduct.create({ data: { ...data, salonId: tenant.salonId } });
    if (product.quantity > 0) {
      await prisma.inventoryMovement.create({ data: { type: 'IN', quantity: product.quantity, reason: 'Estoque inicial cadastrado no painel administrativo.', productId: product.id, salonId: tenant.salonId } });
    }
    return reply.status(201).send(product);
  });

  app.put('/admin/inventory/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.inventoryProduct.update({ where: { id }, data: inventoryProductSchema.parse(request.body) });
  });

  app.delete('/admin/inventory/:id', async (request) => {
    const tenant = getTenant(request);
    const { id } = z.object({ id: objectIdSchema }).parse(request.params);
    return prisma.inventoryProduct.delete({ where: { id } });
  });

  app.post('/admin/inventory/movements', async (request, reply) => {
    const tenant = getTenant(request);
    const data = inventoryMovementSchema.parse(request.body);
    const product = await prisma.inventoryProduct.findFirst({ where: { id: data.productId, salonId: tenant.salonId } });
    if (!product) return reply.status(404).send({ message: 'Produto não encontrado no estoque.' });
    const nextQuantity = data.type === 'IN' ? product.quantity + data.quantity : data.type === 'OUT' ? product.quantity - data.quantity : data.quantity;
    if (nextQuantity < 0) return reply.status(400).send({ message: 'Movimentação inválida: estoque não pode ficar negativo.' });
    const [movement, updatedProduct] = await prisma.$transaction([
      prisma.inventoryMovement.create({ data: { ...data, salonId: tenant.salonId } }),
      prisma.inventoryProduct.update({ where: { id: product.id }, data: { quantity: nextQuantity } })
    ]);
    return reply.status(201).send({ movement, product: updatedProduct });
  });
}
