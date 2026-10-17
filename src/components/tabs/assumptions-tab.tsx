"use client";
import { ClipboardList } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface A {
  id: string;
  statement: string;
  sourceDoc: string;
  sourceLocator: string;
  sourceQuote: string;
  riskIfFalse: string;
  status: "UNVALIDATED" | "VALIDATED" | "INVALID";
}
const OPTIONS = [
  ["UNVALIDATED", "Unvalidated"],
  ["VALIDATED", "Validated"],
  ["INVALID", "Invalid"],
] as const;

export function AssumptionsTab({ projectId, refreshKey }: { projectId: string; refreshKey: string }) {
  const toast = useToast();
  const [items, setItems] = useState<A[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems((await api<{ assumptions: A[] }>(`/api/projects/${projectId}/assumptions`)).assumptions);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [projectId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  async function setStatus(a: A, status: A["status"]) {
    setItems((cur) => cur?.map((x) => (x.id === a.id ? { ...x, status } : x)) ?? cur);
    try {
      await api(`/api/assumptions/${a.id}`, { method: "PATCH", json: { status } });
    } catch {
      toast("Couldn't update the assumption.", "error");
      void load();
    }
  }

  if (failed) return <ErrorState title="Couldn't load assumptions" onRetry={() => void load()} />;
  if (!items)
    return (
      <div className="space-y-3" role="status" aria-label="Loading assumptions">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  if (items.length === 0) return <EmptyState icon={<ClipboardList aria-hidden className="size-5" />} title="No assumptions yet">Run an analysis. Statements your documents take for granted, such as &quot;the vendor API will be available&quot;, are collected here.</EmptyState>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {items.filter((a) => a.status === "UNVALIDATED").length} of {items.length} assumptions are not yet validated.
      </p>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <p className="measure text-[15px] font-medium leading-snug">{a.statement}</p>
            <blockquote className="mt-2 border-l-2 border-border-strong pl-3 text-sm text-muted">
              “{a.sourceQuote}”
              <footer className="mt-0.5 text-xs text-subtle">
                {a.sourceDoc} · <span className="font-mono">{a.sourceLocator}</span>
              </footer>
            </blockquote>
            <p className="mt-3 text-sm">
              <span className="font-medium">Risk if false:</span> <span className="text-muted">{a.riskIfFalse}</span>
            </p>
            <div role="radiogroup" aria-label="Validation status" className="mt-3 inline-flex rounded-lg border border-border-strong p-0.5">
              {OPTIONS.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={a.status === v}
                  onClick={() => void setStatus(a, v)}
                  className={cn("t-fast rounded-md px-3 py-1 text-xs font-medium", a.status === v ? (v === "INVALID" ? "bg-danger-bg text-danger-fg" : v === "VALIDATED" ? "bg-ok-bg text-ok-fg" : "bg-surface-2 text-foreground") : "text-muted hover:text-foreground")}
                >
                  {label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
