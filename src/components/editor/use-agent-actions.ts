"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { api, runAgent } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { makeImage, REMIX_LEVELS, uid } from "@/lib/defaults";
import type { ChatEntry, CoverOption, Project, RemixLevel, Slide } from "@/lib/types";
import { useAgent } from "./agent-store";

function entry(partial: Partial<ChatEntry> & Pick<ChatEntry, "role" | "text" | "task">): ChatEntry {
  return { id: uid(), at: new Date().toISOString(), scope: null, changed: [], before: null, seconds: null, failed: false, ...partial };
}

/** Slides novos, com texto diferente ou com outra imagem depois de uma resposta. */
function changedSlides(before: Slide[], after: Slide[]): string[] {
  const old = new Map(before.map((s) => [s.id, s]));
  return after
    .filter((s) => {
      const prev = old.get(s.id);
      return !prev || prev.title !== s.title || prev.body !== s.body || prev.kind !== s.kind || prev.tag !== s.tag || prev.image?.src !== s.image?.src;
    })
    .map((s) => s.id);
}

const list = new Intl.ListFormat("pt-BR");
/** "o slide 2" ou "os slides 2, 4 e 5", pelos números que a pessoa vê. */
const slidesLabel = (indexes: number[]) => `${indexes.length === 1 ? "o card" : "os cards"} ${list.format(indexes.map((index) => String(index + 1)))}`;

/** O que o pedido de criar ou recriar usa por trás: aparece na conversa como menções. */
function usesOf(project: Project, task: "remix" | "create", level: RemixLevel, formatId: string | null | undefined): string[] {
  const { profile, settings, formats } = useApp.getState();
  const format = formats.find((item) => item.id === (formatId ?? project.source?.formatId));
  const author = project.source?.author?.username;
  return [
    ...(task === "remix" && author ? [`@${author}`] : []),
    ...(settings?.writing.method !== false && (task === "create" || format?.method) ? ["Método editorial"] : []),
    ...(profile?.voice.trim() ? [profile.handle ? `Voz de @${profile.handle}` : "Sua voz"] : []),
    ...(format ? [`Formato ${format.name}`] : []),
    ...(task === "remix" ? [level === "manter" ? "Manter o texto" : `Mudar ${REMIX_LEVELS.find((item) => item.id === level)?.name.toLowerCase() ?? "pouco"}`] : []),
  ];
}

/** O pedido de recriar, dito como uma pessoa diria; o que ele usa vai nas menções, não na frase. */
function remixAsk(project: Project): string {
  const kind = project.source?.kind;
  if (kind === "youtube") return "Transforme este vídeo num carrossel na minha voz.";
  if (kind === "web") return "Transforme esta página num carrossel na minha voz.";
  if (kind === "x") return "Transforme este post num carrossel na minha voz.";
  return "Recrie este carrossel na minha voz.";
}

