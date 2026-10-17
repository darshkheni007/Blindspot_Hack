import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function create() {
  const max = env.databasePoolMax;
  const pool = new Pool({ connectionString: env.databaseUrl, ...(max ? { max } : {}) });
  // A dropped *idle* connection emits "error" on the Pool; without a listener Node would
  // terminate the process. Log the error name only, never the statement or its parameters.
  pool.on("error", (e) => console.error(`[db] idle client error: ${e.name}`));
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

/**
 * Raw client. Only src/lib/data/*, src/lib/analysis/* and the seed script may import this;
 * everything else goes through the workspace-scoped data layer (enforced by an ESLint rule).
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    globalForPrisma.__prisma ??= create();
    return Reflect.get(globalForPrisma.__prisma, prop);
  },
});

export async function disconnect() {
  await globalForPrisma.__prisma?.$disconnect();
  globalForPrisma.__prisma = undefined;
}
