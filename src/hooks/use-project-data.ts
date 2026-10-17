"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FindingDTO } from "@/lib/data/findings";
import type { RunDTO } from "@/lib/data/runs";
import { api, ApiFail } from "@/lib/client";

export interface ProjectStatus {
  project: { id: string; name: string; weights: Record<string, number> | null; lastAnalyzedAt: string | null };
  run: RunDTO | null;
  documents: Array<{ id: string; name: string; status: "PARSING" | "READY" | "FAILED"; error: string | null }>;
  stats: { total: number; open: number; critical: number; reviewed: number; resolvedPct: number };
  stale: boolean;
}

/**
 * Loads project status + findings and polls while an analysis is running, so findings stream in
 * as the server upserts them. Polling stops when the run finishes.
 */
export function useProjectData(projectId: string) {
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [findings, setFindings] = useState<FindingDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTotal = useRef(-1);
  const lastRun = useRef<string | null>(null);

  const loadFindings = useCallback(async () => {
    const j = await api<{ findings: FindingDTO[] }>(`/api/projects/${projectId}/findings?resolved=1`);
    setFindings(j.findings);
  }, [projectId]);

  const refresh = useCallback(async () => {
    try {
      const s = await api<ProjectStatus>(`/api/projects/${projectId}/status`);
      setStatus(s);
      setError(null);
      const sig = `${s.run?.id}:${s.run?.status}`;
      if (lastTotal.current !== s.stats.total || lastRun.current !== sig) {
        lastTotal.current = s.stats.total;
        lastRun.current = sig;
        await loadFindings();
      }
    } catch (e) {
      setError(e instanceof ApiFail ? e.message : "Couldn't load this project.");
    }
  }, [projectId, loadFindings]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const active = status?.run?.status === "QUEUED" || status?.run?.status === "RUNNING";
  const parsing = status?.documents.some((d) => d.status === "PARSING") ?? false;
  useEffect(() => {
    if (!active && !parsing) return;
    const t = setInterval(() => void refresh(), 1200);
    return () => clearInterval(t);
  }, [active, parsing, refresh]);

  const analyze = useCallback(async () => {
    await api(`/api/projects/${projectId}/analyze`, { method: "POST" });
    await refresh();
  }, [projectId, refresh]);

  const patchFinding = useCallback((id: string, patch: Partial<FindingDTO>) => {
    setFindings((cur) => cur?.map((f) => (f.id === id ? { ...f, ...patch } : f)) ?? cur);
  }, []);

  return { status, findings, error, active, refresh, analyze, patchFinding, reloadFindings: loadFindings };
}
