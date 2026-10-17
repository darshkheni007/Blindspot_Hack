import { dayToIso } from "../facts";
import type { Evidence, RawFinding } from "../types";

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function trunc(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…";
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDay(day: number): string {
  const [y, m, d] = dayToIso(day).split("-").map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
}
export function ev(documentName: string, locator: string, quote: string, note?: string): Evidence {
  return { documentName, locator, quote, ...(note ? { note } : {}) };
}
export type FindingDraft = Omit<RawFinding, "absenceTerms" | "checkedDocuments" | "isAbsence"> &
  Partial<Pick<RawFinding, "absenceTerms" | "checkedDocuments" | "isAbsence">>;
export function finding(d: FindingDraft): RawFinding {
  return { absenceTerms: [], checkedDocuments: [], isAbsence: false, ...d };
}
export const clampInt = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
