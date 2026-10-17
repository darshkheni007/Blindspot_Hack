import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import { Button, linkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { SEVERITY_META } from "@/components/ui/badges";
import { SampleButton } from "@/components/sample-button";
import { DOMAINS, STAGES } from "@/config/app";
import { listProjects } from "@/lib/data/projects";
import { requireCtx } from "@/lib/data/session";
import { getUsage } from "@/lib/data/workspaces";
import type { SeverityKey } from "@/lib/analysis/scoring";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

const SEVS: SeverityKey[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default async function Dashboard() {
  const ctx = await requireCtx();
  const [projects, usage] = await Promise.all([listProjects(ctx.workspaceId), getUsage(ctx.workspaceId)]);
  const atLimit = usage.projects >= usage.maxProjects;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            {usage.projects} of {usage.maxProjects} projects used on the {usage.plan.toLowerCase()} plan.
          </p>
        </div>
        {atLimit ? (
          <Button disabled>
            <Plus aria-hidden className="size-4" /> New project
          </Button>
        ) : (
          <Link href="/projects/new" className={linkButton({})}>
            <Plus aria-hidden className="size-4" /> New project
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen aria-hidden className="size-5" />}
          title="No projects yet"
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/projects/new" className={linkButton({})}>
                Start a scan
              </Link>
              <SampleButton />
            </div>
          }
        >
          Create a project and upload its documents, or open a sample migration project to see what Blindspot finds.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="t-fast block h-full rounded-[var(--radius-card)] focus-visible:outline-offset-4">
                <Card className="t-fast h-full p-5 hover:border-border-strong hover:bg-surface-2/40">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold leading-snug">{p.name}</h2>
                    {p.isSample ? <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-fg">Sample</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {DOMAINS.find((d) => d.value === p.domain)?.label} · {STAGES.find((s) => s.value === p.stage)?.label}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Open findings by severity">
                    {SEVS.map((s) => (
                      <li key={s} className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-xs">
                        <span aria-hidden className={`size-2 rounded-full ${SEVERITY_META[s].dot}`} />
                        <span className="font-semibold tabular-nums">{p.openBySeverity[s]}</span>
                        <span className="text-muted">{SEVERITY_META[s].label}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-subtle">
                    {p.documentCount} {p.documentCount === 1 ? "document" : "documents"} · {p.lastAnalyzedAt ? `Analyzed ${timeAgo(p.lastAnalyzedAt)}` : "Not analyzed yet"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
