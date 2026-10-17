"use client";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DocumentsPanel } from "@/components/documents-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { DOMAINS, STAGES } from "@/config/app";
import type { DocItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Basics", "Context", "Documents"];
type Errors = Record<string, string[] | undefined>;

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const form = useRef<HTMLFormElement>(null);

  function val(name: string) {
    return String((form.current?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "");
  }

  function next() {
    const errs: Errors = {};
    if (!val("name").trim()) errs.name = ["Give the project a name."];
    if (!val("goal").trim()) errs.goal = ["Describe the goal in a sentence or two."];
    if (Object.keys(errs).length) return setErrors(errs);
    setErrors({});
    setStep(1);
  }

  async function createAndContinue() {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: val("name"),
          domain: val("domain"),
          stage: val("stage"),
          goal: val("goal"),
          deadline: val("deadline"),
          budget: val("budget"),
          teamSize: val("teamSize"),
          knownRisks: val("knownRisks"),
        }),
      });
      const j = (await res.json()) as { id?: string; message?: string; fieldErrors?: Errors };
      if (!res.ok || !j.id) {
        if (j.fieldErrors) {
          setErrors(j.fieldErrors);
          if (j.fieldErrors.name || j.fieldErrors.goal) setStep(0);
        }
        setError(j.message ?? "Couldn't create the project.");
        return;
      }
      setProjectId(j.id);
      setStep(2);
    } catch {
      setError("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(analyze: boolean) {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      if (analyze) {
        const res = await fetch(`/api/projects/${projectId}/analyze`, { method: "POST" });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          setError(j.message ?? "Couldn't start the analysis.");
          setBusy(false);
          return;
        }
      }
      router.push(`/projects/${projectId}?tab=${analyze ? "findings" : "documents"}`);
    } catch {
      setError("Network problem. Check your connection and try again.");
      setBusy(false);
    }
  }

  const ready = docs.filter((d) => d.status === "READY").length;
  const parsing = docs.some((d) => d.status === "PARSING");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
      <ol className="my-6 flex items-center gap-2 text-sm" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold", i < step ? "bg-accent text-accent-fg" : i === step ? "border-2 border-accent text-accent" : "border border-border-strong text-subtle")}>
              {i < step ? <Check aria-hidden className="size-3.5" /> : i + 1}
            </span>
            <span className={cn(i === step ? "font-medium" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 ? <span aria-hidden className="mx-1 h-px w-6 bg-border-strong sm:w-10" /> : null}
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-6">
        {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
        <form ref={form} onSubmit={(e) => e.preventDefault()} noValidate>
          <div className={step === 0 ? "space-y-5" : "hidden"}>
            <Field id="name" label="Project name" error={errors.name?.[0]}>
              {(a) => <Input {...a} name="name" maxLength={120} placeholder="e.g. Billing platform migration" />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="domain" label="Domain">
                {(a) => (
                  <Select {...a} name="domain" defaultValue="SOFTWARE">
                    {DOMAINS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id="stage" label="Stage">
                {(a) => (
                  <Select {...a} name="stage" defaultValue="IN_PROGRESS">
                    {STAGES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field id="goal" label="Goal" hint="What is this project trying to achieve, and for whom?" error={errors.goal?.[0]}>
              {(a) => <Textarea {...a} name="goal" maxLength={1000} />}
            </Field>
          </div>

          <div className={step === 1 ? "space-y-5" : "hidden"}>
            <p className="text-sm text-muted">All optional. Anything you add here is cross-checked against your documents, so a deadline that disagrees with the plan will show up as a finding.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="deadline" label="Deadline" error={errors.deadline?.[0]}>
                {(a) => <Input {...a} name="deadline" type="date" />}
              </Field>
              <Field id="budget" label="Budget" error={errors.budget?.[0]}>
                {(a) => <Input {...a} name="budget" placeholder="e.g. $350,000" maxLength={60} />}
              </Field>
              <Field id="teamSize" label="Team size" error={errors.teamSize?.[0]}>
                {(a) => <Input {...a} name="teamSize" type="number" min={1} />}
              </Field>
            </div>
            <Field id="knownRisks" label="Known risks" hint="What are you already worried about? Blindspot looks past these." error={errors.knownRisks?.[0]}>
              {(a) => <Textarea {...a} name="knownRisks" maxLength={2000} />}
            </Field>
          </div>
        </form>

        {step === 2 && projectId ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">Add the PRD, plan, budget, contract or data files for this project. Two or more documents give the best results, because Blindspot compares them.</p>
            <DocumentsPanel projectId={projectId} onChange={setDocs} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          {step === 0 ? (
            <span />
          ) : step === 1 ? (
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => void finish(false)} disabled={busy}>
              Skip analysis for now
            </Button>
          )}
          {step === 0 ? <Button onClick={next}>Continue</Button> : null}
          {step === 1 ? (
            <Button onClick={() => void createAndContinue()} loading={busy}>
              Create project
            </Button>
          ) : null}
          {step === 2 ? (
            <Button onClick={() => void finish(true)} loading={busy} disabled={ready === 0 || parsing}>
              {parsing ? "Reading documents…" : "Analyze documents"}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
