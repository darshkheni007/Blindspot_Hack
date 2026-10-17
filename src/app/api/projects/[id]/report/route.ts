import { z } from "zod";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, limit, parseValue } from "@/lib/http";
import { buildReport, reportCsv, reportPdf } from "@/lib/report";

export const runtime = "nodejs";

const q = z.object({ format: z.enum(["json", "csv", "pdf"]).default("json") });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const parsed = parseValue(Object.fromEntries(new URL(req.url).searchParams), q);
  if (!parsed.ok) return parsed.response;
  const { format } = parsed.data;
  if (format !== "json") {
    const limited = limit(`export:${c.ctx.userId}`, 30, 10 * 60_000);
    if (limited) return limited;
  }
  const r = await buildReport(c.ctx.workspaceId, (await params).id, c.ctx.userId);
  if (!r) return apiError(404, "not_found", "Project not found.");
  if (format === "json") return apiOk(r);
  const base = r.project.name.replace(/[^\w.-]+/g, "_").slice(0, 60) || "report";
  if (format === "csv") {
    return new Response(reportCsv(r), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}-findings.csv"`, "Cache-Control": "no-store" },
    });
  }
  const pdf = await reportPdf(r);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}-report.pdf"`, "Cache-Control": "no-store" },
  });
}
