import { lazy } from 'react';

function namedLazy(loader, exportName) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });
}

export const AdminDashboard = namedLazy(() => import('./admin/AdminDashboard.jsx'), 'AdminDashboard');
export const PlatformAdmin = namedLazy(() => import('./admin/PlatformAdmin.jsx'), 'PlatformAdmin');
export const WhatsAppAgentTester = namedLazy(() => import('./admin/WhatsAppAgentTester.jsx'), 'WhatsAppAgentTester');
export const ProfessionalCapabilitiesAdmin = namedLazy(() => import('./admin/ProfessionalCapabilitiesAdmin.jsx'), 'ProfessionalCapabilitiesAdmin');
export const ProfessionalScheduleAdmin = namedLazy(() => import('./admin/ProfessionalScheduleAdmin.jsx'), 'ProfessionalScheduleAdmin');
export const OperationalAgendaBoard = namedLazy(() => import('./admin/OperationalAgendaBoard.jsx'), 'OperationalAgendaBoard');
export const SmartFitAdmin = namedLazy(() => import('./admin/SmartFitAdmin.jsx'), 'SmartFitAdmin');
export const WaitlistAdmin = namedLazy(() => import('./admin/WaitlistAdmin.jsx'), 'WaitlistAdmin');
export const CommercialLanding = namedLazy(() => import('./commercial/CommercialLanding.jsx'), 'CommercialLanding');
