import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Instância única do Prisma Client.
 * Centralizar a conexão evita múltiplos pools em desenvolvimento com hot reload.
 */
export const prisma = new PrismaClient();
