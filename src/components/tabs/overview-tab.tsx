"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { SeverityBadge } from "@/components/ui/badges";
import { api } from "@/lib/client";
import type { FindingDTO } from "@/lib/data/findings";
import type { RunDTO } from "@/lib/data/runs";
import type { ProjectStatus } from "@/hooks/use-project-data";
import { formatDate } from "@/lib/utils";

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </Card>
  );
}

function TrendChart({ runs }: { runs: RunDTO[] }) {
  const pts = runs.filter((r) => r.status === "COMPLETED" && r.stats).map((r) => ({ at: r.finishedAt ?? r.startedAt, total: r.stats!.total, critical: r.stats!.critical }));
  if (pts.length === 0) return <p className="text-sm text-muted">No completed analyses yet.</p>;
  const W = 320;
  const H = 96;
  const max = Math.max(1, ...pts.map((p) => p.total));
  const x = (i: number) => (pts.length === 1 ? W / 2 : 12 + (i * (W - 24)) / (pts.length - 1));
  const y = (v: number) => H - 14 - (v / max) * (H - 28);
  const line = (key: "total" | "critical") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Findings over ${pts.length} analysis runs: ${pts.map((p) => p.total).join(", ")}`} className="h-28 w-full">
        <path d={line("total")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        <path d={line("critical")} fill="none" stroke="var(--sev-critical)" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.total)} r="3.5" fill="var(--accent)" />
            <circle cx={x(i)} cy={y(p.critical)} r="3" fill="var(--sev-critical)" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-accent" /> All findings
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 border-t-2 border-dashed border-critical" /> Critical
        </span>
        <span>{pts.length === 1 ? "Run again after changing documents to see a trend." : `${formatDate(pts[0].at)} to ${formatDate(pts[pts.length - 1].at)}`}</span>
      </div>
    </div>
  );
}

export function OverviewTab({ projectId, status, findings, onOpenFinding }: { projectId: string; status: ProjectStatus; findings: FindingDTO[] | null; onOpenFinding: (id: string) => void }) {
  const [runs, setRuns] = useState<RunDTO[] | null>(null);
  const [err, setErr] = useState(false);
  const runId = status.run?.id;
  const runStatus = status.run?.status;
  useEffect(() => {
    let cancelled = false;
    api<{ runs: RunDTO[] }>(`/api/projects/${projectId}/runs`)
      .then((j) => !cancelled && (setRuns(j.runs), setErr(false)))
      .catch(() => !cancelled && setErr(true));
    return () => {
      cancelled = true;
    };
  }, [projectId, runId, runStatus]);

  const top = (findings ?? []).filter((f) => f.active && f.status === "OPEN").slice(0, 5);
  const analyzed = status.documents.filter((d) => d.status === "READY").length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Documents analyzed" value={analyzed} hint={status.documents.length !== analyzed ? `${status.documents.length} uploaded` : undefined} />
        <Tile label="Open findings" value={status.stats.open} hint={`${status.stats.total} in total`} />
        <Tile label="Critical" value={status.stats.critical} hint="Open and critical" />
        <Tile label="Resolved" value={`${status.stats.resolvedPct}%`} hint="Accepted, rejected or already known" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Top 5 to address first</h2>
          {findings === null ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : top.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{findings.length ? "Nothing open. Every finding has been reviewed." : "Run an analysis to see what to address first."}</p>
          ) : (
            <ol className="mt-3 divide-y divide-border">
              {top.map((f, i) => (
                <li key={f.id}>
                  <button type="button" onClick={() => onOpenFinding(f.id)} className="t-fast flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-2">
                    <span className="mt-0.5 w-5 text-sm font-semibold tabular-nums text-subtle">{i + 1}</span>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{f.title}</span>
                    <SeverityBadge severity={f.severity} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">Findings over time</h2>
          {err ? <ErrorState title="Couldn't load history" onRetry={() => setErr(false)} /> : runs === null ? <Skeleton className="h-28" /> : <TrendChart runs={runs} />}
        </Card>
      </div>
    </div>
  );
}
