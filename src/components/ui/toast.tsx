"use client";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface Toast { id: number; message: string; kind: "success" | "error" }
const Ctx = React.createContext<(message: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => React.useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 no-print">
        {toasts.map((t) => (
          <div key={t.id} className={cn("fade-in pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm shadow-lg")}>
            {t.kind === "success" ? <CheckCircle2 aria-hidden className="size-4 text-ok-fg" /> : <AlertTriangle aria-hidden className="size-4 text-danger-fg" />}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
