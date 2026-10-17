"use client";
import { Check, Copy, ExternalLink, FileSearch, MessageSquare, ThumbsDown, ThumbsUp, Copy as CopyIcon, Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/form";
import { CategoryBadge, ConfidenceLabel, CONFIDENCE_HELP, SeverityBadge, StatusChip } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";
import { FACTOR_LABELS, FACTORS, type Weights } from "@/lib/analysis/scoring";
import { api, ApiFail } from "@/lib/client";
import type { FeedbackKindKey, FindingStatusKey } from "@/lib/data/findings";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ScoredView } from "./finding-card";
import type { JumpTarget } from "./evidence-sheet";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: string;
}

const FEEDBACK: Array<{ kind: FeedbackKindKey; label: string; Icon: typeof ThumbsUp }> = [
  { kind: "USEFUL", label: "Useful", Icon: ThumbsUp },
  { kind: "NOT_USEFUL", label: "Not useful", Icon: ThumbsDown },
  { kind: "WRONG", label: "Wrong", Icon: Flag },
  { kind: "DUPLICATE", label: "Duplicate", Icon: CopyIcon },
];

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-border pt-5">
      <h3 id={id} className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function FindingDetail({
  f,
  weights,
  docs,
  onStatus,
  onFeedback,
  onJump,
}: {
  f: ScoredView;
  weights: Weights;
  docs: Array<{ id: string; name: string }>;
  onStatus: (s: FindingStatusKey, reason: string | null) => Promise<void>;
  onFeedback: (k: FeedbackKindKey) => Promise<void>;
  onJump: (t: JumpTarget) => void;
}) {
  const toast = useToast();
  const [pendingStatus, setPendingStatus] = useState<FindingStatusKey | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const id = f.id;

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComments(null);
    api<{ comments: Comment[] }>(`/api/findings/${id}`)
      .then((j) => !cancelled && setComments(j.comments))
      .catch(() => !cancelled && setCommentError("Couldn't load comments."));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function setStatus(s: FindingStatusKey, why: string | null) {
    setBusy(true);
    try {
      await onStatus(s, why);
      setPendingStatus(null);
      setReason("");
      setReasonError(null);
    } catch (e) {
      toast(e instanceof ApiFail ? e.message : "Couldn't update the status.", "error");
    } finally {
      setBusy(false);
    }
  }

  function choose(s: FindingStatusKey) {
    if (s === "REJECTED" || s === "ALREADY_KNOWN") {
      setPendingStatus(s);
      setReason(f.status === s ? (f.statusReason ?? "") : "");
      return;
    }
    setPendingStatus(null);
    void setStatus(s, null);
  }

  async function confirmReason() {
    if (reason.trim().length < 3) return setReasonError("Add a short reason.");
    await setStatus(pendingStatus!, reason.trim());
  }

  async function post() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await api(`/api/findings/${id}/comments`, { method: "POST", json: { body: draft.trim() } });
      const j = await api<{ comments: Comment[] }>(`/api/findings/${id}`);
      setComments(j.comments);
      setDraft("");
    } catch (e) {
      toast(e instanceof ApiFail ? e.message : "Couldn't post the comment.", "error");
    } finally {
      setPosting(false);
    }
  }

  async function copyQuestion() {
    try {
      await navigator.clipboard.writeText(f.question);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy. Select the text and copy it manually.", "error");
    }
  }

  const reweighted = FACTORS.some((k) => weights[k] !== 1);

  return (
    <article aria-label={f.title} className="space-y-5 p-5">
      <header>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={f.sev} />
          <CategoryBadge category={f.category} />
          <StatusChip status={f.status} />
        </div>
        <h2 className="text-lg font-semibold leading-snug">{f.title}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>
            Priority <strong className="font-semibold tabular-nums text-foreground">{f.score}</strong>/100
            {f.previousPriority !== null && f.previousPriority !== f.priority ? <span className="ml-1 text-xs text-subtle">(was {f.previousPriority})</span> : null}
          </span>
          <ConfidenceLabel value={f.confidence} />
        </p>
        <p className="mt-1 text-xs text-subtle">{CONFIDENCE_HELP[f.confidence]}</p>
        {f.status !== "OPEN" && f.statusReason ? <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">Reason: {f.statusReason}</p> : null}
      </header>

      <Section id="why" title="Why this matters">
        <p className="measure text-sm leading-relaxed">{f.whyItMatters}</p>
      </Section>

      <Section id="evidence" title="Evidence">
        {f.isAbsence ? (
          <div className="mb-3 rounded-lg border border-dashed border-border-strong bg-surface-2 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <FileSearch aria-hidden className="size-4" /> Not found in provided materials
            </p>
            {f.checkedDocuments.length ? (
              <>
                <p className="mt-2 text-xs text-muted">Documents checked:</p>
                <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                  {f.checkedDocuments.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
        {f.evidence.length ? (
          <ul className="space-y-3">
            {f.evidence.map((e, i) => {
              const doc = e.documentId && e.documentId !== "__project__" ? docs.find((d) => d.id === e.documentId) : docs.find((d) => d.name === e.documentName);
              return (
                <li key={i} className="rounded-lg border border-border">
                  <blockquote className="measure px-3 pt-3 text-sm leading-relaxed">
                    <span aria-hidden className="mr-1 text-subtle">
                      “
                    </span>
                    {e.quote.replace(/^\s*[-*•]\s+/, "")}
                    <span aria-hidden className="ml-0.5 text-subtle">
                      ”
                    </span>
                  </blockquote>
                  {e.note ? <p className="px-3 pt-1 text-xs italic text-muted">{e.note}</p> : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-foreground">{e.documentName}</span> · <span className="font-mono">{e.locator}</span>
                    </span>
                    {doc ? (
                      <button type="button" onClick={() => onJump({ documentId: doc.id, name: doc.name, locator: e.locator })} className="t-fast inline-flex items-center gap-1 font-medium text-accent hover:underline">
                        View in document <ExternalLink aria-hidden className="size-3" />
                      </button>
                    ) : (
                      <span className="text-subtle">From your project details</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : !f.isAbsence ? (
          <p className="text-sm text-muted">No quotes attached.</p>
        ) : null}
      </Section>

      <Section id="scores" title="Score breakdown">
        <p className="mb-3 text-xs text-subtle">Priority = Impact × Likelihood × Irreversibility × Proximity ÷ Cost to resolve, scaled to 0–100.{reweighted ? " Your custom weights are applied." : ""}</p>
        <ul className="space-y-3">
          {FACTORS.map((k) => (
            <li key={k}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{FACTOR_LABELS[k].label}</span>
                <span className="flex items-center gap-1.5" role="img" aria-label={`${f.factors[k]} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} aria-hidden className={cn("size-2 rounded-full", n <= f.factors[k] ? "bg-accent" : "bg-border-strong")} />
                  ))}
                  <span className="ml-1 w-3 text-sm font-semibold tabular-nums">{f.factors[k]}</span>
                </span>
              </div>
              <p className="measure mt-0.5 text-sm text-muted">{f.justifications[k]}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="disprove" title="What would disprove this?">
        <p className="measure text-sm leading-relaxed">{f.disproof}</p>
      </Section>

      <Section id="action" title="Recommended action">
        <div className="space-y-3 rounded-lg bg-accent-soft p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-soft-fg">Ask</p>
            <p className="measure mt-1 text-sm font-medium leading-relaxed text-foreground">{f.question}</p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-accent-soft-fg">Who can answer</dt>
              <dd className="mt-0.5 text-foreground">{f.owner}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-accent-soft-fg">Next step</dt>
              <dd className="mt-0.5 text-foreground">{f.nextStep}</dd>
            </div>
          </dl>
          <Button size="sm" variant="secondary" onClick={() => void copyQuestion()}>
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />} {copied ? "Copied" : "Copy question"}
          </Button>
        </div>
      </Section>

      <Section id="decide" title="Your decision">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Set status">
          {(
            [
              ["ACCEPTED", "Accept"],
              ["REJECTED", "Reject"],
              ["DEFERRED", "Defer"],
              ["ALREADY_KNOWN", "Already known"],
            ] as const
          ).map(([s, label]) => (
            <Button key={s} size="sm" variant={f.status === s ? "primary" : "secondary"} aria-pressed={f.status === s} disabled={busy} onClick={() => choose(s)}>
              {label}
            </Button>
          ))}
          {f.status !== "OPEN" ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => choose("OPEN")}>
              Reopen
            </Button>
          ) : null}
        </div>
        {pendingStatus ? (
          <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
            <label htmlFor="reason" className="block text-sm font-medium">
              {pendingStatus === "REJECTED" ? "Why are you rejecting this?" : "Where is this already covered?"}
            </label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!reasonError} className="min-h-20" />
            {reasonError ? (
              <p role="alert" className="text-sm font-medium text-danger-fg">
                {reasonError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" loading={busy} onClick={() => void confirmReason()}>
                {pendingStatus === "REJECTED" ? "Reject finding" : "Mark as already known"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingStatus(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section id="comments" title="Comments">
        {comments === null && !commentError ? (
          <Skeleton className="h-10" />
        ) : commentError ? (
          <Alert variant="error">{commentError}</Alert>
        ) : comments && comments.length ? (
          <ul className="mb-3 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap">{c.body}</p>
                <p className="mt-1 text-xs text-subtle">
                  {c.author} · {timeAgo(c.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-muted">No comments yet.</p>
        )}
        <label htmlFor="comment" className="sr-only">
          Add a comment
        </label>
        <Textarea id="comment" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note for your team…" maxLength={2000} className="min-h-20" />
        <Button size="sm" className="mt-2" variant="secondary" disabled={!draft.trim()} loading={posting} onClick={() => void post()}>
          <MessageSquare aria-hidden className="size-4" /> Comment
        </Button>
      </Section>

      <Section id="feedback" title="Was this finding helpful?">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Feedback on this finding">
          {FEEDBACK.map(({ kind, label, Icon }) => (
            <Button key={kind} size="sm" variant={f.myFeedback === kind ? "primary" : "secondary"} aria-pressed={f.myFeedback === kind} onClick={() => void onFeedback(kind)}>
              <Icon aria-hidden className="size-4" /> {label}
            </Button>
          ))}
        </div>
      </Section>
    </article>
  );
}
