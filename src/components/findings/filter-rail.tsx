"use client";
import { ListFilter } from "lucide-react";
import { useState } from "react";
import { CATEGORY_LABEL, CONFIDENCE_LABEL, SEVERITY_META, STATUS_LABEL } from "@/components/ui/badges";
import { Select } from "@/components/ui/form";
import { SEVERITY_ORDER } from "@/lib/analysis/scoring";
import { cn } from "@/lib/utils";

export interface Filters {
  severity: string[];
  category: string[];
  status: string[];
  confidence: string[];
  document: string;
  change: "all" | "new" | "worsened" | "resolved";
}
export const EMPTY_FILTERS: Filters = { severity: [], category: [], status: [], confidence: [], document: "", change: "all" };
export type SortKey = "priority" | "proximity" | "newest";

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{legend}</legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Check({ label, count, checked, onChange, dot }: { label: string; count?: number; checked: boolean; onChange: () => void; dot?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-surface-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded border-border-strong accent-[var(--accent)]" />
      {dot ? <span aria-hidden className={cn("size-2 rounded-full", dot)} /> : null}
      <span className="flex-1">{label}</span>
      {count !== undefined ? <span className="text-xs tabular-nums text-subtle">{count}</span> : null}
    </label>
  );
}

export function FilterRail({
  filters,
  onChange,
  sort,
  onSort,
  counts,
  documents,
  diffCounts,
  activeCount,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  counts: { severity: Record<string, number>; category: Record<string, number>; status: Record<string, number>; confidence: Record<string, number> };
  documents: string[];
  diffCounts: { new: number; worsened: number; resolved: number };
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const body = (
    <div className="space-y-5">
      <div>
        <label htmlFor="sort" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-subtle">
          Sort by
        </label>
        <Select id="sort" value={sort} onChange={(e) => onSort(e.target.value as SortKey)} className="h-9">
          <option value="priority">Priority</option>
          <option value="proximity">Proximity (soonest first)</option>
          <option value="newest">Newest</option>
        </Select>
      </div>
      <Group legend="Severity">
        {SEVERITY_ORDER.map((s) => (
          <Check key={s} label={SEVERITY_META[s].label} dot={SEVERITY_META[s].dot} count={counts.severity[s] ?? 0} checked={filters.severity.includes(s)} onChange={() => onChange({ ...filters, severity: toggle(filters.severity, s) })} />
        ))}
      </Group>
      <Group legend="Category">
        {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
          <Check key={k} label={v} count={counts.category[k] ?? 0} checked={filters.category.includes(k)} onChange={() => onChange({ ...filters, category: toggle(filters.category, k) })} />
        ))}
      </Group>
      <Group legend="Status">
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <Check key={k} label={v} count={counts.status[k] ?? 0} checked={filters.status.includes(k)} onChange={() => onChange({ ...filters, status: toggle(filters.status, k) })} />
        ))}
      </Group>
      <Group legend="Confidence">
        {Object.entries(CONFIDENCE_LABEL).map(([k, v]) => (
          <Check key={k} label={v} count={counts.confidence[k] ?? 0} checked={filters.confidence.includes(k)} onChange={() => onChange({ ...filters, confidence: toggle(filters.confidence, k) })} />
        ))}
      </Group>
      {documents.length > 0 ? (
        <div>
          <label htmlFor="doc-filter" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-subtle">
            Document
          </label>
          <Select id="doc-filter" value={filters.document} onChange={(e) => onChange({ ...filters, document: e.target.value })} className="h-9">
            <option value="">All documents</option>
            {documents.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </div>
      ) : null}
      {diffCounts.new + diffCounts.worsened + diffCounts.resolved > 0 ? (
        <Group legend="Since last run">
          {(
            [
              ["all", "Everything", activeCount],
              ["new", "New", diffCounts.new],
              ["worsened", "Worsened", diffCounts.worsened],
              ["resolved", "Resolved", diffCounts.resolved],
            ] as const
          ).map(([k, label, n]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-surface-2">
              <input type="radio" name="change" checked={filters.change === k} onChange={() => onChange({ ...filters, change: k })} className="size-4 accent-[var(--accent)]" />
              <span className="flex-1">{label}</span>
              <span className="text-xs tabular-nums text-subtle">{n}</span>
            </label>
          ))}
        </Group>
      ) : null}
      <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="t-fast text-sm font-medium text-accent hover:underline">
        Clear filters
      </button>
    </div>
  );
  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="filters-mobile"
          onClick={() => setOpen((o) => !o)}
          className="t-fast inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium"
        >
          <ListFilter aria-hidden className="size-4" /> Filters and sorting
        </button>
        {open ? (
          <div id="filters-mobile" className="mt-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
            {body}
          </div>
        ) : null}
      </div>
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1">{body}</div>
      </aside>
    </>
  );
}
