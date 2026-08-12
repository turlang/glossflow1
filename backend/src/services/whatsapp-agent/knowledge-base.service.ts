import { AgentSalon } from './contracts';

type ServiceFact = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  durationMin?: number;
};

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

/**
 * Constrói a base factual que o modelo pode citar sem inferência. Dados de
 * disponibilidade e profissionais continuam sendo consultados por ferramentas,
 * pois mudam com mais frequência do que o contexto institucional.
 */
export function buildSalonKnowledgeBase(salon: AgentSalon, services: ServiceFact[]) {
  const institutional = [
    `Nome: ${salon.name}`,
    `Descrição: ${salon.description || 'não cadastrada'}`,
    `Horário informado: ${salon.openingHours || 'não cadastrado'}`,
    `Endereço: ${salon.address || 'não cadastrado'}`,
    `Telefone: ${salon.phone || 'não cadastrado'}`,
    `Instagram: ${salon.instagram || 'não cadastrado'}`
  ];

  const catalog = services.slice(0, 40).map((service) => {
    const duration = service.durationMin ? `; duração ${service.durationMin} min` : '';
    const description = service.description ? `; ${service.description}` : '';
    return `- ${service.name}: ${money(service.price)}${duration}${description}`;
  });

  return [
    'BASE FACTUAL DO SALÃO — use somente estes dados para fatos institucionais e catálogo:',
    ...institutional,
    '',
    'SERVIÇOS ATIVOS:',
    ...(catalog.length ? catalog : ['- Nenhum serviço ativo cadastrado.']),
    '',
    'Se uma política, preço, serviço ou informação institucional não estiver nesta base ou em uma ferramenta, diga que a informação não está cadastrada e ofereça atendimento humano. Não complete lacunas por suposição.'
  ].join('\n');
}
