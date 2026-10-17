"use client";
import { ArrowLeft, SearchX, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { priorityScore, sanitizeWeights, severityFor, type Weights } from "@/lib/analysis/scoring";
import { api, ApiFail } from "@/lib/client";
import type { FeedbackKindKey, FindingDTO, FindingStatusKey } from "@/lib/data/findings";
import { EvidenceSheet, type JumpTarget } from "./evidence-sheet";
import { FindingCard, type ScoredView } from "./finding-card";
import { FindingDetail } from "./finding-detail";
import { EMPTY_FILTERS, FilterRail, type Filters, type SortKey } from "./filter-rail";
import { WeightsControl } from "./weights-control";

export interface FindingsTabProps {
  projectId: string;
  findings: FindingDTO[] | null;
  loadError: string | null;
  onRetry: () => void;
  initialWeights: Record<string, number> | null;
  docs: Array<{ id: string; name: string }>;
  hasRun: boolean;
  running: boolean;
  canAnalyze: boolean;
  onAnalyze: () => void;
  onPatch: (id: string, patch: Partial<FindingDTO>) => void;
  initialSelectedId?: string | null;
}

export function FindingsTab(p: FindingsTabProps) {
  const toast = useToast();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("priority");
  const [weights, setWeights] = useState<Weights>(() => sanitizeWeights(p.initialWeights));
  const [selectedId, setSelectedId] = useState<string | null>(p.initialSelectedId ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [jump, setJump] = useState<JumpTarget | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function changeWeights(w: Weights) {
    setWeights(w);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api(`/api/projects/${p.projectId}/weights`, { method: "PUT", json: w }).catch(() => toast("Couldn't save your weights.", "error"));
    }, 600);
  }
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  // Re-score with the live weights, then rank (rank is by priority across all active findings).
  const scored: ScoredView[] = useMemo(() => {
    const base = (p.findings ?? []).map((f) => {
      const score = priorityScore(f.factors, weights);
      return { ...f, score, sev: severityFor(score), rank: 0 };
    });
    const active = base.filter((f) => f.active).sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
    active.forEach((f, i) => (f.rank = i + 1));
    return base;
  }, [p.findings, weights]);

  const documents = useMemo(() => [...new Set(scored.flatMap((f) => f.evidence.map((e) => e.documentName)))].filter((n) => n !== "Project details").sort(), [scored]);

  const pool = useMemo(() => (filters.change === "resolved" ? scored.filter((f) => !f.active) : scored.filter((f) => f.active)), [scored, filters.change]);

  const counts = useMemo(() => {
    const c = { severity: {} as Record<string, number>, category: {} as Record<string, number>, status: {} as Record<string, number>, confidence: {} as Record<string, number> };
    for (const f of pool) {
      c.severity[f.sev] = (c.severity[f.sev] ?? 0) + 1;
      c.category[f.category] = (c.category[f.category] ?? 0) + 1;
      c.status[f.status] = (c.status[f.status] ?? 0) + 1;
      c.confidence[f.confidence] = (c.confidence[f.confidence] ?? 0) + 1;
    }
    return c;
  }, [pool]);

  const diffCounts = useMemo(
    () => ({
      new: scored.filter((f) => f.active && f.diffState === "NEW").length,
      worsened: scored.filter((f) => f.active && f.diffState === "WORSENED").length,
      resolved: scored.filter((f) => !f.active).length,
    }),
    [scored],
  );
  // The diff only means something once there has been a previous run.
  const hasPrevious = scored.some((f) => f.diffState === "UNCHANGED" || f.diffState === "WORSENED" || !f.active);
  const effectiveDiff = hasPrevious ? diffCounts : { new: 0, worsened: 0, resolved: 0 };

  const visible = useMemo(() => {
    const out = pool.filter(
      (f) =>
        (!filters.severity.length || filters.severity.includes(f.sev)) &&
        (!filters.category.length || filters.category.includes(f.category)) &&
        (!filters.status.length || filters.status.includes(f.status)) &&
        (!filters.confidence.length || filters.confidence.includes(f.confidence)) &&
        (!filters.document || f.evidence.some((e) => e.documentName === filters.document) || f.checkedDocuments.includes(filters.document)) &&
        (filters.change === "all" || filters.change === "resolved" || (filters.change === "new" && f.diffState === "NEW") || (filters.change === "worsened" && f.diffState === "WORSENED")),
    );
    const cmp: Record<SortKey, (a: ScoredView, b: ScoredView) => number> = {
      priority: (a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt),
      proximity: (a, b) => b.factors.proximity - a.factors.proximity || b.score - a.score,
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.score - a.score,
    };
    return out.sort(cmp[sort]);
  }, [pool, filters, sort]);

  const selected = visible.find((f) => f.id === selectedId) ?? (desktop ? visible[0] : undefined) ?? null;

  async function setStatus(f: ScoredView, status: FindingStatusKey, reason: string | null) {
    const prev = { status: f.status, statusReason: f.statusReason };
    p.onPatch(f.id, { status, statusReason: reason });
    try {
      await api(`/api/findings/${f.id}`, { method: "PATCH", json: { status, reason: reason ?? undefined } });
    } catch (e) {
      p.onPatch(f.id, prev);
      throw e instanceof ApiFail ? e : new Error("failed");
    }
  }
  async function setFeedback(f: ScoredView, kind: FeedbackKindKey) {
    const prev = f.myFeedback;
    p.onPatch(f.id, { myFeedback: kind });
    try {
      await api(`/api/findings/${f.id}/feedback`, { method: "PUT", json: { kind } });
      toast("Thanks. Your feedback is saved.");
    } catch {
      p.onPatch(f.id, { myFeedback: prev });
      toast("Couldn't save your feedback.", "error");
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const i = visible.findIndex((f) => f.id === selected?.id);
    const n = visible[Math.min(visible.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (!n) return;
    e.preventDefault();
    setSelectedId(n.id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-finding-id="${n.id}"]`)?.focus());
  }

  if (p.loadError) return <ErrorState title="Couldn't load findings" message={p.loadError} onRetry={p.onRetry} />;
  if (p.findings === null) {
    return (
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_420px]" role="status" aria-label="Loading findings">
        <Skeleton className="hidden h-96 lg:block" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="hidden h-96 lg:block" />
      </div>
    );
  }
  if (p.findings.length === 0) {
    return p.running ? (
      <div className="space-y-3" role="status" aria-label="Analysis running">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    ) : (
      <EmptyState
        icon={<Sparkles aria-hidden className="size-5" />}
        title={p.hasRun ? "No findings from the last run" : "Nothing analyzed yet"}
        action={
          <Button onClick={p.onAnalyze} disabled={!p.canAnalyze}>
            {p.hasRun ? "Run analysis again" : "Analyze documents"}
          </Button>
        }
      >
        {p.canAnalyze ? "Blindspot will read your documents, compare them with each other and rank what's missing or inconsistent." : "Add at least one document and wait for it to finish processing, then run the analysis."}
      </EmptyState>
    );
  }

  const detail = selected ? (
    <FindingDetail
      key={selected.id}
      f={selected}
      weights={weights}
      docs={p.docs}
      onStatus={(s, r) => setStatus(selected, s, r)}
      onFeedback={(k) => setFeedback(selected, k)}
      onJump={setJump}
    />
  ) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)_minmax(380px,440px)]">
      <FilterRail filters={filters} onChange={setFilters} sort={sort} onSort={setSort} counts={counts} documents={documents} diffCounts={effectiveDiff} activeCount={scored.filter((f) => f.active).length} />

      <div className="min-w-0 space-y-4">
        <WeightsControl weights={weights} onChange={changeWeights} />
        <p className="text-sm text-muted" aria-live="polite">
          Showing {visible.length} of {pool.length} {filters.change === "resolved" ? "resolved " : ""}findings
        </p>
        {visible.length === 0 ? (
          <EmptyState
            icon={<SearchX aria-hidden className="size-5" />}
            title="No findings match these filters"
            action={
              <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3" onKeyDown={onListKey} aria-label="Findings, ranked">
            {visible.map((f) => (
              <li key={f.id} className="fade-in">
                <FindingCard
                  f={f}
                  selected={selected?.id === f.id}
                  showDiff={hasPrevious}
                  onSelect={() => {
                    setSelectedId(f.id);
                    if (!desktop) setMobileOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {desktop ? (
        <section aria-label="Finding details" className="min-w-0">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface">
            {detail ?? <p className="p-6 text-sm text-muted">Select a finding to see the evidence.</p>}
          </div>
        </section>
      ) : (
        <Sheet open={mobileOpen && !!selected} onOpenChange={setMobileOpen} title="Finding" description="Details and evidence" className="sm:max-w-none">
          <div className="border-b border-border px-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
              <ArrowLeft aria-hidden className="size-4" /> Back to list
            </Button>
          </div>
          {detail}
        </Sheet>
      )}

      <EvidenceSheet target={jump} onClose={() => setJump(null)} />
    </div>
  );
}
