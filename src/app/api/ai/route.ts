import { makeImage, makeSlide, MAX_SLIDES, REMIX_LEVELS } from "@/lib/defaults";
import { CodexError, runCodex } from "@/lib/server/codex";
import {
  createPrompt,
  EDIT_SCHEMA,
  editPrompt,
  linkPrompt,
  READ_SCHEMA,
  readPrompt,
  remixPrompt,
  VOICE_SCHEMA,
  voicePrompt,
  WRITE_SCHEMA,
  type EditResult,
  type ReadResult,
  type VoiceResult,
  type WriteResult,
} from "@/lib/server/prompts";
import { assetPath, getFormat, getProfile, getProject, getSettings, saveProject } from "@/lib/server/storage";
import { detectLink, fetchYouTube, LinkError } from "@/lib/server/web";
import type { AgentEvent, DetectedStyle, Project, RemixLevel, Slide } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

interface AiRequest {
  task: "remix" | "create" | "edit" | "voice";
  projectId?: string;
  level?: RemixLevel;
  /** Troca o formato antes de gerar de novo ("" volta para o livre). */
  formatId?: string | null;
  instructions?: string;
  request?: string;
  focusIndex?: number | null;
  slides?: Slide[];
  caption?: string;
  hashtags?: string[];
  samples?: string;
  name?: string;
  handle?: string;
}

