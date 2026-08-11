import { FastifyInstance } from 'fastify';
import { publicAppointmentRoutes } from './appointments/public.routes';
import { managementAppointmentRoutes } from './appointments/management.routes';
import { waitlistAppointmentRoutes } from './appointments/waitlist.routes';
import { adminAppointmentRoutes } from './appointments/admin.routes';

/** Agregador do domínio Agenda; URLs públicas permanecem inalteradas. */
export async function appointmentRoutes(app: FastifyInstance) {
  await app.register(publicAppointmentRoutes);
  await app.register(managementAppointmentRoutes);
  await app.register(waitlistAppointmentRoutes);
  await app.register(adminAppointmentRoutes);
}
