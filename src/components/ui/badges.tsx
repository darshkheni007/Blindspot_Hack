import { cn } from "@/lib/utils";
import type { SeverityKey } from "@/lib/analysis/scoring";

const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium";

export const SEVERITY_META: Record<SeverityKey, { label: string; badge: string; bar: string; dot: string }> = {
  CRITICAL: { label: "Critical", badge: "bg-critical-bg text-critical-fg", bar: "bg-critical", dot: "bg-critical" },
  HIGH: { label: "High", badge: "bg-high-bg text-high-fg", bar: "bg-high", dot: "bg-high" },
  MEDIUM: { label: "Medium", badge: "bg-medium-bg text-medium-fg", bar: "bg-medium", dot: "bg-medium" },
  LOW: { label: "Low", badge: "bg-low-bg text-low-fg", bar: "bg-low", dot: "bg-low" },
};

export function SeverityBadge({ severity, className }: { severity: SeverityKey; className?: string }) {
  const m = SEVERITY_META[severity];
  return (
    <span className={cn(base, m.badge, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export const CATEGORY_LABEL: Record<string, string> = {
  ASSUMPTION: "Assumption",
  CONSTRAINT: "Constraint",
  QUESTION: "Question",
  CONTRADICTION: "Contradiction",
  DATA_ISSUE: "Data issue",
};
export function CategoryBadge({ category }: { category: string }) {
  return <span className={cn(base, "bg-surface-2 text-muted ring-1 ring-inset ring-border")}>{CATEGORY_LABEL[category] ?? category}</span>;
}

export const CONFIDENCE_LABEL: Record<string, string> = {
  EVIDENCE_BACKED: "Evidence-backed",
  INFERRED: "Inferred",
  PATTERN_BASED: "Pattern-based",
};
export const CONFIDENCE_HELP: Record<string, string> = {
  EVIDENCE_BACKED: "Directly supported by quotes from your documents.",
  INFERRED: "Reasoned from what your documents say; check the evidence.",
  PATTERN_BASED: "Based on what projects like this usually need; the documents are silent.",
};
export function ConfidenceLabel({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={CONFIDENCE_HELP[value]}>
      <span aria-hidden className={cn("size-1.5 rounded-full", value === "EVIDENCE_BACKED" ? "bg-ok-fg" : value === "INFERRED" ? "bg-accent" : "bg-subtle")} />
      {CONFIDENCE_LABEL[value] ?? value}
    </span>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  DEFERRED: "Deferred",
  ALREADY_KNOWN: "Already known",
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-accent-soft text-accent-soft-fg",
  ACCEPTED: "bg-ok-bg text-ok-fg",
  REJECTED: "bg-surface-2 text-muted ring-1 ring-inset ring-border",
  DEFERRED: "bg-warn-bg text-warn-fg",
  ALREADY_KNOWN: "bg-surface-2 text-muted ring-1 ring-inset ring-border",
};
export function StatusChip({ status }: { status: string }) {
  return <span className={cn(base, STATUS_STYLE[status])}>{STATUS_LABEL[status] ?? status}</span>;
}

export function PriorityBar({ score, severity }: { score: number; severity: SeverityKey }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`Priority ${score} out of 100`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full", SEVERITY_META[severity].bar)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-xs font-medium tabular-nums text-muted">{score}</span>
    </div>
  );
}
