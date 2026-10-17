import { FileSearch } from "lucide-react";
import { CategoryBadge, ConfidenceLabel, PriorityBar, StatusChip } from "@/components/ui/badges";
import type { FindingDTO } from "@/lib/data/findings";
import type { SeverityKey } from "@/lib/analysis/scoring";
import { cn } from "@/lib/utils";

export type ScoredView = FindingDTO & { score: number; sev: SeverityKey; rank: number };

const SEV_EDGE: Record<SeverityKey, string> = { CRITICAL: "bg-critical", HIGH: "bg-high", MEDIUM: "bg-medium", LOW: "bg-low" };

export function FindingCard({ f, selected, onSelect, showDiff }: { f: ScoredView; selected: boolean; onSelect: () => void; showDiff: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      data-finding-id={f.id}
      className={cn(
        "t-fast relative flex w-full gap-3 overflow-hidden rounded-[var(--radius-card)] border bg-surface p-4 pl-5 text-left",
        selected ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong",
        !f.active && "opacity-70",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", SEV_EDGE[f.sev])} />
      <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold tabular-nums text-subtle" aria-label={`Rank ${f.rank}`}>
        {f.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug">{f.title}</span>
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <CategoryBadge category={f.category} />
          <ConfidenceLabel value={f.confidence} />
          <StatusChip status={f.status} />
          {showDiff && f.diffState === "NEW" && f.active ? <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-fg">New</span> : null}
          {showDiff && f.diffState === "WORSENED" && f.active ? <span className="rounded-md bg-high-bg px-2 py-0.5 text-xs font-medium text-high-fg">Worsened</span> : null}
          {!f.active ? <span className="rounded-md bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok-fg">Resolved</span> : null}
          {f.isAbsence ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <FileSearch aria-hidden className="size-3.5" /> Not found in documents
            </span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 pt-0.5">
        <PriorityBar score={f.score} severity={f.sev} />
      </span>
    </button>
  );
}
