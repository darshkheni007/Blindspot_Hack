import { AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

const alertStyles = {
  info: { cls: "bg-accent-soft text-accent-soft-fg", Icon: Info },
  success: { cls: "bg-ok-bg text-ok-fg", Icon: CheckCircle2 },
  warning: { cls: "bg-warn-bg text-warn-fg", Icon: AlertTriangle },
  error: { cls: "bg-danger-bg text-danger-fg", Icon: AlertTriangle },
} as const;

export function Alert({ variant = "info", children, className, role }: { variant?: keyof typeof alertStyles; children: React.ReactNode; className?: string; role?: string }) {
  const { cls, Icon } = alertStyles[variant];
  return (
    <div role={role ?? (variant === "error" ? "alert" : "status")} className={cn("flex items-start gap-3 rounded-lg px-4 py-3 text-sm", cls, className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      {icon ? <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {children ? <p className="measure mt-1.5 text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-[var(--radius-card)] border border-border bg-surface px-6 py-12 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-danger-bg text-danger-fg">
        <AlertTriangle aria-hidden className="size-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="measure mt-1.5 text-sm text-muted">{message ?? "We couldn't load this. Check your connection and try again."}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCw aria-hidden className="size-4" /> Try again
        </Button>
      ) : null}
    </div>
  );
}
