/** Central, lazily-read environment access. Never log values from here. */
export const env = {
  get databaseUrl() {
    const v = process.env.DATABASE_URL;
    if (!v) throw new Error("DATABASE_URL is not set");
    return v;
  },
  get analysisProvider(): "mock" | "anthropic" {
    return process.env.ANALYSIS_PROVIDER === "anthropic" ? "anthropic" : "mock";
  },
  get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get anthropicModel() {
    return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  },
  /**
   * Maximum number of pooled Postgres connections. Unset uses the driver default (10).
   * Set `DATABASE_POOL_MAX=1` for a database that only accepts one connection at a time
   * (e.g. a local `prisma dev` server) or behind a transaction-mode pooler.
   */
  get databasePoolMax(): number | undefined {
    const raw = process.env.DATABASE_POOL_MAX;
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  },
  get storageDriver(): "local" | "s3" {
    return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
  },
  get storageDir() {
    return process.env.STORAGE_LOCAL_DIR || "./storage";
  },
  get trustProxy() {
    return process.env.TRUST_PROXY === "true";
  },
  get googleEnabled() {
    return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  },
};
