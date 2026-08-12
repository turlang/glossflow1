import { cancellationMinHours } from '../../services/appointment-notification.service';
import { enforceSalonModuleAccess } from '../../services/module-access.service';
import { ensureAuthenticated, requireRoles } from '../../middlewares/auth';

/** Leitura da Agenda é permitida aos três papéis operacionais do tenant. */
export const agendaReadAccess = {
  preHandler: [ensureAuthenticated, requireRoles(['ADMIN', 'RECEPTION', 'PROFESSIONAL']), enforceSalonModuleAccess]
};

/** Mutações de Agenda permanecem restritas a administração e recepção. */
export const agendaManageAccess = {
  preHandler: [ensureAuthenticated, requireRoles(['ADMIN', 'RECEPTION']), enforceSalonModuleAccess]
};

/** Compatibilidade temporária para rotas de leitura que ainda importam o nome antigo. */
export const adminAgendaAccess = agendaReadAccess;

export function cancellationWindow(startTime: Date) {
  const minHours = cancellationMinHours();
  const cancelUntil = new Date(startTime.getTime() - minHours * 60 * 60_000);
  return { minHours, cancelUntil, canCancel: Date.now() <= cancelUntil.getTime() };
}
