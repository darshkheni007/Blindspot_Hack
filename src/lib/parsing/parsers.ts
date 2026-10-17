import ExcelJS from "exceljs";
import mammoth from "mammoth";
import Papa from "papaparse";
import type { ParsedChunk, ParsedDocument } from "./index";

const MAX_CHUNK = 1400;
const MIN_CHUNK = 160;

/** Splits text into paragraph chunks with a locator built from `loc(startLine, endLine)`. */
export function chunkParagraphs(
  lines: string[],
  loc: (from: number, to: number) => string,
): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let buf: string[] = [];
  let start = 0;
  const flush = (endLine: number) => {
    const text = buf.join("\n").trim();
    if (text) chunks.push({ locator: loc(start + 1, endLine), text });
    buf = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") {
      if (buf.join("\n").length >= MIN_CHUNK) flush(i);
      else if (buf.length) buf.push("");
      return;
    }
    if (buf.length === 0) start = i;
    // Headings start a fresh chunk so quotes keep their section context.
    if (/^#{1,6}\s/.test(line) && buf.join("\n").length >= MIN_CHUNK / 2) {
      flush(i);
      start = i;
    }
    buf.push(line);
    if (buf.join("\n").length >= MAX_CHUNK) flush(i + 1);
  });
  flush(lines.length);
  return chunks;
}

export async function parseText(buf: Buffer): Promise<ParsedDocument> {
  const text = buf.toString("utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  return { chunks: chunkParagraphs(lines, (a, b) => (a === b ? `line ${a}` : `lines ${a}-${b}`)) };
}

function rowText(headers: string[], cells: string[]): string {
  const parts: string[] = [];
  cells.forEach((c, i) => {
    const v = c.trim();
    if (v === "") return;
    const h = headers[i]?.trim();
    parts.push(h && h !== v ? `${h}: ${v}` : v);
  });
  return parts.join(" | ");
}

export async function parseCsv(buf: Buffer): Promise<ParsedDocument> {
  const text = buf.toString("utf8").replace(/^﻿/, "");
  const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  const rows = res.data as string[][];
  const chunks: ParsedChunk[] = [];
  if (rows.length === 0) return { chunks };
  const headers = rows[0].map((h) => String(h ?? ""));
  chunks.push({ locator: "row 1 (header)", text: `Columns: ${headers.filter(Boolean).join(" | ")}` });
  rows.slice(1).forEach((r, i) => {
    const t = rowText(headers, r.map((c) => String(c ?? "")));
    if (t) chunks.push({ locator: `row ${i + 2}`, text: t });
  });
  return { chunks };
}

function cellString(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result != null) return cellString(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return String(v.error);
    return "";
  }
  return String(v);
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function parseXlsx(buf: Buffer): Promise<ParsedDocument> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const chunks: ParsedChunk[] = [];
  wb.eachSheet((ws) => {
    let headers: string[] | null = null;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: string[] = [];
      for (let c = 1; c <= row.cellCount; c++) cells.push(cellString(row.getCell(c).value));
      if (cells.every((c) => c.trim() === "")) return;
      const last = colLetter(Math.max(1, row.cellCount));
      if (!headers) {
        headers = cells;
        chunks.push({ locator: `${ws.name}!A${rowNumber}:${last}${rowNumber}`, text: `Columns: ${cells.filter(Boolean).join(" | ")}` });
        return;
      }
      const t = rowText(headers, cells);
      if (t) chunks.push({ locator: `${ws.name}!A${rowNumber}:${last}${rowNumber}`, text: t });
    });
  });
  return { chunks };
}

export async function parseDocx(buf: Buffer): Promise<ParsedDocument> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  const paras = value.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: ParsedChunk[] = [];
  let acc: string[] = [];
  let from = 1;
  paras.forEach((p, i) => {
    if (acc.length === 0) from = i + 1;
    acc.push(p);
    const len = acc.join("\n").length;
    if (len >= MIN_CHUNK || i === paras.length - 1) {
      chunks.push({ locator: from === i + 1 ? `¶ ${from}` : `¶ ${from}-${i + 1}`, text: acc.join("\n") });
      acc = [];
    }
  });
  return { chunks };
}

export async function parsePdf(buf: Buffer): Promise<ParsedDocument> {
  const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    b: Buffer,
    o: { pagerender: (page: PdfPage) => Promise<string> },
  ) => Promise<{ numpages: number }>;
  const pages: string[] = [];
  const res = await pdf(buf, {
    pagerender: async (page) => {
      const content = await page.getTextContent();
      let lastY: number | undefined;
      let text = "";
      for (const item of content.items) {
        const y = item.transform[5];
        text += lastY === undefined || Math.abs(y - lastY) < 2 ? item.str : "\n" + item.str;
        lastY = y;
      }
      pages.push(text);
      return text;
    },
  });
  const chunks: ParsedChunk[] = [];
  pages.forEach((txt, pi) => {
    const lines = txt.split("\n");
    for (const c of chunkParagraphs(lines, () => `p.${pi + 1}`)) chunks.push(c);
  });
  return { chunks, pageCount: res.numpages };
}

interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str: string; transform: number[] }> }>;
}