/** Ações que chamam o ChatGPT a partir do editor. Cada pedido e resposta entra na conversa do projeto. */
export function useAgentActions() {
  const setLoginOpen = useApp((s) => s.setLoginOpen);

  const ensureLogin = useCallback(() => {
    const auth = useApp.getState().auth;
    if (auth?.connected) return true;
    setLoginOpen(true);
    return false;
  }, [setLoginOpen]);

  const fail = useCallback(
    (task: ChatEntry["task"], message: string, startedAt: number, needsLogin?: boolean) => {
      if (message === "Cancelado.") {
        useEditor.getState().addChat(entry({ role: "assistant", task, text: "Parei, como você pediu.", failed: true }));
        return;
      }
      useEditor.getState().addChat(
        entry({ role: "assistant", task, text: message, failed: true, seconds: Math.round((Date.now() - startedAt) / 1000) }),
      );
      toast.error(message);
      if (needsLogin) {
        void useApp.getState().refreshAuth();
        setLoginOpen(true);
      }
    },
    [setLoginOpen],
  );

  /**
   * Gera a imagem de cada card pedido com a conta do ChatGPT, dois por vez, e põe no card quando chega.
   * `quiet` é para as imagens que vêm sozinhas depois de criar o carrossel: se uma falhar, não vira aviso.
   */
  const picture = useCallback(
    async (wanted: { id: string; idea?: string }[], options: { quiet?: boolean } = {}) => {
      const project = useEditor.getState().project;
      if (!project || !wanted.length || !ensureLogin()) return;
      const before = { slides: project.slides, caption: project.caption, hashtags: project.hashtags };
      const startedAt = Date.now();
      const queue = [...wanted];
      const done: string[] = [];
      let failure: string | null = null;
      for (const item of wanted) useAgent.getState().setImaging(item.id, true);
      const work = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const current = useEditor.getState().project;
          const index = current?.slides.findIndex((slide) => slide.id === item.id) ?? -1;
          const slide = index >= 0 ? current!.slides[index] : null;
          try {
            if (!current || !slide || current.id !== project.id) continue;
            // A imagem só é de fundo (retrato, com área calma para o título) onde o card a mostra assim.
            const backdrop = current.design.template === "foto" || slide.image?.mode === "background" || (current.design.template === "manchete" && index === 0);
            const { url } = await api.generateImage({ projectId: project.id, slide: { kind: slide.kind, title: slide.title, body: slide.body, imageIdea: slide.imageIdea }, cover: backdrop, idea: item.idea });
            const latest = useEditor.getState().project;
            const target = latest?.id === project.id ? latest.slides.find((value) => value.id === item.id) : null;
            if (!target) continue;
            useEditor.getState().updateSlide(target.id, { image: makeImage(url, { mode: target.image?.mode ?? "inline" }) });
            useEditor.getState().addImages([url]);
            useAgent.getState().flash([target.id]);
            done.push(target.id);
          } catch (error) {
            failure = (error as Error).message;
          } finally {
            useAgent.getState().setImaging(item.id, false);
          }
        }
      };
      await Promise.all([work(), work()]);
      const current = useEditor.getState().project;
      if (!current || current.id !== project.id) return;
      const indexes = current.slides.flatMap((slide, index) => (done.includes(slide.id) ? [index] : []));
      if (done.length) {
        useEditor.getState().addChat(
          entry({ role: "assistant", task: "edit", text: `Gerei ${done.length === 1 ? "a imagem d" : "as imagens d"}${slidesLabel(indexes)}.`, changed: done, before, seconds: Math.round((Date.now() - startedAt) / 1000), steps: [done.length === 1 ? "Gerando a imagem" : `Gerando ${done.length} imagens`] }),
        );
      }
      if (failure && !(options.quiet && done.length)) {
        if (options.quiet) return;
        useEditor.getState().addChat(entry({ role: "assistant", task: "edit", text: failure, failed: true }));
        toast.error(failure);
      }
    },
    [ensureLogin],
  );

  const generate = useCallback(
    async (task: "remix" | "create", options: { level?: RemixLevel; instructions?: string; formatId?: string | null } = {}) => {
      const project = useEditor.getState().project;
      if (!project || !ensureLogin()) return;
      const level = options.level ?? "pouco";
      const ask = task === "create" ? (project.source?.brief ?? "Crie um carrossel.") : remixAsk(project);
      const before = project.slides.length ? { slides: project.slides, caption: project.caption, hashtags: project.hashtags } : null;
      useEditor.getState().addChat(
        entry({
          role: "user",
          task,
          text: options.instructions ? `${ask}\n${options.instructions}` : ask,
          // Os cards do original vão junto com o pedido, como o que a pessoa "mandou".
          images: task === "remix" ? (project.source?.slides ?? []).map((slide) => slide.src).slice(0, 12) : undefined,
          uses: usesOf(project, task, level, options.formatId),
        }),
      );

      // Primeiro passo verdadeiro de cada caminho; o servidor informa os seguintes.
      const controller = useAgent.getState().start(task, task === "remix" ? "Abrindo o original" : "Lendo o seu perfil e a sua voz");
      const startedAt = Date.now();
      try {
        const last = await runAgent(
          { task, projectId: project.id, level, instructions: options.instructions ?? "", formatId: options.formatId },
          (event) => {
            if (event.type === "status") useAgent.getState().update({ status: event.text });
            if (event.type === "thought") useAgent.getState().update({ thought: event.text });
            if (event.type === "project") {
              useEditor.getState().setSource(event.project.source);
              useAgent.getState().update({ phase: "write" });
            }
          },
          controller.signal,
        );
        if (last?.type === "done" && last.project) {
          const next = last.project as Project;
          useEditor.getState().replace({
            title: next.title,
            slides: next.slides,
            caption: next.caption,
            hashtags: next.hashtags,
            design: next.design,
            source: next.source,
          });
          useEditor.getState().addChat(
            entry({
              role: "assistant",
              task,
              text: last.summary ?? "Pronto.",
              changed: next.slides.map((s) => s.id),
              before,
              seconds: Math.round((Date.now() - startedAt) / 1000),
              steps: useAgent.getState().steps,
            }),
          );
          useAgent.getState().flash(next.slides.map((s) => s.id));
          window.dispatchEvent(new CustomEvent("arrasta:generated"));
          // As imagens chegam depois do texto: a capa e até dois cards em que o redator pediu imagem.
          if (useApp.getState().settings?.writing.pictures !== false) {
            const wanted = next.slides.filter((slide, index) => !slide.image && (index === 0 || slide.imageIdea.trim())).slice(0, 3);
            void picture(wanted.map((slide) => ({ id: slide.id })), { quiet: true });
          }
        } else {
          fail(task, last?.type === "error" ? last.message : "A conexão com o ChatGPT caiu antes do fim. Tente de novo.", startedAt, last?.type === "error" && last.needsLogin);
        }
      } catch (error) {
        fail(task, (error as Error).name === "AbortError" ? "Cancelado." : (error as Error).message, startedAt);
      } finally {
        useAgent.getState().finish();
      }
    },
    [ensureLogin, fail, picture],
  );

  const edit = useCallback(
    async (request: string) => {
      const project = useEditor.getState().project;
      if (!project) return false;
      const text = request.trim();
      const attachments = useAgent.getState().attachments;
      const images = attachments.map((attachment) => attachment.url);
      if (!text && !images.length) return false;
      // O pedido vale para os cards que a pessoa escolheu no palco; sem escolha, para o carrossel todo.
      const picked = useEditor.getState().picked;
      const focus = project.slides.flatMap((slide, index) => (picked.includes(slide.id) ? [index] : []));
      const before = { slides: project.slides, caption: project.caption, hashtags: project.hashtags };

      // Só imagens, com cards escolhidos: cada imagem entra num card, na ordem, sem chamar o ChatGPT.
      if (!text && focus.length) {
        const pairs = focus.slice(0, images.length).map((index, position) => ({ slide: project.slides[index], src: images[position] }));
        useEditor.getState().addChat(entry({ role: "user", task: "edit", text: "", focus, images }));
        useEditor.getState().replace(
          { slides: project.slides.map((slide) => {
            const pair = pairs.find((item) => item.slide.id === slide.id);
            return pair ? { ...slide, image: makeImage(pair.src, { mode: slide.image?.mode ?? "inline" }) } : slide;
          }) },
          "keep",
        );
        useEditor.getState().addImages(images);
        const placed = pairs.map((pair) => project.slides.indexOf(pair.slide));
        useEditor.getState().addChat(
          entry({ role: "assistant", task: "edit", text: `Coloquei ${pairs.length === 1 ? "a imagem" : `as ${pairs.length} imagens`} n${slidesLabel(placed)}.`, changed: pairs.map((pair) => pair.slide.id), before }),
        );
        useAgent.getState().clearAttachments();
        useAgent.getState().flash(pairs.map((pair) => pair.slide.id));
        return true;
      }

      if (!ensureLogin()) return false;
      useEditor.getState().addChat(entry({ role: "user", task: "edit", text, focus, images }));
      useAgent.getState().clearAttachments();
      // O primeiro passo é a leitura: o pedido vai junto com todos os slides. O servidor informa os seguintes.
      const controller = useAgent.getState().start("edit", project.slides.length === 1 ? "Lendo o card" : `Lendo os ${project.slides.length} cards`);
      useAgent.setState({ focus: focus.map((index) => project.slides[index].id) });
      const startedAt = Date.now();
      try {
        const last = await runAgent(
          { task: "edit", projectId: project.id, request: text, focusIndexes: focus, images, slides: project.slides, caption: project.caption, hashtags: project.hashtags },
          (event) => {
            if (event.type === "status") useAgent.getState().update({ status: event.text });
            if (event.type === "thought") useAgent.getState().update({ thought: event.text });
          },
          controller.signal,
        );
        if (last?.type === "done" && last.data) {
          const data = last.data as { slides: Slide[]; caption: string; hashtags: string[]; pictures?: { id: string; prompt: string }[] };
          const current = useEditor.getState().project ?? project;
          const changed = changedSlides(current.slides, data.slides);
          const captionChanged = data.caption !== current.caption;
          const pictures = (data.pictures ?? []).filter((item) => data.slides.some((slide) => slide.id === item.id));
          useEditor.getState().replace({ slides: data.slides, caption: data.caption, hashtags: data.hashtags }, "keep");
          useEditor.getState().addImages(images.filter((src) => data.slides.some((slide) => slide.image?.src === src)));
          useEditor.getState().addChat(
            entry({
              role: "assistant",
              task: "edit",
              text: last.summary || (changed.length || captionChanged || pictures.length ? "Feito." : "Não precisei mudar nada."),
              changed,
              before: { slides: current.slides, caption: current.caption, hashtags: current.hashtags },
              seconds: Math.round((Date.now() - startedAt) / 1000),
              steps: useAgent.getState().steps,
            }),
          );
          useAgent.getState().flash(changed);
          useAgent.getState().finish();
          // Imagem nova pedida no chat: gera depois do texto, card a card.
          if (pictures.length) void picture(pictures.map((item) => ({ id: item.id, idea: item.prompt })));
          return true;
        }
        fail("edit", last?.type === "error" ? last.message : "A conexão com o ChatGPT caiu antes do fim. Tente de novo.", startedAt, last?.type === "error" && last.needsLogin);
      } catch (error) {
        fail("edit", (error as Error).name === "AbortError" ? "Cancelado." : (error as Error).message, startedAt);
      } finally {
        if (useAgent.getState().controller === controller) useAgent.getState().finish();
      }
      return false;
    },
    [ensureLogin, fail, picture],
  );

  const generateCovers = useCallback(async (signal: AbortSignal): Promise<CoverOption[]> => {
    const project = useEditor.getState().project;
    if (!project) throw new Error("Projeto não encontrado.");
    if (!ensureLogin()) throw new Error("Entre com ChatGPT para escrever as capas.");
    const startedAt = Date.now();
    let needsLogin = false;
    try {
      const last = await runAgent({ task: "covers", projectId: project.id, slides: project.slides }, () => undefined, signal);
      signal.throwIfAborted();
      if (last?.type === "done" && last.data) {
        const { covers } = last.data as { covers?: CoverOption[] };
        if (Array.isArray(covers) && covers.length === 10 && covers.every((cover) =>
          cover && typeof cover.angle === "string" && typeof cover.title === "string" && cover.title.trim() && typeof cover.body === "string",
        )) return covers;
      }
      needsLogin = last?.type === "error" && Boolean(last.needsLogin);
      throw new Error(last?.type === "error" ? last.message : "Não consegui escrever as 10 capas. Tente de novo.");
    } catch (error) {
      if (signal.aborted) throw error;
      const message = error instanceof Error ? error.message : "Não consegui escrever as capas. Tente de novo.";
      fail("covers", message, startedAt, needsLogin);
      throw new Error(message);
    }
  }, [ensureLogin, fail]);

  return { generate, edit, picture, generateCovers, ensureLogin };
}
