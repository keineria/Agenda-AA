import { runReminders } from "./lib/notify";

declare global {
  // eslint-disable-next-line no-var
  var __agendaCron: NodeJS.Timeout | undefined;
}

if (process.env.INTERNAL_CRON !== "false" && !globalThis.__agendaCron) {
  const tick = async () => {
    try {
      const r = await runReminders();
      if (r.day || r.hour) console.log(`[cron] recordatorios enviados: 1 día=${r.day}, 1 hora=${r.hour}`);
    } catch (e) {
      console.error("[cron] error en recordatorios", e);
    }
  };
  setTimeout(tick, 15_000);
  globalThis.__agendaCron = setInterval(tick, 5 * 60_000);
}
