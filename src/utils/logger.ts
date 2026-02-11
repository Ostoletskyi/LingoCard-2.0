export const logger = {
  info: (...args: unknown[]) => console.info("[LingoCard]", ...args),
  warn: (...args: unknown[]) => console.warn("[LingoCard]", ...args),
  error: (...args: unknown[]) => console.error("[LingoCard]", ...args)
};
