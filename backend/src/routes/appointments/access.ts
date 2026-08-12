import { cancellationMinHours } from '../../services/appointment-notification.service';
import { enforceSalonModuleAccess } from '../../services/module-access.service';
import { ensureAuthenticated, requireRoles } from '../../middlewares/auth';

export const adminAgendaAccess = {
  preHandler: [ensureAuthenticated, requireRoles(['ADMIN', 'RECEPTION', 'PROFESSIONAL']), enforceSalonModuleAccess]
};

export function cancellationWindow(startTime: Date) {
  const minHours = cancellationMinHours();
  const cancelUntil = new Date(startTime.getTime() - minHours * 60 * 60_000);
  return { minHours, cancelUntil, canCancel: Date.now() <= cancelUntil.getTime() };
}
