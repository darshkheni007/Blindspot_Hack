"use client";
import { AlertTriangle, Play, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { DocumentsPanel } from "@/components/documents-panel";
import { FindingsTab } from "@/components/findings/findings-tab";
import { RunProgress } from "@/components/run-progress";
import { AssumptionsTab } from "@/components/tabs/assumptions-tab";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { QuestionsTab } from "@/components/tabs/questions-tab";
import { ReportTab } from "@/components/tabs/report-tab";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useProjectData } from "@/hooks/use-project-data";
import { api, ApiFail } from "@/lib/client";
import { cn } from "@/lib/utils";

const TABS = [
  ["overview", "Overview"],
  ["documents", "Documents"],
  ["findings", "Findings"],
  ["questions", "Questions"],
  ["assumptions", "Assumptions"],
  ["report", "Report"],
] as const;
type TabKey = (typeof TABS)[number][0];

export function ProjectWorkspace({ projectId, name, goal, meta, isSample, initialTab }: { projectId: string; name: string; goal: string; meta: string; isSample: boolean; initialTab: string }) {
  const router = useRouter();
  const toast = useToast();
  const data = useProjectData(projectId);
  const [tab, setTabState] = useState<TabKey>(TABS.some(([k]) => k === initialTab) ? (initialTab as TabKey) : "overview");
  const [starting, setStarting] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const setTab = useCallback(
    (t: TabKey) => {
      setTabState(t);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", t);
      window.history.replaceState(null, "", url);
    },
    [],
  );

  const { status, findings, error, active } = data;
  const readyDocs = status?.documents.filter((d) => d.status === "READY") ?? [];
  const parsing = status?.documents.some((d) => d.status === "PARSING") ?? false;
  const canAnalyze = readyDocs.length > 0 && !parsing;
  const hasRun = !!status?.run;
  const refreshKey = `${status?.run?.id}:${status?.run?.status}`;

  async function analyze() {
    setStarting(true);
    try {
      await data.analyze();
      if (tab !== "findings") setTab("findings");
    } catch (e) {
      toast(e instanceof ApiFail ? e.message : "Couldn't start the analysis.", "error");
    } finally {
      setStarting(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/projects/${projectId}`, { method: "DELETE" });
      router.replace("/dashboard");
      router.refresh();
    } catch {
      toast("Couldn't delete the project.", "error");
      setDeleting(false);
    }
  }

  function onTabKey(e: React.KeyboardEvent, i: number) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -i : e.key === "End" ? TABS.length - 1 - i : 0;
    if (!dir) return;
    e.preventDefault();
    const next = TABS[(i + dir + TABS.length) % TABS.length][0];
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            {meta}
            {isSample ? " · Sample project" : ""}
          </p>
          <p className="measure mt-1 line-clamp-2 text-sm text-subtle">{goal}</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button onClick={() => void analyze()} loading={starting || active} disabled={!canAnalyze}>
            {hasRun ? <RefreshCw aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
            {active ? "Analyzing…" : hasRun ? "Re-run analysis" : "Analyze documents"}
          </Button>
          <Button variant="danger-outline" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete project">
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </div>

      {error && !status ? <ErrorState title="Couldn't load this project" message={error} onRetry={() => void data.refresh()} /> : null}

      {status?.run && (active || status.run.status === "FAILED") ? (
        <div className="mb-5">
          <RunProgress run={status.run} found={status.stats.total} />
        </div>
      ) : null}
      {status?.stale && !active ? (
        <Alert variant="warning" className="mb-5">
          <p className="flex flex-wrap items-center gap-2">
            <AlertTriangle aria-hidden className="size-4" /> Your documents changed since the last analysis. Re-run it to refresh the findings; only changed files are re-read.
          </p>
        </Alert>
      ) : null}

      <div role="tablist" aria-label="Project sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border no-print">
        {TABS.map(([k, label], i) => (
          <button
            key={k}
            ref={(el) => {
              tabRefs.current[k] = el;
            }}
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={cn("t-fast -mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium", tab === k ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}
          >
            {label}
            {k === "findings" && status && status.stats.open > 0 ? <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs tabular-nums text-muted">{status.stats.open}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="outline-none">
        {!status && !error ? (
          <div className="space-y-4" role="status" aria-label="Loading project">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : status ? (
          <>
            {tab === "overview" ? (
              <OverviewTab
                projectId={projectId}
                status={status}
                findings={findings}
                onOpenFinding={(id) => (setFocusId(id), setTab("findings"))}
              />
            ) : null}
            {tab === "documents" ? <DocumentsPanel projectId={projectId} onChange={() => void data.refresh()} /> : null}
            {tab === "findings" ? (
              <FindingsTab
                projectId={projectId}
                findings={findings}
                loadError={error}
                onRetry={() => void data.refresh()}
                initialWeights={status.project.weights}
                docs={status.documents.map((d) => ({ id: d.id, name: d.name }))}
                hasRun={hasRun}
                running={active}
                canAnalyze={canAnalyze}
                onAnalyze={() => void analyze()}
                onPatch={data.patchFinding}
                initialSelectedId={focusId}
              />
            ) : null}
            {tab === "questions" ? <QuestionsTab projectId={projectId} refreshKey={refreshKey} /> : null}
            {tab === "assumptions" ? <AssumptionsTab projectId={projectId} refreshKey={refreshKey} /> : null}
            {tab === "report" ? <ReportTab projectId={projectId} refreshKey={refreshKey} /> : null}
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this project?"
        description="This permanently removes the project, its uploaded files, extracted text, findings, comments and reports. This can't be undone."
        confirmLabel="Delete project"
        onConfirm={() => void remove()}
        loading={deleting}
      />
    </div>
  );
}
