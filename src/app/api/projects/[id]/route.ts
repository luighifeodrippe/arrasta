import { deleteProject, getProject, saveProject } from "@/lib/server/storage";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const project = await getProject((await params).id).catch(() => null);
  if (!project) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
  return Response.json(project);
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const current = await getProject(id).catch(() => null);
  if (!current) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
  const incoming = (await request.json()) as Partial<Project>;
  const next: Project = {
    ...current,
    title: typeof incoming.title === "string" ? incoming.title.slice(0, 120) : current.title,
    slides: Array.isArray(incoming.slides) ? incoming.slides : current.slides,
    design: incoming.design ?? current.design,
    caption: typeof incoming.caption === "string" ? incoming.caption : current.caption,
    hashtags: Array.isArray(incoming.hashtags) ? incoming.hashtags : current.hashtags,
    source: incoming.source === undefined ? current.source : incoming.source,
    chat: Array.isArray(incoming.chat) ? incoming.chat.slice(-60) : current.chat,
    images: Array.isArray(incoming.images) ? incoming.images.filter((u): u is string => typeof u === "string").slice(0, 120) : current.images,
    id,
  };
  return Response.json(await saveProject(next));
}

export async function DELETE(_request: Request, { params }: Context) {
  await deleteProject((await params).id);
  return Response.json({ ok: true });
}
