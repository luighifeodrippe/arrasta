"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { runAgent } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { REMIX_LEVELS, uid } from "@/lib/defaults";
import type { ChatEntry, Project, RemixLevel, Slide } from "@/lib/types";
import { useAgent } from "./agent-store";

function entry(partial: Partial<ChatEntry> & Pick<ChatEntry, "role" | "text" | "task">): ChatEntry {
  return { id: uid(), at: new Date().toISOString(), scope: null, changed: [], before: null, seconds: null, failed: false, ...partial };
}

/** Slides novos ou com texto diferente depois de uma resposta. */
function changedSlides(before: Slide[], after: Slide[]): string[] {
  const old = new Map(before.map((s) => [s.id, s]));
  return after
    .filter((s) => {
      const prev = old.get(s.id);
      return !prev || prev.title !== s.title || prev.body !== s.body || prev.kind !== s.kind;
    })
    .map((s) => s.id);
}

function sourceLabel(project: Project): string {
  const source = project.source;
  if (!source) return "o carrossel";
  if (source.kind === "instagram") return source.author ? `o carrossel de @${source.author.username}` : "o carrossel";
  if (source.kind === "x") return source.author ? `o post de @${source.author.username}` : "o post do X";
  if (source.kind === "web") return source.title ? `“${source.title}”` : "a página";
  if (source.kind === "youtube") return source.title ? `o vídeo “${source.title}”` : "o vídeo";
  return "os prints";
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

  const generate = useCallback(
    async (task: "remix" | "create", options: { level?: RemixLevel; instructions?: string; formatId?: string | null } = {}) => {
      const project = useEditor.getState().project;
      if (!project || !ensureLogin()) return;
      const level = options.level ?? "pouco";
      const levelName = REMIX_LEVELS.find((l) => l.id === level)?.name.toLowerCase();
      const ask =
        task === "create"
          ? `Criar um carrossel sobre “${project.source?.brief ?? ""}”`
          : `Recriar ${sourceLabel(project)}${level === "manter" ? " mantendo o texto" : `, mudando ${levelName}`}`;
      const before = project.slides.length ? { slides: project.slides, caption: project.caption, hashtags: project.hashtags } : null;
      useEditor.getState().addChat(entry({ role: "user", task, text: options.instructions ? `${ask}. ${options.instructions}` : ask }));

      const controller = useAgent.getState().start(task, task === "remix" ? "Abrindo o original" : "Escrevendo o carrossel na sua voz");
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
            }),
          );
          useAgent.getState().flash(next.slides.map((s) => s.id));
          window.dispatchEvent(new CustomEvent("arrasta:generated"));
        } else if (last?.type === "error") {
          fail(task, last.message, startedAt, last.needsLogin);
        }
      } catch (error) {
        fail(task, (error as Error).name === "AbortError" ? "Cancelado." : (error as Error).message, startedAt);
      } finally {
        useAgent.getState().finish();
      }
    },
    [ensureLogin, fail],
  );

  const edit = useCallback(
    async (request: string, focusIndex: number | null) => {
      const project = useEditor.getState().project;
      if (!project || !request.trim() || !ensureLogin()) return false;
      useEditor.getState().addChat(entry({ role: "user", task: "edit", text: request.trim(), scope: focusIndex }));
      const controller = useAgent.getState().start("edit", focusIndex !== null ? `Ajustando o slide ${focusIndex + 1}` : "Ajustando o carrossel");
      const startedAt = Date.now();
      try {
        const last = await runAgent(
          {
            task: "edit",
            projectId: project.id,
            request,
            focusIndex,
            slides: project.slides,
            caption: project.caption,
            hashtags: project.hashtags,
          },
          (event) => {
            if (event.type === "status") useAgent.getState().update({ status: event.text });
            if (event.type === "thought") useAgent.getState().update({ thought: event.text });
          },
          controller.signal,
        );
        if (last?.type === "done" && last.data) {
          const data = last.data as { slides: Slide[]; caption: string; hashtags: string[] };
          const current = useEditor.getState().project ?? project;
          const changed = changedSlides(current.slides, data.slides);
          const captionChanged = data.caption !== current.caption;
          useEditor.getState().replace({ slides: data.slides, caption: data.caption, hashtags: data.hashtags }, "keep");
          useEditor.getState().addChat(
            entry({
              role: "assistant",
              task: "edit",
              text: last.summary || (changed.length || captionChanged ? "Feito." : "Não precisei mudar nada."),
              changed,
              before: { slides: current.slides, caption: current.caption, hashtags: current.hashtags },
              seconds: Math.round((Date.now() - startedAt) / 1000),
            }),
          );
          useAgent.getState().flash(changed);
          return true;
        }
        if (last?.type === "error") fail("edit", last.message, startedAt, last.needsLogin);
      } catch (error) {
        fail("edit", (error as Error).name === "AbortError" ? "Cancelado." : (error as Error).message, startedAt);
      } finally {
        useAgent.getState().finish();
      }
      return false;
    },
    [ensureLogin, fail],
  );

  return { generate, edit, ensureLogin };
}
