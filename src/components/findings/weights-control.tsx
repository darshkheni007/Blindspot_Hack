"use client";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_WEIGHTS, FACTOR_LABELS, FACTORS, WEIGHT_RANGE, type Weights } from "@/lib/analysis/scoring";
import { cn } from "@/lib/utils";

/** Collapsible "Adjust weights": moving a slider re-ranks the list immediately; saving is debounced by the parent. */
export function WeightsControl({ weights, onChange }: { weights: Weights; onChange: (w: Weights) => void }) {
  const [open, setOpen] = useState(false);
  const changed = FACTORS.some((f) => weights[f] !== DEFAULT_WEIGHTS[f]);
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="weights-panel"
          onClick={() => setOpen((o) => !o)}
          className="t-fast flex w-full items-center justify-between rounded-[var(--radius-card)] px-4 py-3 text-left text-sm font-medium hover:bg-surface-2"
        >
          <span>
            Adjust weights {changed ? <span className="ml-1 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-soft-fg">Custom</span> : null}
          </span>
          <ChevronDown aria-hidden className={cn("size-4 text-subtle transition-transform duration-150", open && "rotate-180")} />
        </button>
      </h3>
      {open ? (
        <div id="weights-panel" className="space-y-4 border-t border-border px-4 py-4">
          <p className="text-xs text-muted">Make a factor count more (up to 2) or less (down to 0). The ranking updates as you move a slider.</p>
          {FACTORS.map((f) => (
            <div key={f}>
              <div className="flex items-baseline justify-between">
                <label htmlFor={`w-${f}`} className="text-sm font-medium">
                  {FACTOR_LABELS[f].label}
                </label>
                <span className="text-xs tabular-nums text-muted">×{weights[f].toFixed(2)}</span>
              </div>
              <input
                id={`w-${f}`}
                type="range"
                min={WEIGHT_RANGE.min}
                max={WEIGHT_RANGE.max}
                step={WEIGHT_RANGE.step}
                value={weights[f]}
                onChange={(e) => onChange({ ...weights, [f]: Number(e.target.value) })}
                aria-describedby={`w-${f}-help`}
                className="mt-1 h-2 w-full cursor-pointer accent-[var(--accent)]"
              />
              <p id={`w-${f}-help`} className="mt-0.5 text-xs text-subtle">
                {FACTOR_LABELS[f].help}
              </p>
            </div>
          ))}
          <Button variant="secondary" size="sm" disabled={!changed} onClick={() => onChange({ ...DEFAULT_WEIGHTS })}>
            <RotateCcw aria-hidden className="size-3.5" /> Reset to default
          </Button>
        </div>
      ) : null}
    </section>
  );
}
