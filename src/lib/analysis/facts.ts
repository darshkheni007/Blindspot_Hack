import { sentenceAround } from "./text";
import type { ChunkInfo } from "./types";

export type FactKind = "date" | "money" | "count";
export interface Fact {
  kind: FactKind;
  label: string;
  /** Comparable value: epoch-day for dates, amount for money, number for counts. */
  value: number;
  display: string;
  unit?: string;
  chunk: ChunkInfo;
  sentence: string;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

function epochDay(y: number, m: number, d: number) {
  return Math.floor(Date.UTC(y, m, d) / 86400000);
}
export function dayToIso(day: number) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

interface Hit {
  index: number;
  len: number;
  value: number;
  display: string;
  unit?: string;
}

function dateHits(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const [, y, mo, d] = m;
    hits.push({ index: m.index!, len: m[0].length, value: epochDay(+y, +mo - 1, +d), display: m[0] });
  }
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?,?\\s+(20\\d{2})\\b`, "gi"))) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    hits.push({ index: m.index!, len: m[0].length, value: epochDay(+m[3], mo, +m[1]), display: m[0] });
  }
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "gi"))) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    hits.push({ index: m.index!, len: m[0].length, value: epochDay(+m[3], mo, +m[2]), display: m[0] });
  }
  return dedupeOverlap(hits);
}

function dedupeOverlap(hits: Hit[]): Hit[] {
  const sorted = [...hits].sort((a, b) => a.index - b.index || b.len - a.len);
  const out: Hit[] = [];
  for (const h of sorted) {
    const last = out[out.length - 1];
    if (last && h.index < last.index + last.len) continue;
    out.push(h);
  }
  return out;
}

const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, lakh: 1e5, lakhs: 1e5, crore: 1e7, cr: 1e7 };
function moneyHits(text: string): Hit[] {
  const hits: Hit[] = [];
  const re = /(?:(?:USD|EUR|GBP|INR)\s?|[$€£₹]|Rs\.?\s?)(\d[\d,]*(?:\.\d+)?)\s?(k|thousand|million|mn|m|lakhs?|crore|cr)?\b/gi;
  for (const m of text.matchAll(re)) {
    const base = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    const mult = m[2] ? MULT[m[2].toLowerCase()] ?? 1 : 1;
    hits.push({ index: m.index!, len: m[0].length, value: base * mult, display: m[0].trim() });
  }
  return hits;
}

const COUNT_UNITS = "engineers?|developers?|devs|people|FTEs?|members|staff|testers?|analysts?|users|concurrent users|records|tables|services|environments|systems|applications|apps|weeks?|months?|days?|person-?months?|person-?days?";
function countHits(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(new RegExp(`\\b(\\d[\\d,]*(?:\\.\\d+)?)\\s?(?:-|\\s)?(${COUNT_UNITS})\\b`, "gi"))) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    hits.push({ index: m.index!, len: m[0].length, value: v, display: m[0], unit: normalizeUnit(m[2]) });
  }
  for (const m of text.matchAll(/\b(?:team|squad|crew) of (\d+)\b/gi)) {
    hits.push({ index: m.index!, len: m[0].length, value: +m[1], display: m[0], unit: "people" });
  }
  return hits;
}
function normalizeUnit(u: string): string {
  const x = u.toLowerCase().replace(/s$/, "");
  if (/^(engineer|developer|dev|people|member|staff|tester|analyst|fte)$/.test(x)) return "people";
  if (/person-?month/.test(x)) return "person-month";
  if (/person-?day/.test(x)) return "person-day";
  if (/concurrent user/.test(x)) return "concurrent users";
  return x;
}

type LabelDef = { label: string; re: RegExp };
const DATE_LABELS: LabelDef[] = [
  { label: "go-live date", re: /go[\s-]?live|launch|cut[\s-]?over|switch[\s-]?over|release date|production date|goes live/gi },
  { label: "deadline", re: /deadline|due date|due by|must be (?:done|complete|delivered)|no later than/gi },
  { label: "project start", re: /kick[\s-]?off|project start|start date|starts? on|begins?/gi },
  { label: "legacy shutdown", re: /decommission|shut[\s-]?down|sunset|end of (?:life|support)|contract (?:ends?|expires?|expiry|term)|licen[cs]e (?:ends?|expires?)|expires?/gi },
  { label: "code freeze", re: /code freeze|feature freeze/gi },
  { label: "UAT", re: /\bUAT\b|user acceptance/gi },
];
const MONEY_LABELS: LabelDef[] = [
  { label: "approved budget", re: /budget|funding|funded|allocated|allocation|approved|spend cap|cap of/gi },
  { label: "estimated total", re: /grand total|total|estimate[d]?|forecast|projected cost|expected cost|will cost/gi },
  { label: "contingency", re: /contingency|reserve|buffer/gi },
];
const COUNT_LABELS: LabelDef[] = [
  { label: "team size", re: /team|squad|staff(?:ed)?|headcount|assigned|available|engineers|developers|FTE/gi },
  { label: "effort", re: /effort|estimate[d]?|require[sd]?|needs?/gi },
  { label: "concurrent users", re: /concurrent|peak|simultaneous/gi },
  { label: "timeline", re: /timeline|duration|within|over|phase|sprint|for/gi },
];

/** Picks the label whose keyword sits closest before (or just after) the number. */
function nearestLabel(text: string, index: number, len: number, defs: LabelDef[]): string | null {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const nl = text.indexOf("\n", index + len);
  const lineEnd = nl === -1 ? text.length : nl;
  const from = Math.max(lineStart, index - 70);
  const win = text.slice(from, Math.min(lineEnd, index + len + 30));
  const pos = index - from;
  let best: { label: string; dist: number } | null = null;
  for (const d of defs) {
    for (const m of win.matchAll(d.re)) {
      const mi = m.index!;
      const dist = mi < pos ? pos - (mi + m[0].length) : mi - (pos + len) + 25; // keywords before the number win
      if (dist < 0) continue;
      if (!best || dist < best.dist) best = { label: d.label, dist };
    }
  }
  return best && best.dist < 80 ? best.label : null;
}

export function extractFacts(chunks: ChunkInfo[]): Fact[] {
  const facts: Fact[] = [];
  for (const chunk of chunks) {
    const t = chunk.text;
    for (const h of dateHits(t)) {
      const label = nearestLabel(t, h.index, h.len, DATE_LABELS);
      if (label) facts.push({ kind: "date", label, value: h.value, display: h.display, chunk, sentence: sentenceAround(t, h.index, h.len) });
    }
    for (const h of moneyHits(t)) {
      const label = nearestLabel(t, h.index, h.len, MONEY_LABELS);
      if (label) facts.push({ kind: "money", label, value: h.value, display: h.display, chunk, sentence: sentenceAround(t, h.index, h.len) });
    }
    for (const h of countHits(t)) {
      let label = nearestLabel(t, h.index, h.len, COUNT_LABELS);
      if (h.unit === "people" && !label) label = "team size";
      if (h.unit === "person-month" || h.unit === "person-day") label = "effort";
      if (h.unit === "concurrent users") label = "concurrent users";
      if (!label) continue;
      if (label === "team size" && h.unit !== "people") continue;
      if (label === "effort" && !h.unit?.startsWith("person")) continue;
      if (label === "timeline" && !["week", "month", "day"].includes(h.unit ?? "")) continue;
      if (label === "concurrent users" && h.unit !== "concurrent users" && h.unit !== "user") continue;
      facts.push({ kind: "count", label, value: h.value, display: h.display, unit: h.unit, chunk, sentence: sentenceAround(t, h.index, h.len) });
    }
  }
  return facts;
}

export function fmtValue(f: Fact): string {
  if (f.kind === "date") return dayToIso(f.value);
  if (f.kind === "money") return f.display;
  return f.display;
}
