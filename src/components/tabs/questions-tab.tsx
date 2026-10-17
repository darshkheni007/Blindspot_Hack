"use client";
import { Check, Copy, HelpCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { SeverityBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { SeverityKey } from "@/lib/analysis/scoring";

interface Q {
  id: string;
  text: string;
  suggestedOwner: string;
  status: "OPEN" | "ASKED" | "ANSWERED" | "DROPPED";
  findingTitle: string | null;
  severity: SeverityKey;
  priority: number;
}
const LABEL = { OPEN: "Not asked", ASKED: "Asked", ANSWERED: "Answered", DROPPED: "Dropped" } as const;

export function QuestionsTab({ projectId, refreshKey }: { projectId: string; refreshKey: string }) {
  const toast = useToast();
  const [items, setItems] = useState<Q[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ questions: Q[] }>(`/api/projects/${projectId}/questions`)).questions);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [projectId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  async function setStatus(q: Q, status: Q["status"]) {
    setItems((cur) => cur?.map((x) => (x.id === q.id ? { ...x, status } : x)) ?? cur);
    try {
      await api(`/api/questions/${q.id}`, { method: "PATCH", json: { status } });
    } catch {
      toast("Couldn't update the question.", "error");
      void load();
    }
  }
  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
    } catch {
      toast("Couldn't copy. Select the text and copy it manually.", "error");
    }
  }

  if (failed) return <ErrorState title="Couldn't load questions" onRetry={() => void load()} />;
  if (!items)
    return (
      <div className="space-y-3" role="status" aria-label="Loading questions">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  if (items.length === 0) return <EmptyState icon={<HelpCircle aria-hidden className="size-5" />} title="No questions yet">Run an analysis. The questions your documents don&apos;t answer will be listed here, with who should answer them.</EmptyState>;

  const open = items.filter((q) => q.status === "OPEN");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {open.length} not yet asked · {items.length} in total
        </p>
        <Button variant="secondary" size="sm" disabled={!open.length} onClick={() => void copy(open.map((q, i) => `${i + 1}. ${q.text} (${q.suggestedOwner})`).join("\n"), "all")}>
          {copied === "all" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />} Copy all unasked
        </Button>
      </div>
      <ul className="space-y-3">
        {items.map((q) => (
          <li key={q.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1 basis-72">
                <p className="measure text-[15px] font-medium leading-snug">{q.text}</p>
                <p className="mt-1.5 text-sm text-muted">
                  Ask: <span className="text-foreground">{q.suggestedOwner}</span>
                </p>
                {q.findingTitle ? <p className="mt-1 text-xs text-subtle">From: {q.findingTitle}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {q.priority ? <SeverityBadge severity={q.severity} /> : null}
                <label className="sr-only" htmlFor={`q-${q.id}`}>
                  Status of question
                </label>
                <Select id={`q-${q.id}`} value={q.status} onChange={(e) => void setStatus(q, e.target.value as Q["status"])} className="h-8 w-32 text-xs">
                  {Object.entries(LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
                <Button size="icon" variant="ghost" onClick={() => void copy(q.text, q.id)} aria-label="Copy question">
                  {copied === q.id ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
