"use client";

import { Add01Icon, Alert02Icon, ArrowDown01Icon, BubbleChatAddIcon, Clock01Icon, ArrowRight01Icon, ArrowUp02Icon, BookOpen01Icon, Cancel01Icon, ChatGptIcon, Layers01Icon, PanelRightCloseIcon, QuillWrite01Icon, RefreshIcon, StopIcon, Target02Icon, Tick02Icon, Undo02Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Popover } from "radix-ui";
import { Icon, type IconData } from "@/components/ui/icon";
import { api } from "@/lib/client/api";
import { identityOf, useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { IMAGE_DRAG_TYPE } from "@/lib/client/images";
import { SLIDE_KINDS, SLIDE_W, slideHeight, uid } from "@/lib/defaults";
import type { ChatEntry, Slide } from "@/lib/types";
import { ChatGPTAccount } from "../app/ChatGPTAccount";
import { ModelPicker } from "../app/ModelPicker";
import { SlideCanvas, SlideFrame } from "../slide/SlideCanvas";
import { Button } from "../ui/button";
import { Tip } from "../ui/tooltip";
import { useElapsed } from "./AgentBar";
import { useAgent, type Attachment } from "./agent-store";
import { askTarget, suggestionsFor } from "./suggestions";
import { useAgentActions } from "./use-agent-actions";

const plain = (text: string) => text.replace(/\*\*/g, "").trim();

/**
 * O ChatGPT Work ao lado do carrossel, no material do Assistente da casa: a pessoa entra com a conta, escolhe cards
 * no palco (eles aparecem no campo), anexa imagens e pede em texto. Cada resposta mostra os passos que levou e os
 * cards que mexeu, enquanto eles mudam no palco.
 */
export function ChatCard({ onClose }: { onClose: () => void }) {
  const auth = useApp((s) => s.auth);
  return (
    <aside data-tour="agent" aria-label="ChatGPT Work" className="work pane">
      <header className="work-head">
        <span className="work-head__mark">
          <Icon icon={ChatGptIcon} className="size-4" />
        </span>
        <h2 className="work-head__name">ChatGPT Work</h2>
        {auth?.connected && <ChatGPTAccount status />}
        <span className="ml-auto" />
        {auth?.connected && <Talks />}
        <Tip label="Fechar o ChatGPT Work">
          <button onClick={onClose} className="work-act" aria-label="Fechar o ChatGPT Work">
            <Icon icon={PanelRightCloseIcon} className="size-4" />
          </button>
        </Tip>
      </header>
      {auth === null ? <div className="arrasta-shimmer m-2 h-24 rounded-[14px] bg-white/[0.03]" aria-hidden /> : auth.connected ? <Conversation /> : <SignIn />}
    </aside>
  );
}

const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Começar uma conversa nova e voltar a uma guardada; cada carrossel tem as suas. */
function Talks() {
  const chat = useEditor((s) => s.project?.chat.length ?? 0);
  const talks = useEditor((s) => s.project?.talks);
  const newTalk = useEditor((s) => s.newTalk);
  const openTalk = useEditor((s) => s.openTalk);
  const running = useAgent((s) => s.running || s.imaging.length > 0);
  const [open, setOpen] = useState(false);
  return (
    <>
      {talks && talks.length > 0 && (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Tip label="Conversas anteriores">
            <Popover.Trigger asChild>
              <button className="work-act" aria-label="Conversas anteriores" disabled={running}>
                <Icon icon={Clock01Icon} className="size-4" />
              </button>
            </Popover.Trigger>
          </Tip>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={8} className="talks glass z-50 outline-none">
              <p className="talks__title">Conversas deste carrossel</p>
              {talks.map((talk) => (
                <button
                  key={talk.id}
                  type="button"
                  className="talk"
                  onClick={() => {
                    openTalk(talk.id);
                    setOpen(false);
                  }}
                >
                  <span>{plain(talk.entries.find((entry) => entry.role === "user")?.text ?? "") || "Conversa"}</span>
                  <small>
                    {day.format(new Date(talk.at))} · {talk.entries.length} {talk.entries.length === 1 ? "mensagem" : "mensagens"}
                  </small>
                </button>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
      <Tip label="Nova conversa">
        <button onClick={newTalk} className="work-act" aria-label="Nova conversa" disabled={chat === 0 || running}>
          <Icon icon={BubbleChatAddIcon} className="size-4" />
        </button>
      </Tip>
    </>
  );
}

function Welcome({ children }: { children: ReactNode }) {
  return (
    <div className="work-flow" data-empty>
      <div className="work-welcome__stage">
        <span className="work-welcome__mark">
          <Icon icon={ChatGptIcon} className="size-10" strokeWidth={1.3} />
        </span>
      </div>
      {children}
    </div>
  );
}

function SignIn() {
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  return (
    <>
      <div className="work-thread">
        <Welcome>
          <div className="work-welcome">
            <p>
              <strong>Entre com o ChatGPT.</strong> Você pede aqui e ele edita o carrossel ao lado, com a sua conta, sem chave nem cobrança de API.
            </p>
          </div>
        </Welcome>
      </div>
      <div className="m-2 mt-0 flex shrink-0">
        <Button variant="lit" size="lg" className="w-full rounded-full" onClick={() => setLoginOpen(true)}>
          Entrar com ChatGPT
        </Button>
      </div>
    </>
  );
}

/** O próprio card, pequeno: o recorte mostra a parte de baixo, onde o título fica. */
function SlideThumb({ slide, index, size }: { slide: Slide; index: number; size: number }) {
  const design = useEditor((s) => s.project!.design);
  const total = useEditor((s) => s.project!.slides.length);
  const profile = useApp((s) => s.profile);
  const height = Math.round((size * slideHeight(design.size)) / SLIDE_W);
  return (
    <span className="work-thumb" style={{ inlineSize: size, blockSize: size }} aria-hidden>
      <div style={{ top: -Math.round((height - size) * 0.62) }}>
        <SlideFrame width={size} size={design.size}>
          <SlideCanvas slide={slide} index={index} total={total} design={design} identity={identityOf(profile)} />
        </SlideFrame>
      </div>
    </span>
  );
}

/** Tira um quadro do vídeo no navegador: o carrossel sai em imagem, então do vídeo entra uma cena. */
async function videoFrame(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Não consegui abrir esse vídeo. Tente MP4 ou MOV."));
    });
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    });
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Não consegui tirar um quadro desse vídeo.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const USE_ICONS: [RegExp, IconData][] = [
  [/^@/, UserCircleIcon],
  [/^Método/, BookOpen01Icon],
  [/^(Voz|Sua voz)/, QuillWrite01Icon],
  [/^Formato/, Layers01Icon],
];

function Conversation() {
  const project = useEditor((s) => s.project)!;
  const chat = project.chat;
  const slides = project.slides;
  const picked = useEditor((s) => s.picked);
  const unpick = useEditor((s) => s.unpick);
  const select = useEditor((s) => s.select);
  const setSelection = useEditor((s) => s.setSelection);
  const restore = useEditor((s) => s.restore);
  const running = useAgent((s) => s.running);
  const steps = useAgent((s) => s.steps);
  const thought = useAgent((s) => s.thought);
  const startedAt = useAgent((s) => s.startedAt);
  const stop = useAgent((s) => s.stop);
  const imaging = useAgent((s) => s.imaging);
  const text = useAgent((s) => s.draft);
  const setText = useAgent((s) => s.setDraft);
  const attachments = useAgent((s) => s.attachments);
  const addAttachments = useAgent((s) => s.addAttachments);
  const removeAttachment = useAgent((s) => s.removeAttachment);
  const { edit } = useAgentActions();
  const [uploading, setUploading] = useState(0);
  const [dropping, setDropping] = useState(false);
  const [mention, setMention] = useState<{ query: string; active: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsed(startedAt, running);
  const hasSlides = slides.length > 0;
  const focus = useMemo(() => slides.flatMap((slide, index) => (picked.includes(slide.id) ? [{ slide, index }] : [])), [slides, picked]);
  const ready = hasSlides && !running && uploading === 0 && (text.trim().length > 0 || attachments.length > 0);

  // A conversa é presa ao fim: o que chega aparece sem a pessoa rolar.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [chat.length, running, steps.length, imaging.length]);

  const send = async () => {
    if (!ready) return;
    const request = text;
    setText("");
    setMention(null);
    const ok = await edit(request);
    if (!ok && request.trim()) setText(request);
  };

  const attach = async (files: File[]) => {
    const media = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!media.length) return;
    setUploading((count) => count + media.length);
    const added: Attachment[] = [];
    for (const file of media) {
      try {
        const isVideo = file.type.startsWith("video/");
        const { url } = await api.upload(project.id, isVideo ? await videoFrame(file) : file);
        added.push({ id: uid(), url, kind: isVideo ? "video" : "image", name: file.name });
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setUploading((count) => count - 1);
      }
    }
    addAttachments(added);
    inputRef.current?.focus();
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (!files.length) return;
    event.preventDefault();
    void attach(files);
  };
  const onDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDropping(false);
    const fromLibrary = event.dataTransfer.getData(IMAGE_DRAG_TYPE);
    if (fromLibrary) addAttachments([{ id: uid(), url: fromLibrary, kind: "image", name: "imagem" }]);
    else void attach(Array.from(event.dataTransfer.files));
  };

  // "@" chama um card: a lista abre dentro do campo e a escolha põe o card no pedido.
  const matches = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return slides
      .map((slide, index) => ({ slide, index }))
      .filter(({ slide, index }) => !picked.includes(slide.id) && (!query || String(index + 1).startsWith(query) || plain(slide.title).toLowerCase().includes(query)))
      .slice(0, 5);
  }, [mention, slides, picked]);
  const readMention = (value: string, caret: number) => {
    const found = /(^|\s)@([^\s@]*)$/.exec(value.slice(0, caret));
    setMention(found ? { query: found[2], active: 0 } : null);
  };
  const choose = (id: string) => {
    const caret = inputRef.current?.selectionStart ?? text.length;
    setText(text.slice(0, caret).replace(/(^|\s)@([^\s@]*)$/, "$1") + text.slice(caret));
    setSelection([...picked, id]);
    setMention(null);
    inputRef.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && matches.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setMention({ ...mention, active: (mention.active + step + matches.length) % matches.length });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(matches[Math.min(mention.active, matches.length - 1)].slide.id);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMention(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const empty = chat.length === 0 && !running && imaging.length === 0;
  const clearSelection = useEditor((s) => s.clearSelection);
  const ideas = hasSlides && !running && !text.trim() && attachments.length === 0 ? suggestionsFor(askTarget(focus.map((item) => item.index))) : [];
  const lastUser = [...chat].reverse().find((entry) => entry.role === "user");
  const retry = lastUser?.text
    ? () => {
        setText(lastUser.text);
        inputRef.current?.focus();
      }
    : undefined;

  return (
    <>
      <div ref={threadRef} className="work-thread">
        {empty ? (
          <Welcome>
            <div className="work-welcome">
              <p>
                <strong>Peça uma mudança.</strong> Clique num card para o pedido valer só para ele, ou solte imagens aqui que eu coloco nos cards.
              </p>
            </div>
          </Welcome>
        ) : (
          <div className="work-flow">
            {chat.map((entry) =>
              entry.role === "user" ? (
                <Asked key={entry.id} entry={entry} slides={slides} onSelect={select} />
              ) : entry.failed ? (
                <Failure key={entry.id} entry={entry} onRetry={retry} />
              ) : (
                <Reply key={entry.id} entry={entry} slides={slides} onSelect={select} onRestore={restore} />
              ),
            )}
            {running && (
              <div className="work-reply" role="status" aria-live="polite">
                <div className="work-reply__card">
                  <ol className="work-steps__list" aria-label="Passos">
                    {steps.map((label, position) => (
                      <li key={`${label}-${position}`} data-state={position < steps.length - 1 ? "done" : "active"}>
                        <i aria-hidden />
                        <span className={position === steps.length - 1 ? "arrasta-shimmer-text" : undefined}>{label}</span>
                      </li>
                    ))}
                  </ol>
                  {thought && <p className="work-thought">{thought}</p>}
                </div>
                <div className="work-reply__foot">
                  <span className="seal" aria-label={`${elapsed} segundos`}>{elapsed} s</span>
                </div>
              </div>
            )}
            {imaging.length > 0 && (
              <div className="work-reply" role="status" aria-live="polite">
                <div className="work-reply__card">
                  <p className="work-changes__title">
                    <i className="led" aria-hidden />
                    {imaging.length === 1 ? "Gerando a imagem de 1 card" : `Gerando a imagem de ${imaging.length} cards`}
                  </p>
                  <ul className="work-changes__list">
                    {slides.flatMap((slide, index) =>
                      imaging.includes(slide.id)
                        ? [
                            <li key={slide.id}>
                              <button type="button" className="work-change" onClick={() => select(slide.id)}>
                                <SlideThumb slide={slide} index={index} size={30} />
                                <span className="work-change__name">
                                  <span>Card {index + 1}</span>
                                  <small>{plain(slide.imageIdea) || plain(slide.title)}</small>
                                </span>
                                <span className="seal" data-tone="good">
                                  <i className="animate-pulse" aria-hidden />
                                  gerando
                                </span>
                              </button>
                            </li>,
                          ]
                        : [],
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {ideas.length > 0 && (
        <div className="work-ideas no-scrollbar" role="group" aria-label="Pedidos prontos">
          {ideas.map((idea) => (
            <button key={idea} type="button" className="chip-key" onClick={() => void edit(idea)}>
              {idea}
            </button>
          ))}
        </div>
      )}
      <form
        className="work-composer"
        data-dropping={dropping || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files") && !event.dataTransfer.types.includes(IMAGE_DRAG_TYPE)) return;
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        {mention && matches.length > 0 && (
          <ul className="work-mentions" role="listbox" aria-label="Cards do carrossel">
            {matches.map(({ slide, index }, position) => (
              <li key={slide.id} role="option" aria-selected={position === mention.active} data-active={position === mention.active || undefined} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(slide.id)}>
                <SlideThumb slide={slide} index={index} size={30} />
                <span>{plain(slide.title) || "Sem título"}</span>
                <span className="seal">Card {index + 1}</span>
              </li>
            ))}
          </ul>
        )}
        {(focus.length > 0 || attachments.length > 0 || uploading > 0) && (
          <ul className="work-attachments" aria-label="Vai junto com o pedido">
            {focus.map(({ slide, index }) => (
              <li key={slide.id} className="work-attachment-slot">
                <Tip label={`Card ${index + 1}: o pedido vale para este card`}>
                  <button type="button" className="work-attachment" onClick={() => select(slide.id)} aria-label={`Slide ${index + 1}, no pedido`}>
                    <SlideThumb slide={slide} index={index} size={48} />
                    <span className="work-attachment__tag">{index + 1}</span>
                  </button>
                </Tip>
                <button type="button" className="work-attachment__off" onClick={() => unpick(slide.id)} aria-label={`Tirar o card ${index + 1} do pedido`}>
                  <Icon icon={Cancel01Icon} className="size-3" strokeWidth={2.4} />
                </button>
              </li>
            ))}
            {attachments.map((attachment) => (
              <li key={attachment.id} className="work-attachment-slot">
                <Tip label={attachment.kind === "video" ? "Um quadro do vídeo: o carrossel sai em imagem" : "Imagem anexada"}>
                  <span className="work-attachment">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachment.url} alt="" />
                    {attachment.kind === "video" && <span className="work-attachment__tag">vídeo</span>}
                  </span>
                </Tip>
                <button type="button" className="work-attachment__off" onClick={() => removeAttachment(attachment.id)} aria-label="Tirar a imagem do pedido">
                  <Icon icon={Cancel01Icon} className="size-3" strokeWidth={2.4} />
                </button>
              </li>
            ))}
            {Array.from({ length: uploading }, (_, position) => (
              <li key={`enviando-${position}`} className="work-attachment-slot">
                <span className="work-attachment arrasta-shimmer" aria-label="Enviando" />
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            readMention(event.target.value, event.target.selectionStart);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => setMention(null)}
          rows={2}
          disabled={!hasSlides || running}
          placeholder={
            running ? "Trabalhando…" : !hasSlides ? "Crie os cards para começar" : focus.length === 1 ? `O que mudar no card ${focus[0].index + 1}?` : focus.length > 1 ? `O que mudar nos ${focus.length} cards?` : "Peça uma mudança. Use @ para chamar um card"
          }
          className="work-input"
          aria-label="Pedido para o ChatGPT Work"
        />
        <div className="work-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/*"
            multiple
            hidden
            onChange={(event) => {
              void attach(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <Tip label="Anexar imagem ou vídeo">
            <button type="button" className="key" onClick={() => fileRef.current?.click()} disabled={!hasSlides || running} aria-label="Anexar imagem ou vídeo">
              <Icon icon={Add01Icon} className="size-4" />
            </button>
          </Tip>
          <Tip label={focus.length ? "O pedido vale só para o que está escolhido. Clique para valer para o carrossel todo" : "O pedido vale para o carrossel todo. Clique num card para valer só para ele"}>
            <button type="button" className="work-scope" data-on={focus.length ? "" : undefined} onClick={clearSelection} aria-label={focus.length ? "Valer para o carrossel todo" : "O pedido vale para o carrossel todo"}>
              <Icon icon={Target02Icon} className="size-3.5 shrink-0" />
              <span>{focus.length === 0 ? "Carrossel" : focus.length === 1 ? `Card ${focus[0].index + 1}` : `${focus.length} cards`}</span>
              {focus.length > 0 && <Icon icon={Cancel01Icon} className="size-3 shrink-0" strokeWidth={2.2} />}
            </button>
          </Tip>
          <ModelPicker className="work-model mb-0" />
          {running ? (
            <Tip label="Parar">
              <button type="button" className="key work-send" onClick={stop} aria-label="Parar">
                <Icon icon={StopIcon} className="size-3.5 fill-current" />
              </button>
            </Tip>
          ) : (
            <button type="submit" className="key work-send" data-ready={ready || undefined} disabled={!ready} aria-label="Enviar">
              <Icon icon={ArrowUp02Icon} className="size-[18px]" />
            </button>
          )}
        </div>
      </form>
    </>
  );
}

/** O pedido: por cima do balão, o que foi junto (cards em foco, imagens, o que ele usa por trás). */
function Asked({ entry, slides, onSelect }: { entry: ChatEntry; slides: Slide[]; onSelect: (id: string) => void }) {
  const focus = entry.focus ?? (entry.scope !== null ? [entry.scope] : []);
  const images = entry.images ?? [];
  const shown = images.slice(0, 6);
  return (
    <div className="work-turn">
      {(shown.length > 0 || focus.length > 0) && (
        <ul className="work-sent">
          {focus.map((index) =>
            slides[index] ? (
              <li key={`slide-${index}`}>
                <button type="button" className="work-attachment" onClick={() => onSelect(slides[index].id)} aria-label={`Card ${index + 1}`}>
                  <SlideThumb slide={slides[index]} index={index} size={48} />
                  <span className="work-attachment__tag">{index + 1}</span>
                </button>
              </li>
            ) : null,
          )}
          {shown.map((src, position) => (
            <li key={`${src}-${position}`}>
              <span className="work-attachment">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
                {position === shown.length - 1 && images.length > shown.length && <span className="work-attachment__tag">+{images.length - shown.length}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {entry.uses && entry.uses.length > 0 && (
        <div className="work-uses">
          {entry.uses.map((label) => {
            const icon = USE_ICONS.find(([test]) => test.test(label))?.[1] ?? Tick02Icon;
            return (
              <span key={label} className="work-mention">
                <Icon icon={icon} className="size-3.5" />
                {label}
              </span>
            );
          })}
        </div>
      )}
      {entry.text && <p className="work-bubble">{entry.text}</p>}
    </div>
  );
}

function Reply({ entry, slides, onSelect, onRestore }: { entry: ChatEntry; slides: Slide[]; onSelect: (id: string) => void; onRestore: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const steps = entry.steps ?? [];
  const changed = slides.flatMap((slide, index) => (entry.changed.includes(slide.id) ? [{ slide, index }] : []));
  const all = changed.length === slides.length && slides.length > 3;
  const rows = all ? [] : changed.slice(0, 4);
  return (
    <div className="work-reply">
      <div className="work-reply__card">
        {steps.length > 0 && (
          <div className="work-steps">
            <button type="button" className="work-steps__head" aria-expanded={open} onClick={() => setOpen(!open)}>
              <span className="work-steps__lights" aria-hidden>
                {steps.map((_, position) => (
                  <i key={position} />
                ))}
              </span>
              {steps.length === 1 ? "1 passo" : `${steps.length} passos`}
              <Icon icon={ArrowDown01Icon} className="size-3.5 transition-transform duration-150" style={{ rotate: open ? "0deg" : "-90deg" }} />
            </button>
            {open && (
              <ol className="work-steps__list">
                {steps.map((label, position) => (
                  <li key={`${label}-${position}`}>
                    <i aria-hidden />
                    {label}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        <p className="work-reply__text">{entry.text}</p>
        {changed.length > 0 && (
          <div className="work-changes">
            <p className="work-changes__title">
              <i className="led" aria-hidden />
              {all ? `Mexeu nos ${slides.length} cards` : changed.length === 1 ? "Mexeu em 1 card" : `Mexeu em ${changed.length} cards`}
            </p>
            {rows.length > 0 && (
              <ul className="work-changes__list">
                {rows.map(({ slide, index }) => (
                  <li key={slide.id}>
                    <button type="button" className="work-change" onClick={() => onSelect(slide.id)}>
                      <SlideThumb slide={slide} index={index} size={30} />
                      <span className="work-change__name">
                        <span>{plain(slide.title) || "Sem título"}</span>
                        <small>
                          Card {index + 1} · {SLIDE_KINDS.find((kind) => kind.id === slide.kind)?.name}
                        </small>
                      </span>
                      <Icon icon={ArrowRight01Icon} className="work-change__go size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {entry.before && (
        <div className="work-reply__foot">
          <button type="button" className="chip-key" onClick={() => onRestore(entry.id)}>
            <Icon icon={Undo02Icon} className="size-3.5" />
            Desfazer
          </button>
        </div>
      )}
    </div>
  );
}

function Failure({ entry, onRetry }: { entry: ChatEntry; onRetry?: () => void }) {
  const stopped = entry.text === "Parei, como você pediu.";
  return (
    <div className="work-failure" role="alert">
      <span className="work-failure__light">
        <Icon icon={Alert02Icon} className="size-3.5" />
      </span>
      <div className="work-failure__words">
        <strong>{stopped ? "Parei" : "Não consegui responder"}</strong>
        <p>{stopped ? "Nada foi mudado no carrossel." : entry.text}</p>
      </div>
      {onRetry && !stopped && (
        <div className="work-failure__row">
          <button type="button" className="key work-pill" onClick={onRetry}>
            <Icon icon={RefreshIcon} className="size-3.5" />
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}
