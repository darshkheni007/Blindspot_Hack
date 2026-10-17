import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  const s = await auth();
  if (s?.user?.id) redirect(next);
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Welcome back. Pick up where you left off.</p>
      <AuthForm mode="sign-in" next={next} googleEnabled={env.googleEnabled} />
    </>
  );
}
