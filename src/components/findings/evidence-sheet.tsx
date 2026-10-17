"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface JumpTarget {
  documentId: string;
  name: string;
  locator: string;
}
interface Chunk {
  id: string;
  locator: string;
  text: string;
}

/** Opens the source document at the cited location (the "jump link" for evidence). */
export function EvidenceSheet({ target, onClose }: { target: JumpTarget | null; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ id: string; chunks: Chunk[] } | "error" | null>(null);
  const hit = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    void fetch(`/api/documents/${target.documentId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { chunks: Chunk[] }) => !cancelled && setLoaded({ id: target.documentId, chunks: j.chunks }))
      .catch(() => !cancelled && setLoaded("error"));
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (loaded && loaded !== "error") hit.current?.scrollIntoView({ block: "center" });
  }, [loaded]);

  const loading = target && (loaded === null || (loaded !== "error" && loaded.id !== target.documentId));
  return (
    <Sheet
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          setLoaded(null);
          onClose();
        }
      }}
      title={target?.name ?? "Source"}
      description={target ? `Cited location: ${target.locator}` : undefined}
    >
      <div className="space-y-3 p-5">
        {loading ? (
          <>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        ) : loaded === "error" ? (
          <Alert variant="error">Couldn&apos;t load this document. It may have been deleted or replaced.</Alert>
        ) : loaded ? (
          loaded.chunks.map((c) => {
            const isHit = c.locator === target?.locator;
            return (
              <div key={c.id} ref={isHit ? hit : undefined} className={cn("rounded-lg border p-3", isHit ? "border-accent bg-accent-soft" : "border-border")}>
                <p className="mb-1 font-mono text-xs text-subtle">{c.locator}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
              </div>
            );
          })
        ) : null}
      </div>
    </Sheet>
  );
}
