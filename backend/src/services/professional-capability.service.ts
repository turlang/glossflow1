export type ProfessionalCapability = {
  id: string;
  servicesConfigured?: boolean;
  serviceIds?: string[];
};

/**
 * Compatibilidade segura com salões já existentes:
 * - enquanto servicesConfigured=false, o profissional continua apto a todos os serviços;
 * - depois da configuração explícita, apenas serviceIds autorizados são aceitos.
 */
export function professionalCanPerform(professional: ProfessionalCapability, serviceId: string) {
  if (!professional.servicesConfigured) return true;
  return Array.isArray(professional.serviceIds) && professional.serviceIds.includes(serviceId);
}

export function filterProfessionalsForService<T extends ProfessionalCapability>(professionals: T[], serviceId: string) {
  return professionals.filter((professional) => professionalCanPerform(professional, serviceId));
}
