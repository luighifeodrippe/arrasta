"use client";

import { BorderBeam } from "border-beam";
import { AiChat02Icon, ArrowDown01Icon, ArrowUp02Icon, Cancel01Icon, HistoryIcon, StopIcon, Undo02Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { useEditor } from "@/lib/client/editor-store";
import { ModelPicker } from "../app/ModelPicker";
import { useWidth } from "@/lib/client/use-media";
import type { ChatEntry, Slide } from "@/lib/types";
import { cn } from "../ui/cn";
import { Tip } from "../ui/tooltip";
import { useAgent } from "./agent-store";
import { askTarget, suggestionsFor } from "./suggestions";
import { useAgentActions } from "./use-agent-actions";
import { Icon } from "@/components/ui/icon";

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * Painéis de vidro sobem revelados de baixo para cima, sem transparência: o desfoque aparece inteiro
 * desde o primeiro quadro (esmaecer deixaria o fundo nítido aparecer através do vidro).
 */
const REVEAL = {
  initial: { clipPath: "inset(100% -64px -64px -64px round 20px)", y: 10 },
  animate: { clipPath: "inset(-64px -64px -64px -64px round 20px)", y: 0 },
  exit: { clipPath: "inset(100% -64px -64px -64px round 20px)", y: 6, transition: { duration: 0.16, ease: EASE } },
  transition: { duration: 0.3, ease: EASE },
};

export function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return running ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
}

