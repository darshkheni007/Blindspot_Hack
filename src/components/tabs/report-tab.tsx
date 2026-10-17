"use client";
import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { linkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { SeverityBadge } from "@/components/ui/badges";
import { api } from "@/lib/client";
import type { ReportData } from "@/lib/report";
import { formatDate } from "@/lib/utils";

export function ReportTab({ projectId, refreshKey }: { projectId: string; refreshKey: string }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api<ReportData>(`/api/projects/${projectId}/report`)
      .then((r) => !cancelled && (setReport(r), setFailed(false)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey, attempt]);

  if (failed) return <ErrorState title="Couldn't build the report" onRetry={() => (setFailed(false), setAttempt((n) => n + 1))} />;
  if (!report)
    return (
      <div className="space-y-3" role="status" aria-label="Loading report">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  const base = `/api/projects/${projectId}/report`;
  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Generated {formatDate(report.generatedAt)}{report.run ? ` · model ${report.run.model} · prompts ${report.run.promptVersion}` : ""}</p>
        <div className="flex gap-2">
          <a href={`${base}?format=csv`} className={linkButton({ variant: "secondary", size: "sm" })}>
            <Download aria-hidden className="size-4" /> CSV
          </a>
          <a href={`${base}?format=pdf`} className={linkButton({ size: "sm" })}>
            <FileText aria-hidden className="size-4" /> PDF
          </a>
        </div>
      </div>
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Executive summary</h2>
        <div className="measure mt-3 space-y-3 text-sm leading-relaxed">
          {report.summary.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </Card>
      {report.top.length ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold">Address these first</h2>
          <ol className="mt-3 space-y-4">
            {report.top.map((f, i) => (
              <li key={f.id} className="flex gap-3">
                <span className="w-5 text-sm font-semibold text-subtle">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{f.title}</p>
                    <SeverityBadge severity={f.severity} />
                  </div>
                  <p className="mt-1 text-sm text-muted">Ask {f.owner}: {f.question}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}
