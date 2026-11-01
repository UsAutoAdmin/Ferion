/**
 * Minimal structured logger. Server logs are JSON in production for log
 * search; client logs are silent in production except errors.
 */

type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";
const isServer = typeof window === "undefined";

function emit(level: Level, message: string, context?: Context): void {
  if (isProd && !isServer && level !== "error") return;
  if (isProd && isServer && level === "debug") return;

  if (isProd && isServer) {
    const payload = { level, msg: message, ts: new Date().toISOString(), ...(context ?? {}) };
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const fn = level === "debug" ? console.debug : level === "info" ? console.info : level === "warn" ? console.warn : console.error;
  if (context) fn(message, context);
  else fn(message);
}

export const logger = {
  debug: (m: string, c?: Context) => emit("debug", m, c),
  info: (m: string, c?: Context) => emit("info", m, c),
  warn: (m: string, c?: Context) => emit("warn", m, c),
  error: (m: string, c?: Context) => emit("error", m, c),
};