/** Quais slides a resposta mudou, para virar atalhos. */
function changedLabel(ids: string[], slides: Slide[]): { label: string; indexes: number[]; all: boolean } | null {
  const indexes = ids.map((id) => slides.findIndex((s) => s.id === id)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (!indexes.length) return null;
  const all = indexes.length === slides.length && slides.length > 2;
  return { label: all ? "Todos os cards" : indexes.length > 1 ? "Cards" : "Card", indexes, all };
}

export function ChangedChips({ ids, slides, onSelect, max }: { ids: string[]; slides: Slide[]; onSelect: (id: string) => void; max: number }) {
  const changed = changedLabel(ids, slides);
  if (!changed) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {changed.label}
      {!changed.all &&
        changed.indexes.slice(0, max).map((i) => (
          <button
            key={i}
            onClick={() => onSelect(slides[i].id)}
            className="rounded-[6px] bg-white/[0.08] px-1.5 py-px font-medium tabular-nums text-ink-2 transition-colors hover:bg-white/[0.14] hover:text-ink"
            aria-label={`Ir para o card ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
    </span>
  );
}

/** Conversa com o ChatGPT Work sobre o carrossel, na barra de baixo (telas estreitas ou cartão fechado). */
export function AgentBar() {
  const project = useEditor((s) => s.project)!;
  const running = useAgent((s) => s.running);
  const kind = useAgent((s) => s.kind);
  const status = useAgent((s) => s.status);
  const thought = useAgent((s) => s.thought);
  const startedAt = useAgent((s) => s.startedAt);
  const stop = useAgent((s) => s.stop);
  const chatOpen = useAgent((s) => s.chatOpen);
  const setChatOpen = useAgent((s) => s.setChatOpen);
  const { edit } = useAgentActions();
  const text = useAgent((s) => s.draft);
  const setText = useAgent((s) => s.setDraft);
  const [focused, setFocused] = useState(false);
  const picked = useEditor((s) => s.picked);
  const clearSelection = useEditor((s) => s.clearSelection);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const barWidth = useWidth(barRef);
  const wide = barWidth >= 560;
  const roomy = barWidth >= 660;
  const elapsed = useElapsed(startedAt, running);
  const focusIndexes = project.slides.flatMap((slide, position) => (picked.includes(slide.id) ? [position] : []));
  const focusLabel = focusIndexes.length === 1 ? `Card ${focusIndexes[0] + 1}` : `${focusIndexes.length} cards`;
  const hasSlides = project.slides.length > 0;
  const chat = project.chat;
  const lastReply = useMemo(() => [...chat].reverse().find((e) => e.role === "assistant") ?? null, [chat]);
  const showReply = !chatOpen && !running && lastReply && lastReply.id !== dismissed && Date.now() - new Date(lastReply.at).getTime() < 10 * 60 * 1000;
  const lastReplyId = lastReply?.id ?? null;
  const dismissReply = useCallback(() => setDismissed(lastReplyId), [lastReplyId]);

  const send = async (request: string) => {
    if (!request.trim() || running) return;
    setText("");
    const ok = await edit(request);
    if (!ok) setText(request);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5">
      <div ref={barRef} data-tour="agent" className="pointer-events-auto flex w-full max-w-[680px] flex-col gap-2">
        <AnimatePresence initial={false}>
          {chatOpen && (
            <ChatHistory key="chat" onPick={send} onClose={() => setChatOpen(false)} running={running && kind === "edit"} status={status} elapsed={elapsed} />
          )}
          {showReply && lastReply && <LastReply key={`reply-${lastReply.id}`} entry={lastReply} onDismiss={dismissReply} onOpen={() => setChatOpen(true)} />}
          {focused && !running && hasSlides && !text && !chatOpen && !showReply && (
            <div key="suggestions" className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {suggestionsFor(askTarget(focusIndexes)).map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18, ease: EASE, delay: i * 0.02 }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => send(s)}
                  className="chip-key"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>

        <BorderBeam size="md" colorVariant="mono" theme="dark" active={running} className="rounded-[20px]">
          <div className="glass rounded-[20px] p-1.5">
            {running ? (
              <div className="flex min-h-[48px] items-center gap-3 pl-2.5 pr-1" role="status" aria-live="polite">
                <ThinkingOrb state={status.startsWith("Lendo") ? "searching" : "composing"} size={20} theme="dark" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">
                    <span className="arrasta-shimmer-text">{status}…</span>
                  </p>
                  {thought && <p className="truncate text-[12.5px] text-ink-3">{thought}</p>}
                </div>
                <span className="text-[12.5px] tabular-nums text-ink-3">{elapsed}s</span>
                <Tip label="Parar">
                  <button onClick={stop} className="grid size-9 place-items-center rounded-[12px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink" aria-label="Parar">
                    <Icon icon={StopIcon} className="size-3.5 fill-current" />
                  </button>
                </Tip>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(text);
                }}
                className="flex items-end gap-1.5"
              >
                {hasSlides && (
                  // O pedido vale para os cards escolhidos no palco; tocar aqui devolve o pedido ao carrossel todo.
                  <button
                    type="button"
                    onClick={() => {
                      if (picked.length) clearSelection();
                      inputRef.current?.focus();
                    }}
                    aria-label={picked.length ? `O pedido vale para ${focusLabel}. Tocar para valer para o carrossel todo` : "O pedido vale para o carrossel todo. Escolha um card no palco para valer só para ele"}
                    aria-pressed={picked.length > 0}
                    className="chip-key mb-[9px] ml-1.5 tabular-nums"
                  >
                    {picked.length === 0 ? (wide ? "Carrossel" : "Tudo") : focusLabel}
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(text);
                    }
                  }}
                  rows={1}
                  disabled={!hasSlides}
                  placeholder={
                    !hasSlides
                      ? wide
                        ? "Recrie ou escreva um card para começar"
                        : "Crie cards"
                      : picked.length
                        ? wide ? `O que mudar n${picked.length === 1 ? "o" : "os"} ${focusLabel.toLowerCase()}?` : "O que mudar?"
                        : wide ? "Peça uma mudança…" : "Peça algo"
                  }
                  className="max-h-32 min-h-[48px] min-w-0 flex-1 resize-none bg-transparent px-2.5 py-3 text-[14.5px] leading-6 outline-none placeholder:whitespace-nowrap placeholder:text-ink-3 disabled:opacity-60"
                  aria-label="Pedido para o ChatGPT Work"
                />
                <ModelPicker compact={!roomy} />
                {chat.length > 0 && (
                  <Tip label={chatOpen ? "Fechar a conversa" : "Ver a conversa"}>
                    <button
                      type="button"
                      onClick={() => setChatOpen(!chatOpen)}
                      aria-pressed={chatOpen}
                      className={cn(
                        "mb-[7px] grid size-[34px] shrink-0 place-items-center rounded-full transition-colors",
                        chatOpen ? "selected border border-transparent text-ink" : "text-ink-2 hover:bg-white/[0.07] hover:text-ink",
                      )}
                      aria-label="Conversa com o ChatGPT Work"
                    >
                      <Icon icon={AiChat02Icon} className="size-[18px]" />
                    </button>
                  </Tip>
                )}
                <button type="submit" disabled={!text.trim()} data-ready={text.trim() ? "" : undefined} className="key work-send mb-[7px] mr-[7px]" aria-label="Enviar">
                  <Icon icon={ArrowUp02Icon} className="size-[18px]" />
                </button>
              </form>
            )}
          </div>
        </BorderBeam>
      </div>
    </div>
  );
}

/** A resposta mais recente, com o que mudou e um jeito rápido de voltar. Some sozinha; fica no histórico. */
function LastReply({ entry, onDismiss, onOpen }: { entry: ChatEntry; onDismiss: () => void; onOpen: () => void }) {
  const slides = useEditor((s) => s.project?.slides ?? []);
  const select = useEditor((s) => s.select);
  const restore = useEditor((s) => s.restore);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (hovered) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [hovered, onDismiss]);
  return (
    <motion.div
      {...REVEAL}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn("glass flex items-start gap-3 rounded-[18px] py-3 pl-3.5 pr-2", entry.failed && "border-red-400/25")}
    >
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", entry.failed ? "bg-danger" : "bg-ok")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug text-ink">{entry.text}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
          <ChangedChips ids={entry.changed} slides={slides} onSelect={select} max={8} />
          {entry.seconds !== null && <span className="tabular-nums">{entry.seconds}s</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {entry.before && !entry.failed && (
          <button
            onClick={() => {
              restore(entry.id);
              onDismiss();
            }}
            className="flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink"
          >
            <Icon icon={Undo02Icon} className="size-3.5" />
            Desfazer
          </button>
        )}
        <Tip label="Ver a conversa">
          <button onClick={onOpen} className="grid size-8 place-items-center rounded-[10px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink" aria-label="Ver a conversa">
            <Icon icon={HistoryIcon} className="size-4" />
          </button>
        </Tip>
        <button onClick={onDismiss} className="grid size-8 place-items-center rounded-[10px] text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-ink" aria-label="Fechar">
          <Icon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}

export const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Toda a conversa do projeto, do primeiro pedido ao último. */
function ChatHistory({
  onPick,
  onClose,
  running,
  status,
  elapsed,
}: {
  onPick: (text: string) => void;
  onClose: () => void;
  running: boolean;
  status: string;
  elapsed: number;
}) {
  const chat = useEditor((s) => s.project?.chat ?? []);
  const slides = useEditor((s) => s.project?.slides ?? []);
  const select = useEditor((s) => s.select);
  const restore = useEditor((s) => s.restore);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length, running]);

  return (
    <motion.div {...REVEAL} className="glass flex max-h-[min(460px,52vh)] flex-col rounded-[20px]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[13.5px] font-medium">Conversa com o ChatGPT Work</p>
        <button onClick={onClose} className="grid size-7 place-items-center rounded-[8px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink" aria-label="Fechar a conversa">
          <Icon icon={ArrowDown01Icon} className="size-4" />
        </button>
      </div>
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {chat.length === 0 && (
          <div className="flex flex-col items-start gap-2.5">
            <p className="text-[13.5px] text-ink-2">Peça qualquer ajuste. Por exemplo:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestionsFor("carousel").map((s) => (
                <button key={s} onClick={() => onPick(s)} className="chip-key">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((entry) =>
          entry.role === "user" ? (
            <div key={entry.id} className="flex flex-col items-end gap-1">
              <p className="max-w-[85%] whitespace-pre-line rounded-[16px] rounded-br-[6px] bg-white/[0.1] px-3.5 py-2 text-[13.5px] leading-snug text-ink">{entry.text}</p>
              <span className="text-[11.5px] text-ink-3">
                {entry.scope !== null ? `Card ${entry.scope + 1} · ` : ""}
                {time.format(new Date(entry.at))}
              </span>
            </div>
          ) : (
            <AssistantEntry key={entry.id} entry={entry} slides={slides} onSelect={select} onRestore={restore} />
          ),
        )}
        {running && (
          <div className="flex items-center gap-2.5 text-[13.5px] text-ink-2">
            <ThinkingOrb state="composing" size={20} theme="dark" aria-hidden />
            {status}… <span className="tabular-nums text-ink-3">{elapsed}s</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function AssistantEntry({
  entry,
  slides,
  onSelect,
  onRestore,
}: {
  entry: ChatEntry;
  slides: Slide[];
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className={cn("max-w-[92%] rounded-[16px] rounded-bl-[6px] px-3.5 py-2.5 text-[13.5px] leading-snug", entry.failed ? "bg-red-500/10 text-red-200" : "bg-white/[0.04] text-ink")}>
        <p className="whitespace-pre-line">{entry.text}</p>
        {!entry.failed && entry.changed.length > 0 && (
          <div className="mt-1.5 text-[12px] text-ink-3">
            <ChangedChips ids={entry.changed} slides={slides} onSelect={onSelect} max={12} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 pl-1 text-[11.5px] text-ink-3">
        <span>{time.format(new Date(entry.at))}</span>
        {entry.seconds !== null && <span className="tabular-nums">{entry.seconds}s</span>}
        {entry.before && !entry.failed && (
          <button onClick={() => onRestore(entry.id)} className="control flex h-7 items-center gap-1.5 rounded-full px-2.5 text-ink-2 transition-colors hover:text-ink">
            <Icon icon={Undo02Icon} className="size-3" />
            Desfazer
          </button>
        )}
      </div>
    </div>
  );
}
