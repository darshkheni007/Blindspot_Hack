"use client";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, ApiFail } from "@/lib/client";

function NameForm({ title, label, initial, url, hint }: { title: string; label: string; initial: string; url: string; hint?: string }) {
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await api(url, { method: "PATCH", json: { name: value } });
      toast("Saved.");
    } catch (err) {
      setError(err instanceof ApiFail ? (err.fieldErrors?.name?.[0] ?? err.message) : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <form onSubmit={save} className="mt-4 space-y-4" noValidate>
        <Field id={`${title}-name`} label={label} hint={hint} error={error}>
          {(a) => <Input {...a} value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} />}
        </Field>
        <Button type="submit" loading={saving} disabled={!value.trim() || value === initial}>
          Save
        </Button>
      </form>
    </Card>
  );
}

export function SettingsForms({ name, email, workspaceName }: { name: string; email: string; workspaceName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function wipe() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/me", { method: "DELETE", json: { confirmEmail: confirm } });
      await signOut({ redirectTo: "/" });
    } catch (e) {
      setError(e instanceof ApiFail ? (e.fieldErrors?.confirmEmail?.[0] ?? e.message) : "Couldn't delete your data.");
      setBusy(false);
    }
  }

  return (
    <>
      <NameForm title="Profile" label="Name" initial={name} url="/api/me" hint={`Signed in as ${email}`} />
      <NameForm title="Workspace" label="Workspace name" initial={workspaceName} url="/api/workspace" />
      <Card className="border-danger/40 p-5">
        <h2 className="text-base font-semibold">Delete my data</h2>
        <p className="measure mt-1 text-sm text-muted">Permanently removes your account, workspace, every project, uploaded file, extracted text, finding and comment. Nothing is kept. This can&apos;t be undone.</p>
        <Button variant="danger-outline" className="mt-4" onClick={() => setOpen(true)}>
          Delete everything
        </Button>
      </Card>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setConfirm("");
        }}
        title="Delete all your data?"
        description="Type your email address to confirm. Your files and results are removed immediately."
        confirmLabel="Delete everything"
        onConfirm={() => void wipe()}
        loading={busy}
      >
        <div className="mt-4">
          <label htmlFor="confirm-email" className="sr-only">
            Your email address
          </label>
          <Input id="confirm-email" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={email} autoComplete="off" />
          {error ? <Alert variant="error" className="mt-3">{error}</Alert> : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
