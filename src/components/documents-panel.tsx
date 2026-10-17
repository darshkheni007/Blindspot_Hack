"use client";
import { AlertCircle, CheckCircle2, FileText, Loader2, Trash2, UploadCloud, Eye } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { ConfirmDialog, Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { DOC_TYPES, UPLOAD } from "@/config/app";
import type { DocItem } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

interface Pending {
  key: string;
  name: string;
  state: "uploading" | "error";
  message?: string;
}

async function errorMessage(res: Response, fallback: string) {
  try {
    const j = (await res.json()) as { message?: string };
    return j.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function DocumentsPanel({ projectId, onChange }: { projectId: string; onChange?: (docs: DocItem[]) => void }) {
  const toast = useToast();
  const [docs, setDocs] = useState<DocItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<DocItem | null>(null);
  const [toDelete, setToDelete] = useState<DocItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { documents: DocItem[] };
      setDocs(j.documents);
      setLoadError(false);
      onChangeRef.current?.(j.documents);
    } catch {
      setLoadError(true);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Poll while anything is still being parsed.
  const parsing = docs?.some((d) => d.status === "PARSING") ?? false;
  useEffect(() => {
    if (!parsing) return;
    const t = setInterval(() => void load(), 1500);
    return () => clearInterval(t);
  }, [parsing, load]);

  async function upload(files: File[]) {
    for (const file of files) {
      const key = `${file.name}-${Math.random().toString(36).slice(2)}`;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!(UPLOAD.allowedExt as readonly string[]).includes(ext)) {
        setPending((p) => [...p, { key, name: file.name, state: "error", message: "Unsupported type. Use PDF, DOCX, XLSX, CSV, TXT or MD." }]);
        continue;
      }
      if (file.size > UPLOAD.maxBytes) {
        setPending((p) => [...p, { key, name: file.name, state: "error", message: "Larger than 25 MB." }]);
        continue;
      }
      setPending((p) => [...p, { key, name: file.name, state: "uploading" }]);
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: fd });
        if (!res.ok) {
          const message = await errorMessage(res, "Upload failed. Try again.");
          setPending((p) => p.map((x) => (x.key === key ? { ...x, state: "error", message } : x)));
          continue;
        }
        setPending((p) => p.filter((x) => x.key !== key));
      } catch {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, state: "error", message: "Network problem. Try again." } : x)));
      }
      await load();
    }
  }

  async function remove() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${toDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Document deleted.");
      setToDelete(null);
      await load();
    } catch {
      toast("Couldn't delete that document.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function retype(d: DocItem, docType: string) {
    setDocs((cur) => cur?.map((x) => (x.id === d.id ? { ...x, docType } : x)) ?? cur);
    const res = await fetch(`/api/documents/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docType }) });
    if (!res.ok) {
      toast("Couldn't change the type.", "error");
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "t-fast flex flex-col items-center rounded-[var(--radius-card)] border border-dashed px-6 py-10 text-center",
          dragging ? "border-accent bg-accent-soft" : "border-border-strong bg-surface",
        )}
      >
        <UploadCloud aria-hidden className="mb-3 size-8 text-subtle" />
        <p className="text-sm font-medium">Drop files here, or</p>
        <Button variant="secondary" className="mt-3" onClick={() => input.current?.click()}>
          Choose files
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          aria-label="Upload documents"
          accept={UPLOAD.allowedExt.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <p className="mt-3 text-xs text-subtle">PDF, DOCX, XLSX, CSV, TXT, MD · up to 25 MB each</p>
      </div>

      {pending.map((p) => (
        <div key={p.key} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          {p.state === "uploading" ? <Loader2 aria-hidden className="size-4 animate-spin text-accent" /> : <AlertCircle aria-hidden className="size-4 text-danger-fg" />}
          <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
          <span className={cn("text-xs", p.state === "error" ? "text-danger-fg" : "text-muted")}>{p.state === "uploading" ? "Uploading…" : p.message}</span>
          {p.state === "error" ? (
            <Button size="sm" variant="ghost" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
              Dismiss
            </Button>
          ) : null}
        </div>
      ))}

      {loadError ? (
        <ErrorState title="Couldn't load documents" onRetry={() => void load()} />
      ) : docs === null ? (
        <div className="space-y-2" role="status" aria-label="Loading documents">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : docs.length === 0 && pending.length === 0 ? (
        <EmptyState icon={<FileText aria-hidden className="size-5" />} title="No documents yet">
          Upload a PRD, plan, budget or contract. Blindspot compares them with each other to find what&apos;s missing or inconsistent.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <FileText aria-hidden className="size-5 shrink-0 text-subtle" />
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-xs text-subtle">
                  {formatBytes(d.sizeBytes)}
                  {d.status === "READY" ? ` · ${d.chunkCount} sections read` : ""}
                </p>
                {d.status === "FAILED" && d.error ? <p className="mt-1 text-xs text-danger-fg">{d.error}</p> : null}
              </div>
              <DocStatus status={d.status} />
              <label className="sr-only" htmlFor={`type-${d.id}`}>
                Document type for {d.name}
              </label>
              <Select id={`type-${d.id}`} value={d.docType} onChange={(e) => void retype(d, e.target.value)} className="h-8 w-28 text-xs">
                {DOC_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={d.status !== "READY"} onClick={() => setPreview(d)} aria-label={`Preview extracted text of ${d.name}`}>
                  <Eye aria-hidden className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setToDelete(d)} aria-label={`Delete ${d.name}`}>
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PreviewSheet doc={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this document?"
        description={`"${toDelete?.name ?? ""}" and its extracted text will be removed permanently. Run the analysis again to refresh your findings.`}
        confirmLabel="Delete document"
        onConfirm={() => void remove()}
        loading={deleting}
      />
    </div>
  );
}

function DocStatus({ status }: { status: DocItem["status"] }) {
  if (status === "READY")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ok-fg">
        <CheckCircle2 aria-hidden className="size-4" /> Ready
      </span>
    );
  if (status === "FAILED")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger-fg">
        <AlertCircle aria-hidden className="size-4" /> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <Loader2 aria-hidden className="size-4 animate-spin" /> Parsing
    </span>
  );
}

function PreviewSheet({ doc, onClose }: { doc: DocItem | null; onClose: () => void }) {
  const [state, setState] = useState<{ id: string; chunks: Array<{ id: string; locator: string; text: string }> } | "error" | null>(null);
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void fetch(`/api/documents/${doc.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { chunks: Array<{ id: string; locator: string; text: string }> }) => !cancelled && setState({ id: doc.id, chunks: j.chunks }))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [doc]);
  const loading = doc && (state === null || (state !== "error" && state.id !== doc.id));
  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && (setState(null), onClose())} title={doc?.name ?? "Preview"} description="What Blindspot extracted from this file. Check that tables and numbers came through correctly.">
      <div className="space-y-3 p-5">
        {loading ? (
          <>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        ) : state === "error" ? (
          <Alert variant="error">Couldn&apos;t load the preview. Close this and try again.</Alert>
        ) : state ? (
          state.chunks.map((c) => (
            <div key={c.id} id={`chunk-${c.id}`} className="rounded-lg border border-border p-3">
              <p className="mb-1 font-mono text-xs text-subtle">{c.locator}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
            </div>
          ))
        ) : null}
      </div>
    </Sheet>
  );
}
