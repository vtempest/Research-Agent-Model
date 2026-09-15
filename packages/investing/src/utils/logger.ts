export function createChildLogger(name: string) {
  return {
    info: (obj: any, msg?: string) => {
      if (typeof obj === "string") {
        console.log(`[${name}] INFO: ${obj}`, msg || "");
      } else {
        console.log(`[${name}] INFO:`, msg || "", obj);
      }
    },
    debug: (obj: any, msg?: string) => {
      if (typeof obj === "string") {
        console.debug(`[${name}] DEBUG: ${obj}`, msg || "");
      } else {
        console.debug(`[${name}] DEBUG:`, msg || "", obj);
      }
    },
    warn: (obj: any, msg?: string) => {
      if (typeof obj === "string") {
        console.warn(`[${name}] WARN: ${obj}`, msg || "");
      } else {
        console.warn(`[${name}] WARN:`, msg || "", obj);
      }
    },
    error: (obj: any, msg?: string) => {
      if (typeof obj === "string") {
        console.error(`[${name}] ERROR: ${obj}`, msg || "");
      } else {
        console.error(`[${name}] ERROR:`, msg || "", obj);
      }
    },
  };
}
