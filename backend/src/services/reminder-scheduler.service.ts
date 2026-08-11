import { scanAppointmentReminders } from './appointment-reminder.service';

type SchedulerLogger = {
  info: (data: unknown, message?: string) => void;
  error: (error: unknown, message?: string) => void;
};

/**
 * Inicia a varredura periódica de lembretes da Agenda.
 *
 * O timer usa `unref()` para não impedir encerramento limpo do processo. Em
 * infraestrutura que hiberna, um Cron externo continua sendo a opção mais
 * confiável para horários estritos.
 */
export function startReminderScheduler(log: SchedulerLogger) {
  const intervalMinutes = Math.max(
    5,
    Number(process.env.APPOINTMENT_REMINDER_SCAN_MINUTES || 10)
  );

  const run = () => {
    void scanAppointmentReminders()
      .then((result) => {
        if (result.sent || result.failed) {
          log.info({ reminders: result }, 'Varredura de lembretes concluída.');
        }
      })
      .catch((error) => log.error(error, 'Falha na varredura automática de lembretes.'));
  };

  run();
  const timer = setInterval(run, intervalMinutes * 60_000);
  timer.unref();
  return timer;
}
