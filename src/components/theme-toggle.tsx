"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "blindspot-theme";
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
const snap = () => document.documentElement.classList.contains("dark");

/** Follows the system preference until the user picks one; the choice is a per-browser convenience only. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, snap, () => false);
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* storage unavailable: choice just won't persist */
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="t-fast inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
    >
      {dark ? <Sun aria-hidden className="size-[18px]" /> : <Moon aria-hidden className="size-[18px]" />}
    </button>
  );
}

export const THEME_SCRIPT = `try{var t=localStorage.getItem('${KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}`;
