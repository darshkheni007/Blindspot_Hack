import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/project-workspace";
import { getProject } from "@/lib/data/projects";
import { requireCtx } from "@/lib/data/session";
import { DOMAINS, STAGES } from "@/config/app";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await requireCtx();
  const p = await getProject(ctx.workspaceId, (await params).id);
  return { title: p?.name ?? "Project" };
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;
  const project = await getProject(ctx.workspaceId, id);
  if (!project) notFound();
  const { tab } = await searchParams;
  return (
    <ProjectWorkspace
      projectId={project.id}
      name={project.name}
      goal={project.goal}
      meta={`${DOMAINS.find((d) => d.value === project.domain)?.label} · ${STAGES.find((s) => s.value === project.stage)?.label}`}
      isSample={project.isSample}
      initialTab={tab ?? "overview"}
    />
  );
}
