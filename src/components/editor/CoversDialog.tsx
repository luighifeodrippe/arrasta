"use client";

import { AiMagicIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThinkingOrb } from "thinking-orbs";
import { identityOf, useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import type { CoverOption } from "@/lib/types";
import { SlideCanvas, SlideFrame } from "../slide/SlideCanvas";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Icon } from "../ui/icon";
import { useAgent } from "./agent-store";
import { useAgentActions } from "./use-agent-actions";

export function CoversDialog() {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [covers, setCovers] = useState<CoverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const project = useEditor((s) => s.project);
  const profile = useApp((s) => s.profile);
  const running = useAgent((s) => s.running);
  const { generateCovers } = useAgentActions();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCovers([]);
    void generateCovers(controller.signal)
      .then((options) => { if (!controller.signal.aborted) setCovers(options); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não consegui escrever as capas.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, attempt, generateCovers]);

  const cover = project?.slides[0];
  if (!project || cover?.kind !== "cover") return null;

  const apply = (option: CoverOption) => {
    useEditor.getState().updateSlide(cover.id, { title: option.title, body: option.body });
    setOpen(false);
    toast.success("Capa trocada");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={running}
          aria-label="Testar 10 capas"
          title="O ChatGPT Work escreve 10 capas para você escolher"
          className="chip-key h-[26px] gap-1 px-2 text-[12px] @[250px]:px-2.5"
        >
          <Icon icon={AiMagicIcon} className="size-3.5" />
          <span className="hidden @[250px]:inline">Testar 10 capas</span>
        </button>
      </DialogTrigger>
      <DialogContent
        title="10 capas para este carrossel"
        className="w-[min(1120px,calc(100vw-32px))]"
        footer={
          <Button size="sm" disabled={loading} onClick={() => setAttempt((value) => value + 1)}>
            {error ? "Tentar de novo" : "Gerar outras 10"}
          </Button>
        }
      >
        <div role="status" className={loading ? "flex min-h-64 flex-col items-center justify-center gap-4 text-[13.5px] text-ink-2" : "sr-only"}>
          {loading ? <><ThinkingOrb state="composing" size={64} theme="dark" aria-hidden /><p>Escrevendo 10 capas na sua voz</p></> : !error && `${covers.length} capas prontas para escolher`}
        </div>
        {error && <p role="alert" className="py-8 text-center text-[13.5px] text-ink-2">{error}</p>}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {covers.map((option, index) => (
              <button
                key={`${index}-${option.angle}`}
                type="button"
                aria-label={`Usar a capa: ${option.title.replaceAll("**", "")}`}
                onClick={() => apply(option)}
                className="min-w-0 rounded-[12px] text-left outline-offset-4 transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white"
              >
                <div aria-hidden="true" className="pointer-events-none overflow-hidden rounded-[12px] shadow-[0_0_0_1px_rgb(255_255_255/0.1)]">
                  <SlideFrame size={project.design.size}>
                    <SlideCanvas
                      slide={{ ...cover, title: option.title, body: option.body }}
                      index={0}
                      total={project.slides.length}
                      design={project.design}
                      identity={identityOf(profile)}
                    />
                  </SlideFrame>
                </div>
                <span className="mt-2 block px-1 text-[12px] text-ink-2">{option.angle}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
