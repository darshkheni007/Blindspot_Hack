import ExcelJS from "exceljs";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import { guessDocType, parseDocument, sha256, validateUpload, UnsupportedFileError } from "@/lib/parsing";

const buf = (s: string) => Buffer.from(s, "utf8");

describe("validateUpload", () => {
  it("accepts supported types and rejects others", () => {
    expect(validateUpload("plan.md", 10, buf("# hi")).ext).toBe("md");
    expect(() => validateUpload("run.exe", 10, buf("MZ"))).toThrow(UnsupportedFileError);
    expect(() => validateUpload("noext", 10, buf("x"))).toThrow(UnsupportedFileError);
  });
  it("rejects empty and oversized files", () => {
    expect(() => validateUpload("a.txt", 0, buf(""))).toThrow(UnsupportedFileError);
    expect(() => validateUpload("a.txt", 25 * 1024 * 1024 + 1, buf("x"))).toThrow(UnsupportedFileError);
  });
  it("checks magic bytes so a renamed binary is refused", () => {
    expect(() => validateUpload("fake.pdf", 100, buf("MZ\x90\x00"))).toThrow(UnsupportedFileError);
    expect(() => validateUpload("fake.docx", 100, buf("not a zip"))).toThrow(UnsupportedFileError);
    expect(validateUpload("real.pdf", 100, buf("%PDF-1.7")).ext).toBe("pdf");
    expect(validateUpload("real.xlsx", 100, Buffer.from([0x50, 0x4b, 0x03, 0x04])).ext).toBe("xlsx");
  });
});

describe("parseDocument", () => {
  it("chunks text with line locators", async () => {
    const d = await parseDocument(buf("First paragraph about billing.\n\nSecond paragraph about rollback."), "txt");
    expect(d.chunks.length).toBeGreaterThanOrEqual(1);
    expect(d.chunks[0].locator).toMatch(/line/);
    expect(d.chunks.map((c) => c.text).join(" ")).toContain("rollback");
  });
  it("parses markdown", async () => {
    const d = await parseDocument(buf("# Plan\n\n- Go-live: 30 April 2027\n"), "md");
    expect(d.chunks.map((c) => c.text).join(" ")).toContain("30 April 2027");
  });
  it("turns CSV rows into header: value pairs with row locators", async () => {
    const d = await parseDocument(buf('Item,Amount\nHosting,36000\n"Tax, licence",42000\n'), "csv");
    const text = d.chunks.map((c) => c.text).join("\n");
    expect(text).toContain("Item: Hosting");
    expect(text).toContain("Amount: 36000");
    expect(text).toContain("Tax, licence");
    expect(d.chunks[0].locator).toMatch(/row/i);
  });
  it("parses XLSX with sheet and cell locators", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Budget");
    ws.addRow(["Item", "Amount"]);
    ws.addRow(["Hosting", 36000]);
    const out = Buffer.from(await wb.xlsx.writeBuffer());
    const d = await parseDocument(out, "xlsx");
    expect(d.chunks.some((c) => c.locator.startsWith("Budget!"))).toBe(true);
    expect(d.chunks.map((c) => c.text).join(" ")).toContain("36000");
  });
  it("parses DOCX paragraphs", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>The vendor will deliver the API by June.</w:t></w:r></w:p></w:body></w:document>');
    const d = await parseDocument(await zip.generateAsync({ type: "nodebuffer" }), "docx");
    expect(d.chunks.map((c) => c.text).join(" ")).toContain("vendor will deliver the API");
  });
  it("parses PDF text with page locators", async () => {
    const pdf = await new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ pdfVersion: "1.4" });
      const parts: Buffer[] = [];
      doc.on("data", (c: Buffer) => parts.push(c));
      doc.on("end", () => resolve(Buffer.concat(parts)));
      doc.text("Rollback plan is described on this page.");
      doc.end();
    });
    const d = await parseDocument(pdf, "pdf");
    expect(d.chunks[0].locator).toMatch(/p\.\s?1/);
    expect(d.chunks.map((c) => c.text).join(" ")).toContain("Rollback plan");
  });
  it("fails cleanly on corrupt input", async () => {
    await expect(parseDocument(buf("%PDF-1.4 garbage"), "pdf")).rejects.toThrow();
  });
});

describe("helpers", () => {
  it("hashes deterministically", () => {
    expect(sha256(buf("a"))).toBe(sha256(buf("a")));
    expect(sha256(buf("a"))).not.toBe(sha256(buf("b")));
  });
  it("guesses a document type from the name", () => {
    expect(guessDocType("Project-Budget.xlsx", "xlsx")).toBe("Budget");
    expect(guessDocType("PRD v2.docx", "docx")).toBe("PRD");
  });
});
