import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { createUserWithWorkspace } from "../src/lib/data/users";
import { createProject } from "../src/lib/data/projects";
import { ingestDocument } from "../src/lib/documents";
import { getQueue } from "../src/lib/queue";
import { startAnalysis } from "../src/lib/analysis/service";
import { listFindings } from "../src/lib/data/findings";

async function main() {
  const { user, workspaceId } = await createUserWithWorkspace({ email: `t${Date.now()}@x.test`, name: "T", passwordHash: null });
  const p = await createProject(workspaceId, { name: "Meridian Billing Migration", domain: "SOFTWARE", stage: "IN_PROGRESS", goal: "Replace BillMaster with Meridian by 15 March 2027", deadline: new Date("2027-03-15"), budget: "$350,000", teamSize: 6 });
  for (const f of ["Meridian-Billing-PRD.md", "Meridian-Migration-Plan.md", "Meridian-Budget.csv"]) await ingestDocument(workspaceId, p.id, f, readFileSync("prisma/sample/" + f));
  await getQueue().idle();
  const { run } = await startAnalysis(workspaceId, p.id, { now: new Date("2026-10-17") });
  await getQueue().idle();
  const fs = await listFindings(workspaceId, p.id, user.id);
  console.log("run", run.id, fs.length, "findings");
  for (const f of fs) console.log(String(f.priority).padStart(3), f.severity.padEnd(8), f.category.padEnd(13), f.title);
  await prisma.$disconnect();
}
main();
