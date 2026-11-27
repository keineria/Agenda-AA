/**
 * Cron interno: revisa recordatorios cada 5 minutos mientras el servidor esté encendido.
 * Se desactiva con INTERNAL_CRON=false si se prefiere el cron del sistema (/api/cron/reminders).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