/** Cada tarefa responde em NDJSON: uma linha por evento, para a tela mostrar o progresso ao vivo. */
export async function POST(request: Request) {
  const body = (await request.json()) as AiRequest;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // A tela foi fechada.
        }
      };
      try {
        await runTask(body, send, request.signal);
      } catch (error) {
        if (error instanceof CodexError) send({ type: "error", message: error.message, needsLogin: error.needsLogin });
        else {
          console.error(error);
          send({ type: "error", message: "Algo deu errado do nosso lado. Tente de novo." });
        }
      }
      try {
        controller.close();
      } catch {
        // Já fechado.
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function runTask(body: AiRequest, send: (event: AgentEvent) => void, signal: AbortSignal) {
  if (body.task === "voice") {
    send({ type: "status", text: "Lendo seus textos" });
    const result = await runCodex<VoiceResult>({
      prompt: voicePrompt({ name: body.name ?? "", handle: body.handle ?? "", samples: body.samples ?? "" }),
      schema: VOICE_SCHEMA,
      effort: "low",
      signal,
      onEvent: send,
    });
    send({ type: "done", data: result });
    return;
  }

  const project = body.projectId ? await getProject(body.projectId) : null;
  if (!project) throw new CodexError("Projeto não encontrado.");
  const profile = await getProfile();
  const { writing } = await getSettings();
  const level: RemixLevel = REMIX_LEVELS.some((l) => l.id === body.level) ? (body.level as RemixLevel) : "pouco";

  if (body.task === "edit") {
    const slides = body.slides ?? project.slides;
    const scope = typeof body.focusIndex === "number" ? body.focusIndex : null;
    send({ type: "status", text: scope !== null ? `Ajustando o slide ${scope + 1}` : "Ajustando o carrossel" });
    const result = await runCodex<EditResult>({
      prompt: editPrompt({
        profile,
        writing,
        request: body.request ?? "",
        focusIndex: scope,
        slides,
        caption: body.caption ?? project.caption,
        hashtags: body.hashtags ?? project.hashtags,
      }),
      schema: EDIT_SCHEMA,
      signal,
      onEvent: send,
    });
    const byId = new Map(slides.map((s) => [s.id, s]));
    const nextSlides = result.slides.slice(0, MAX_SLIDES).map((s) => {
      const previous = byId.get(s.id);
      return previous
        ? { ...previous, kind: s.kind, title: s.title, body: s.body }
        : makeSlide({ kind: s.kind, title: s.title, body: s.body });
    });
    send({
      type: "done",
      summary: result.summary,
      data: { slides: nextSlides, caption: result.caption, hashtags: cleanTags(result.hashtags) },
    });
    return;
  }

  // Projetos de vídeo criados antes do suporte ao YouTube viraram "página": busca a transcrição agora.
  if (project.source?.kind === "web" && project.source.url && detectLink(project.source.url)?.kind === "youtube") {
    send({ type: "status", text: "Buscando a transcrição do vídeo" });
    try {
      const video = await fetchYouTube(new URL(project.source.url));
      project.source = { ...project.source, kind: "youtube", title: video.title, text: video.text, duration: video.duration ?? null, site: "YouTube" };
      await saveProject(project);
    } catch (error) {
      throw new CodexError(error instanceof LinkError ? error.message : "Não consegui ler esse vídeo.");
    }
  }

  if (body.formatId !== undefined && project.source) {
    project.source = { ...project.source, formatId: body.formatId || null };
    await saveProject(project);
  }
  const source = project.source;
  const format = await getFormat(source?.formatId);
  const firstRun = project.slides.length === 0;

  if (body.task === "remix" && source && (source.kind === "x" || source.kind === "web" || source.kind === "youtube")) {
    const thin = (source.text ?? "").length < 300 && source.kind === "web";
    const what = source.kind === "x" ? "o post" : source.kind === "youtube" ? "o vídeo" : "a página";
    send({ type: "status", text: source.kind === "youtube" ? "Lendo a transcrição e escrevendo na sua voz" : `Lendo ${what} e escrevendo na sua voz` });
    const result = await runCodex<WriteResult>({
      prompt:
        linkPrompt({ profile, writing, source, level, instructions: body.instructions ?? "", format }) +
        (thin && source.url ? `\nO texto extraído veio curto: abra ${source.url} com a busca na web para ler a página inteira.` : ""),
      schema: WRITE_SCHEMA,
      webSearch: thin,
      signal,
      onEvent: send,
    });
    const done = await applyCarousel(project, result, null);
    send({
      type: "done",
      project: done,
      summary: `${source.kind === "youtube" ? "Li a transcrição do vídeo" : `Li ${what}`} e montei ${done.slides.length} slides na sua voz${format ? `, no formato “${format.name}”` : ""}.`,
    });
    return;
  }

  if (body.task === "remix") {
    const sourceSlides = source?.slides ?? [];
    const images = sourceSlides.map((s) => assetPath(s.src)).filter((p): p is string => Boolean(p));
    if (!source || !images.length) throw new CodexError("Esse projeto não tem slides originais para ler.");

    // Etapa 1: ler os slides. O texto lido já aparece na tela antes da reescrita.
    let read: ReadResult;
    if (source.analysis && source.style && sourceSlides.every((s) => s.text.trim())) {
      read = { source: sourceSlides.map((s) => ({ text: s.text, visual: "" })), analysis: source.analysis, style: source.style };
    } else {
      send({ type: "status", text: `Lendo ${images.length === 1 ? "o slide" : `os ${images.length} slides`}` });
      read = await runCodex<ReadResult>({
        prompt: readPrompt({ slideCount: images.length, caption: source.caption }),
        schema: READ_SCHEMA,
        images,
        effort: "low",
        signal,
        onEvent: send,
      });
      project.source = {
        ...source,
        analysis: read.analysis,
        style: cleanStyle(read.style),
        slides: sourceSlides.map((s, i) => ({ ...s, text: read.source[i]?.text ?? s.text })),
      };
      send({ type: "project", project: await saveProject(project) });
    }

    // Etapa 2: escrever na voz do perfil.
    send({ type: "status", text: level === "manter" ? "Organizando o texto nos slides" : "Escrevendo na sua voz" });
    const result = await runCodex<WriteResult>({
      prompt: remixPrompt({
        profile,
        writing,
        read,
        caption: source.caption,
        author: source.author?.username ?? null,
        level,
        instructions: body.instructions ?? "",
      }),
      schema: WRITE_SCHEMA,
      signal,
      onEvent: send,
    });
    const done = await applyCarousel(project, result, firstRun ? cleanStyle(read.style) : null);
    const levelName = REMIX_LEVELS.find((l) => l.id === level)?.name.toLowerCase() ?? "pouco";
    send({
      type: "done",
      project: done,
      summary:
        level === "manter"
          ? `Li os ${images.length} slides e mantive o texto original no seu design.`
          : `Li os ${images.length} slides e recriei na sua voz, mudando ${levelName}.`,
    });
    return;
  }

  if (body.task === "create") {
    const brief = source?.brief ?? "";
    if (!brief.trim()) throw new CodexError("Escreva sobre o que é o carrossel.");
    send({ type: "status", text: "Escrevendo o carrossel na sua voz" });
    const result = await runCodex<WriteResult>({
      prompt: createPrompt({ profile, writing, brief, instructions: body.instructions ?? "", format }),
      schema: WRITE_SCHEMA,
      signal,
      onEvent: send,
    });
    const done = await applyCarousel(project, result, null);
    send({ type: "done", project: done, summary: `Escrevi ${done.slides.length} slides na sua voz${format ? `, no formato “${format.name}”` : ""}.` });
  }
}

const HEX = /^#[0-9a-f]{6}$/i;

function cleanStyle(style: DetectedStyle): DetectedStyle {
  return { ...style, accent: HEX.test(style.accent) ? style.accent.toLowerCase() : "#ff3500" };
}

async function applyCarousel(project: Project, result: WriteResult, style: DetectedStyle | null): Promise<Project> {
  if (!result.slides.length) {
    throw new CodexError("O ChatGPT não conseguiu montar slides com esse conteúdo. Tente de novo, ou use um link com mais texto.");
  }
  const source = project.source;
  const candidates = source?.kind === "x" || source?.kind === "web" || source?.kind === "youtube" ? source.media : (source?.slides ?? []).map((s) => s.src);
  const slides = result.slides.slice(0, MAX_SLIDES).map((s) => {
    const original = typeof s.sourceImage === "number" ? candidates[s.sourceImage] : undefined;
    return makeSlide({ kind: s.kind, title: s.title, body: s.body, image: original ? makeImage(original) : null });
  });
  const isDefaultTitle = /^(Novo carrossel|Recriação)/.test(project.title) || source?.kind === "idea";
  return saveProject({
    ...project,
    title: isDefaultTitle && result.title.trim() ? result.title.trim().slice(0, 80) : project.title,
    slides,
    caption: result.caption,
    hashtags: cleanTags(result.hashtags),
    design: style ? { ...project.design, template: style.template, theme: style.theme, accent: style.accent, font: style.font } : project.design,
    // Em posts do Instagram a análise é do original (etapa de leitura); nos outros, da nova versão.
    source: source
      ? { ...source, analysis: source.kind === "instagram" || source.kind === "upload" ? (source.analysis ?? result.analysis) : result.analysis }
      : null,
  });
}

function cleanTags(tags: string[]): string[] {
  return tags
    .map((t) => t.replace(/^#+/, "").replace(/\s+/g, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}
