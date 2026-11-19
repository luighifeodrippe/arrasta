import { promises as fs } from "node:fs";
import { CodexError, generatedImages, runCodex } from "@/lib/server/codex";
import { PICTURE_SCHEMA, picturePrompt, type PictureResult } from "@/lib/server/picture";
import { assertId, getProject, saveAsset } from "@/lib/server/storage";
import type { Slide } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/** Gera a imagem de um card com a conta do ChatGPT e a guarda nas imagens do carrossel. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { projectId?: string; slide?: Partial<Slide>; cover?: boolean; idea?: string };
  try {
    assertId(body.projectId ?? "");
  } catch {
    return Response.json({ error: "Carrossel inválido." }, { status: 400 });
  }
  const project = await getProject(body.projectId!);
  if (!project) return Response.json({ error: "Esse carrossel não existe mais." }, { status: 404 });
  const slide = {
    kind: body.slide?.kind ?? "content",
    title: String(body.slide?.title ?? ""),
    body: String(body.slide?.body ?? ""),
    imageIdea: String(body.slide?.imageIdea ?? ""),
  };
  if (!slide.title.trim() && !slide.body.trim() && !body.idea?.trim()) return Response.json({ error: "Escreva o card antes de pedir a imagem." }, { status: 400 });

  try {
    let thread: string | null = null;
    const result = await runCodex<PictureResult>({
      prompt: picturePrompt({ slide, design: project.design, cover: Boolean(body.cover), idea: String(body.idea ?? "") }),
      schema: PICTURE_SCHEMA,
      effort: "low",
      signal: request.signal,
      onThread: (id) => (thread = id),
    });
    const [file] = thread ? await generatedImages(thread) : [];
    if (!file) throw new CodexError(result.note?.trim() || "O ChatGPT não gerou a imagem desta vez. Tente de novo.");
    const extension = file.split(".").pop()?.toLowerCase() === "png" ? "png" : "jpg";
    const url = await saveAsset(project.id, `gerada-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`, await fs.readFile(file));
    return Response.json({ url, note: result.note ?? "" });
  } catch (error) {
    const known = error instanceof CodexError;
    if (!known) console.error(error);
    return Response.json({ error: known ? error.message : "Não consegui gerar a imagem.", needsLogin: known ? error.needsLogin : false }, { status: known && error.needsLogin ? 401 : 500 });
  }
}
