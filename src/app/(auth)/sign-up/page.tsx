import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Create your account" };

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
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Free plan: 3 projects, 10 documents a month. No card needed.</p>
      <AuthForm mode="sign-up" next={next} googleEnabled={env.googleEnabled} />
    </>
  );
}
