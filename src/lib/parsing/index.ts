import crypto from "node:crypto";
import { UPLOAD } from "@/config/app";
import { parseCsv, parseDocx, parsePdf, parseText, parseXlsx } from "./parsers";

export interface ParsedChunk {
  locator: string;
  text: string;
}
export interface ParsedDocument {
  chunks: ParsedChunk[];
  pageCount?: number;
}

export class UnsupportedFileError extends Error {}

export function extOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return (m?.[1] ?? "").toLowerCase();
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Validates type, size and magic bytes. Uploads are only ever parsed as data — never executed. */
export function validateUpload(name: string, size: number, head: Buffer): { ext: string } {
  const ext = extOf(name);
  if (!(UPLOAD.allowedExt as readonly string[]).includes(ext)) {
    throw new UnsupportedFileError(`Unsupported file type ".${ext || "?"}". Use PDF, DOCX, XLSX, CSV, TXT or MD.`);
  }
  if (size <= 0) throw new UnsupportedFileError("That file is empty.");
  if (size > UPLOAD.maxBytes) throw new UnsupportedFileError("That file is larger than the 25 MB limit.");
  const magic = head.subarray(0, 5).toString("latin1");
  if (ext === "pdf" && !magic.startsWith("%PDF")) throw new UnsupportedFileError("This does not look like a valid PDF.");
  if ((ext === "docx" || ext === "xlsx") && !magic.startsWith("PK")) {
    throw new UnsupportedFileError(`This does not look like a valid .${ext} file.`);
  }
  if (["txt", "md", "csv"].includes(ext) && head.includes(0)) {
    throw new UnsupportedFileError("This text file contains binary data and was rejected.");
  }
  return { ext };
}

export async function parseDocument(buf: Buffer, ext: string): Promise<ParsedDocument> {
  switch (ext) {
    case "pdf":
      return parsePdf(buf);
    case "docx":
      return parseDocx(buf);
    case "xlsx":
      return parseXlsx(buf);
    case "csv":
      return parseCsv(buf);
    case "txt":
    case "md":
      return parseText(buf);
    default:
      throw new UnsupportedFileError(`Unsupported file type ".${ext}".`);
  }
}

const TYPE_RULES: Array<[RegExp, string]> = [
  [/budget|cost|invoice|estimate|pricing|financ/i, "Budget"],
  [/contract|agreement|sow|msa|nda|terms/i, "Contract"],
  [/prd|requirement|spec|brief|scope/i, "PRD"],
  [/plan|schedule|roadmap|timeline|gantt|runbook|cutover|migration/i, "Plan"],
  [/meeting|notes|minutes|workflow|retro/i, "Notes"],
  [/data|dataset|export|log/i, "Data"],
];
export function guessDocType(name: string, ext: string): string {
  for (const [re, t] of TYPE_RULES) if (re.test(name)) return t;
  if (ext === "csv" || ext === "xlsx") return "Data";
  return "Other";
}
