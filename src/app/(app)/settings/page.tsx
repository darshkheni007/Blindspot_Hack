import type { Metadata } from "next";
import { SettingsForms } from "@/components/settings-forms";
import { Card } from "@/components/ui/card";
import { PLANS } from "@/config/app";
import { requireCtx } from "@/lib/data/session";
import { getUserProfile } from "@/lib/data/users";
import { getUsage, getWorkspace } from "@/lib/data/workspaces";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {used} of {max}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${label}: ${used} of ${max} used`}>
        <div className={pct >= 100 ? "h-full bg-danger" : "h-full bg-accent"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const [profile, ws, usage] = await Promise.all([getUserProfile(ctx.userId), getWorkspace(ctx.workspaceId), getUsage(ctx.workspaceId)]);
  const plan = PLANS[usage.plan];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsForms name={profile?.name ?? ""} email={ctx.email} workspaceName={ws?.name ?? ""} />
      <Card className="p-5">
        <h2 className="text-base font-semibold">Plan and usage</h2>
        <p className="mt-1 text-sm text-muted">
          You&apos;re on the <strong className="text-foreground">{plan.label}</strong> plan. {plan.blurb}
        </p>
        <div className="mt-4 space-y-4">
          <Meter label="Projects" used={usage.projects} max={usage.maxProjects} />
          <Meter label="Documents this month" used={usage.docsThisMonth} max={usage.maxDocsPerMonth} />
        </div>
        <p className="mt-4 text-xs text-subtle">Billing isn&apos;t connected in this build, so plan changes are done by an administrator.</p>
      </Card>
    </div>
  );
}
