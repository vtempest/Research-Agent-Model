/**
 * Runtime env-var accessor.
 * Supports both local development (process.env) and Cloudflare Workers
 * (cloudflare:workers virtual module) via dynamic import.
 */
export declare function getEnv(key: string): string | undefined;
