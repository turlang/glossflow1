import { Appointment, Prisma } from '@prisma/client';

export type AppointmentSchedulePatch = {
  startTime?: string | Date;
  professionalId?: string;
  status?: string;
};

export function changesAppointmentSchedule(data: AppointmentSchedulePatch) {
  return Boolean(data.startTime || data.professionalId);
}

export function resolveAppointmentSchedule({ current, data, durationMin }: {
  current: Pick<Appointment, 'startTime' | 'professionalId'>;
  data: AppointmentSchedulePatch;
  durationMin: number;
}) {
  const start = data.startTime ? new Date(data.startTime) : current.startTime;
  if (Number.isNaN(start.getTime())) throw new Error('Data de reagendamento inválida.');
  const end = new Date(start.getTime() + durationMin * 60_000);
  const professionalId = data.professionalId || current.professionalId;
  return { start, end, professionalId };
}

/**
 * Sobreposição real exige as duas condições simultâneas:
 * existente.start < novo.fim E existente.end > novo.início.
 */
export function buildAppointmentConflictWhere({ appointmentId, salonId, professionalId, start, end }: {
  appointmentId?: string;
  salonId: string;
  professionalId: string;
  start: Date;
  end: Date;
}): Prisma.AppointmentWhereInput {
  return {
    ...(appointmentId ? { id: { not: appointmentId } } : {}),
    salonId,
    professionalId,
    status: 'CONFIRMED',
    AND: [
      { startTime: { lt: end } },
      { endTime: { gt: start } }
    ]
  };
}
