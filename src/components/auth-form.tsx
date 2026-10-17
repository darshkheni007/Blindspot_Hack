"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

type Errors = Record<string, string[] | undefined>;

export function AuthForm({ mode, next, googleEnabled }: { mode: "sign-in" | "sign-up"; next: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Errors>({});
  const up = mode === "sign-up";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFields({});
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    try {
      if (up) {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: String(f.get("name") ?? ""), email, password }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string; fieldErrors?: Errors };
          setFields(j.fieldErrors ?? {});
          setError(j.fieldErrors && Object.keys(j.fieldErrors).length ? null : (j.message ?? "Couldn't create your account. Try again."));
          return;
        }
      }
      const r = await signIn("credentials", { email, password, redirect: false });
      if (!r || r.error) {
        setError(up ? "Account created, but we couldn't sign you in. Try signing in." : "Email or password is incorrect.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network problem. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {up ? (
          <Field id="name" label="Name" error={fields.name?.[0]}>
            {(a) => <Input {...a} name="name" autoComplete="name" required />}
          </Field>
        ) : null}
        <Field id="email" label="Email" error={fields.email?.[0]}>
          {(a) => <Input {...a} name="email" type="email" autoComplete="email" required />}
        </Field>
        <Field id="password" label="Password" hint={up ? "At least 10 characters." : undefined} error={fields.password?.[0]}>
          {(a) => <Input {...a} name="password" type="password" autoComplete={up ? "new-password" : "current-password"} required />}
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          {up ? "Create account" : "Sign in"}
        </Button>
      </form>
      {googleEnabled ? (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="secondary" className="w-full" onClick={() => signIn("google", { redirectTo: next })}>
            Continue with Google
          </Button>
        </>
      ) : null}
      <p className="mt-6 text-center text-sm text-muted">
        {up ? "Already have an account? " : "New here? "}
        <Link className="font-medium text-accent underline-offset-4 hover:underline" href={up ? "/sign-in" : "/sign-up"}>
          {up ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
