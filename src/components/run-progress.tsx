import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { RunDTO } from "@/lib/data/runs";
import { STEP_LABELS } from "@/lib/steps";
import { cn } from "@/lib/utils";

/** Stepped progress: Reading documents → Finding assumptions → Checking contradictions → Ranking. */
export function RunProgress({ run, found }: { run: RunDTO; found: number }) {
  const failed = run.status === "FAILED";
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4" role="status" aria-live="polite">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {STEP_LABELS.map((label, i) => {
          const done = run.status === "COMPLETED" || i < run.stepIndex;
          const current = !failed && !done && i === run.stepIndex;
          return (
            <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[11px] font-semibold",
                  done ? "bg-accent text-accent-fg" : current ? "border-2 border-accent text-accent" : failed && i === run.stepIndex ? "bg-danger-bg text-danger-fg" : "border border-border-strong text-subtle",
                )}
              >
                {done ? <Check aria-hidden className="size-3" /> : current ? <Loader2 aria-hidden className="size-3 animate-spin" /> : failed && i === run.stepIndex ? <AlertTriangle aria-hidden className="size-3" /> : i + 1}
              </span>
              <span className={cn(done || current ? "font-medium" : "text-subtle")}>{label}</span>
              {i < STEP_LABELS.length - 1 ? <span aria-hidden className="hidden h-px w-5 bg-border-strong sm:block" /> : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-muted">
        {failed ? (run.error ?? "The analysis failed. Try again.") : run.status === "COMPLETED" ? `Done. ${found} findings.` : found > 0 ? `${found} findings so far. New ones appear as they're found.` : "Starting. Findings will appear here as they're found."}
      </p>
    </div>
  );
}
