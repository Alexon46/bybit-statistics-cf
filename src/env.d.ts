/**
 * Bindings not declared in wrangler.toml (secrets from dashboard / `wrangler secret put`, optional KV).
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 */
declare global {
    interface Env {
        SECRET: string;
        TOKEN: string;
        DATABASE_URL: string;
        GEMINI_API_KEY: string;
        MESSAGE_STORE?: KVNamespace;
    }
}

export {};
