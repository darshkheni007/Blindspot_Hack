import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/auth";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireCtx } from "@/lib/data/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur no-print">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo href="/dashboard" />
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 text-sm sm:flex">
            <Link href="/dashboard" className="t-fast rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
              Projects
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-2 hidden max-w-48 truncate text-sm text-subtle md:inline" title={ctx.email}>
              {ctx.email}
            </span>
            <ThemeToggle />
            <Link href="/settings" aria-label="Settings" className="t-fast inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
              <Settings aria-hidden className="size-[18px]" />
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" aria-label="Sign out" className="t-fast inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
                <LogOut aria-hidden className="size-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
