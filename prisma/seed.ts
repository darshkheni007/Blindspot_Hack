/**
 * Seeds a demo account with one fully populated sample project (a billing-system migration).
 *
 *   SEED_DEMO_EMAIL=demo@blindspot.local SEED_DEMO_PASSWORD='choose-something-long' npm run db:seed
 *
 * If SEED_DEMO_PASSWORD is not set a random one is generated and printed once. Never run against production.
 * The analysis is run twice: once on the original files, then again after the budget file is corrected, so the
 * "Findings over time" chart and the New / Resolved / Worsened diff have real data.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { createUserWithWorkspace, findUserForLogin } from "../src/lib/data/users";
import { createProject } from "../src/lib/data/projects";
import { ingestDocument } from "../src/lib/documents";
import { getQueue } from "../src/lib/queue";
import { startAnalysis } from "../src/lib/analysis/service";
import { SAMPLE_FILES } from "../src/lib/sample";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production.");
  const email = (process.env.SEED_DEMO_EMAIL ?? "demo@blindspot.local").toLowerCase();
  const generated = !process.env.SEED_DEMO_PASSWORD;
  const password = process.env.SEED_DEMO_PASSWORD ?? randomBytes(9).toString("base64url");

  if (await findUserForLogin(email)) {
    console.log(`${email} already exists; nothing to do. Delete that user (Settings > Delete my data) to re-seed.`);
    return;
  }
  const { workspaceId } = await createUserWithWorkspace({ email, name: "Demo User", passwordHash: await hashPassword(password) });
  const project = await createProject(workspaceId, {
    name: "Meridian billing migration (sample)",
    domain: "SOFTWARE",
    stage: "IN_PROGRESS",
    goal: "Move all customers from the legacy BillMaster system to a new billing platform without interrupting invoicing.",
    deadline: new Date(Date.UTC(2027, 2, 15)),
    budget: "$350,000",
    teamSize: 6,
    knownRisks: "Data migration accuracy",
    isSample: true,
  });
  for (const f of SAMPLE_FILES) await ingestDocument(workspaceId, project.id, f, readFileSync(`prisma/sample/${f}`));
  await getQueue().idle();
  await startAnalysis(workspaceId, project.id);
  await getQueue().idle();

  // Second pass: the team reconciles the budget total, so that finding resolves.
  const fixed = readFileSync("prisma/sample/Meridian-Budget.csv", "utf8").replace("Total,,360000,Needs review", "Total,,353000,Reconciled");
  await ingestDocument(workspaceId, project.id, "Meridian-Budget.csv", Buffer.from(fixed));
  await getQueue().idle();
  await startAnalysis(workspaceId, project.id);
  await getQueue().idle();

  console.log(`Seeded project "${project.name}" for ${email}.`);
  if (generated) console.log(`Generated password (shown once): ${password}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
