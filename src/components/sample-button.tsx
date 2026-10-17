"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

export function SampleButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/sample", { method: "POST" });
      const j = (await res.json()) as { id?: string; message?: string };
      if (!res.ok || !j.id) throw new Error(j.message ?? "Couldn't create the sample project.");
      router.push(`/projects/${j.id}?tab=findings`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="secondary" onClick={go} loading={loading}>
        Open the sample project
      </Button>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
