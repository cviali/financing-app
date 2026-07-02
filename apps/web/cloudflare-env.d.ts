// Augments the CloudflareEnv global interface declared by @opennextjs/cloudflare
// with the custom bindings defined in wrangler.jsonc.
export {};

declare global {
  interface CloudflareEnv {
    API_SERVICE: Fetcher;
  }
}
