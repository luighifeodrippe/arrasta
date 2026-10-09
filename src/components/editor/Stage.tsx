"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight02Icon, Copy01Icon, Delete02Icon, DragDropVerticalIcon, Layout3ColumnIcon, Layout3RowIcon, PlusSignIcon, Tick02Icon, ZoomInAreaIcon, ZoomOutAreaIcon } from "@hugeicons/core-free-icons";
import { restoreLayout, useStageView, ZOOM_LEVELS, type Layout } from "./stage-view";
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { identityOf, useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { IMAGE_DRAG_TYPE, placeImage, uploadToSlide } from "@/lib/client/images";
import { fitSlideWidth, FONTS, MAX_SLIDES, SLIDE_KINDS, SLIDE_W, slideHeight, TEMPLATES } from "@/lib/defaults";
import type { Design, Project, Slide } from "@/lib/types";
import type { EditBinding } from "../slide/editing";
import { SlideCanvas, SlideFrame, type SlideIdentity } from "../slide/SlideCanvas";
import { AuroraArt } from "../ui/aurora-art";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Tip } from "../ui/tooltip";
import { useAgent } from "./agent-store";
import { AgentSteps } from "./AgentSteps";
import { useEditing } from "./editing-store";
import { EditorToolbar } from "./Toolbar";
import { useAgentActions } from "./use-agent-actions";
import { Icon } from "@/components/ui/icon";

/** Espaço vertical que não é do card: barra de ferramentas em cima, rótulo do card e a barra do ChatGPT embaixo. */
const LABEL = 28;
const BAR = 112;
const TOOL = 64;
const ZOOMS = [0.5, 0.72, 0.9] as const;
const COLUMN_WIDTHS = [340, 440, 560] as const;
const FLASH_MS = 4000;

/** Zoom dos cards e lado a lado ou em coluna; fica na barra do topo do editor. */
export function ViewControls() {
  const zoom = useStageView((s) => s.zoom);
  const layout = useStageView((s) => s.layout);
  const setZoom = useStageView((s) => s.setZoom);
  const setLayout = useStageView((s) => s.setLayout);
  const button = "grid size-8 place-items-center rounded-[9px] transition-colors disabled:opacity-35";
  return (
    <div className="flex items-center rounded-[11px] border border-white/[0.07] p-0.5">
      <Tip label="Diminuir os cards">
        <button onClick={() => setZoom(zoom - 1)} disabled={zoom === 0} className={cn(button, "text-ink-2 hover:bg-white/[0.07] hover:text-ink")} aria-label="Diminuir os cards">
          <Icon icon={ZoomOutAreaIcon} className="size-4" />
        </button>
      </Tip>
      <Tip label="Aumentar os cards">
        <button onClick={() => setZoom(zoom + 1)} disabled={zoom === ZOOM_LEVELS - 1} className={cn(button, "text-ink-2 hover:bg-white/[0.07] hover:text-ink")} aria-label="Aumentar os cards">
          <Icon icon={ZoomInAreaIcon} className="size-4" />
        </button>
      </Tip>
      <span className="mx-0.5 h-4 w-px bg-white/[0.1]" aria-hidden />
      <div role="radiogroup" aria-label="Como mostrar os slides" className="flex">
        {(
          [
            ["row", "Lado a lado", <Icon icon={Layout3ColumnIcon} key="row" className="size-4" />],
            ["column", "Em coluna", <Icon icon={Layout3RowIcon} key="column" className="size-4" />],
          ] as const
        ).map(([value, label, icon]) => (
          <Tip key={value} label={label}>
            <button
              role="radio"
              aria-checked={layout === value}
              aria-label={label}
              onClick={() => setLayout(value as Layout)}
              className={cn(button, layout === value ? "bg-white/[0.1] text-ink" : "text-ink-2 hover:bg-white/[0.07] hover:text-ink")}
            >
              {icon}
            </button>
          </Tip>
        ))}
      </div>
    </div>
  );
}

/** Palco: todos os slides lado a lado (ou em coluna), com a barra de formatação em cima. */
export function Stage() {
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const running = useAgent((s) => s.running);
  const kind = useAgent((s) => s.kind);
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 700 });
  const zoom = useStageView((s) => s.zoom);
  const layout = useStageView((s) => s.layout);

  useEffect(restoreLayout, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Outro slide escolhido: a barra volta a valer para o slide todo até um texto ser tocado.
  useEffect(() => {
    useEditing.getState().setTarget(null);
  }, [selectedId]);

  const ratio = slideHeight(project.design.size) / SLIDE_W;
  const working = running && (kind === "remix" || kind === "create");
  const tools = !working && project.slides.length > 0;
  const toolSpace = tools ? TOOL : 0;
  const fitHeight = Math.max(0, box.h - toolSpace - LABEL - BAR - 32);
  const rowWidth = fitSlideWidth(project.design.size, Math.max(0, box.w - 48), fitHeight * ZOOMS[zoom], 440);
  const columnWidth = Math.max(0, Math.floor(Math.min(box.w - 48, COLUMN_WIDTHS[zoom])));
  const top = toolSpace + 16 + Math.max(0, (fitHeight - rowWidth * ratio) / 2);

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 min-w-0 overflow-hidden bg-[radial-gradient(rgb(255_255_255/0.055)_1px,transparent_1.2px)] [background-size:22px_22px]"
      style={{ ["--stage-top" as string]: `${top}px`, ["--tool" as string]: `${toolSpace}px` }}
    >
      {working ? (
        <WorkView project={project} width={rowWidth} ratio={ratio} />
      ) : project.slides.length === 0 ? (
        <EmptyStage project={project} />
      ) : (
        <SlideList project={project} width={layout === "column" ? columnWidth : rowWidth} ratio={ratio} layout={layout} />
      )}
      {tools && (
        <div className="@container pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-3 pt-3">
          <div className="pointer-events-auto flex min-w-0 max-w-full justify-center">
            <EditorToolbar />
          </div>
        </div>
      )}
    </div>
  );
}

function SlideList({ project, width, ratio, layout }: { project: Project; width: number; ratio: number; layout: Layout }) {
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const moveSlide = useEditor((s) => s.moveSlide);
  const addSlide = useEditor((s) => s.addSlide);
  const profile = useApp((s) => s.profile);
  const identity = identityOf(profile);
  const scrollRef = useRef<HTMLDivElement>(null);
  const column = layout === "column";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-slide-card="${selectedId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [selectedId, layout]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = project.slides.findIndex((s) => s.id === active.id);
    const to = project.slides.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) moveSlide(from, to);
  };

  return (
    <div
      ref={scrollRef}
      onClick={(event) => {
        // Clique no vazio do palco termina a edição de texto.
        if (event.target === event.currentTarget) (document.activeElement as HTMLElement | null)?.blur();
      }}
      className={cn(
        "h-full min-w-0 overscroll-none",
        column
          ? "overflow-y-auto overflow-x-hidden pb-[152px] pt-[calc(var(--tool)+12px)]"
          : "no-scrollbar flex items-start overflow-x-auto overflow-y-hidden px-[max(32px,calc(50%-var(--strip)/2))] pt-[var(--stage-top)]",
      )}
      style={column ? undefined : { ["--strip" as string]: `${project.slides.length * (width + 20) + width * 0.5}px` }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          // Um arraste iniciado sobre a imagem move o card e não deixa o enquadramento ativo depois.
          const focused = document.activeElement;
          if (focused instanceof HTMLElement && focused.matches("[data-slide-image]")) focused.blur();
        }}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={project.slides.map((s) => s.id)} strategy={column ? verticalListSortingStrategy : horizontalListSortingStrategy}>
          <div className={cn("flex", column ? "mx-auto flex-col gap-7" : "items-start gap-5 pb-6")} style={column ? { width } : undefined}>
            {project.slides.map((slide, index) => (
              <SortableCard
                key={slide.id}
                slide={slide}
                index={index}
                total={project.slides.length}
                design={project.design}
                identity={identity}
                width={width}
                selected={slide.id === selectedId}
                onSelect={() => select(slide.id)}
              />
            ))}
            {project.slides.length < MAX_SLIDES && (
              <button
                onClick={() => addSlide(selectedId)}
                style={column ? { width, height: 64 } : { width: width * 0.42, height: width * ratio }}
                className={cn(
                  "flex shrink-0 items-center justify-center gap-2 rounded-[16px] border border-dashed border-white/[0.14] text-[13px] text-ink-3 transition-colors hover:border-white/30 hover:text-ink",
                  column ? "flex-row" : "mt-7 flex-col",
                )}
              >
                <Icon icon={PlusSignIcon} className="size-5" />
                Slide
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableCard({
  slide,
  index,
  total,
  design,
  identity,
  width,
  selected,
  onSelect,
}: {
  slide: Slide;
  index: number;
  total: number;
  design: Design;
  identity: SlideIdentity;
  width: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });
  const duplicateSlide = useEditor((s) => s.duplicateSlide);
  const removeSlide = useEditor((s) => s.removeSlide);
  const updateSlide = useEditor((s) => s.updateSlide);
  const highlight = useAgent((s) => s.highlight);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const kindName = SLIDE_KINDS.find((k) => k.id === slide.kind)?.name ?? "";
  const flashed = useFlash(highlight.ids.includes(slide.id) ? highlight.at : 0);

  const binding = useMemo<EditBinding | undefined>(() => {
    if (!selected) return undefined;
    return {
      setText: (field, value) => updateSlide(slide.id, { [field]: value }, field),
      setImage: (patch) => {
        const current = useEditor.getState().project?.slides.find((s) => s.id === slide.id)?.image;
        if (current) updateSlide(slide.id, { image: { ...current, ...patch } }, "image");
      },
      scale: width / SLIDE_W,
      pendingFocus,
      requestFocus: setPendingFocus,
      onEditing: (field, toggle) => {
        setEditing(field);
        useEditing.getState().setEditing(field, toggle);
      },
      editIdentity: () => useEditing.getState().setIdentityOpen(true),
    };
  }, [selected, slide.id, width, pendingFocus, updateSlide]);


  return (
    <div
      ref={setNodeRef}
      data-slide-card={slide.id}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 20 : undefined, width }}
      className="group relative shrink-0"
    >
      {/* Os slides chegam "revelando": sobem e saem do desfoque, um depois do outro. */}
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1], delay: Math.min(index, 10) * 0.06 }}
      >
        <div className="mb-2.5 flex h-[18px] items-center justify-between gap-2 px-0.5 text-[12px]">
          <span className={cn("flex min-w-0 items-center gap-1 font-medium tabular-nums transition-colors", selected ? "text-ink" : "text-ink-3")}>
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              {...attributes}
              aria-label={`Arrastar o slide ${index + 1}`}
              className="-ml-1.5 grid size-6 cursor-grab touch-none place-items-center rounded-[7px] text-ink-3 opacity-60 transition-opacity hover:bg-white/[0.08] hover:text-ink hover:opacity-100 active:cursor-grabbing"
            >
              <Icon icon={DragDropVerticalIcon} className="size-3.5" />
            </button>
            {index + 1}
            <span className="ml-1.5 truncate font-normal text-ink-3">{kindName}</span>
            {flashed && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="ml-1.5 rounded-full bg-white/[0.1] px-2 py-0.5 text-[11px] font-medium text-ink"
              >
                Atualizado
              </motion.span>
            )}
          </span>
          {editing ? (
            <span className="flex items-center gap-1">
              <button
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
                className="flex h-6 items-center gap-1 rounded-[7px] px-1.5 text-[11.5px] text-ink-2 transition-colors hover:bg-white/[0.08] hover:text-ink"
              >
                <Icon icon={Tick02Icon} className="size-3.5" />
                Pronto
              </button>
            </span>
          ) : (
            <span className={cn("flex items-center gap-0.5 transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
              <Tip label="Duplicar">
                <button onClick={() => duplicateSlide(slide.id)} className="grid size-6 place-items-center rounded-[7px] text-ink-3 hover:bg-white/[0.08] hover:text-ink" aria-label="Duplicar slide">
                  <Icon icon={Copy01Icon} className="size-3.5" />
                </button>
              </Tip>
              {total > 1 && (
                <Tip label="Excluir">
                  <button onClick={() => removeSlide(slide.id)} className="grid size-6 place-items-center rounded-[7px] text-ink-3 hover:bg-red-500/15 hover:text-red-300" aria-label="Excluir slide">
                    <Icon icon={Delete02Icon} className="size-3.5" />
                  </button>
                </Tip>
              )}
            </span>
          )}
        </div>
        <div
          role="group"
          data-tour={selected ? "stage" : undefined}
          aria-label={`Slide ${index + 1}${selected ? ", selecionado: clique no texto para editar" : ""}`}
          tabIndex={selected ? -1 : 0}
          onClick={onSelect}
          onKeyDown={(event) => {
            if (!selected && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              onSelect();
            }
          }}
          // Texto, perfil e imagem focada isolam seus gestos. O restante do card sempre pode reordenar.
          onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement> | undefined}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files") && !event.dataTransfer.types.includes(IMAGE_DRAG_TYPE)) return;
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropping(false);
            const fromLibrary = event.dataTransfer.getData(IMAGE_DRAG_TYPE);
            if (fromLibrary) {
              placeImage(slide.id, fromLibrary);
              return;
            }
            const file = Array.from(event.dataTransfer.files).find((f) => f.type.startsWith("image/"));
            if (file) void uploadToSlide(slide.id, file);
          }}
          className={cn(
            "relative block w-full touch-none overflow-hidden rounded-[16px] outline-none transition-[box-shadow,transform] duration-200 ease-out",
            selected
              ? "shadow-[0_0_0_2px_rgb(255_255_255/0.9),0_24px_60px_-20px_rgb(0_0_0/0.9)]"
              : "shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_18px_44px_-24px_rgb(0_0_0/0.9)] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.22),0_18px_44px_-24px_rgb(0_0_0/0.9)] focus-visible:shadow-[0_0_0_2px_rgb(255_255_255/0.5)]",
            "cursor-grab active:cursor-grabbing",
            flashed && !selected && "shadow-[0_0_0_2px_rgb(255_255_255/0.55),0_0_40px_-6px_rgb(255_255_255/0.35)]",
            isDragging && "scale-[1.02] cursor-grabbing shadow-[0_0_0_2px_rgb(255_255_255/0.9),0_40px_80px_-20px_rgb(0_0_0/0.95)]",
            dropping && "shadow-[0_0_0_2px_#ff3500]",
          )}
        >
          <SlideFrame width={width} size={design.size}>
            <SlideCanvas slide={slide} index={index} total={total} design={design} identity={identity} edit={binding} />
          </SlideFrame>
          {dropping && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 text-[13px] font-medium text-white">
              Solte para usar a imagem
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/** Projeto com original e sem slides (o ChatGPT foi interrompido ou ainda não rodou). */
function EmptyStage({ project }: { project: Project }) {
  const { generate } = useAgentActions();
  const addSlide = useEditor((s) => s.addSlide);
  const source = project.source;
  const isIdea = source?.kind === "idea";
  const what = !source
    ? "Este carrossel ainda não tem slides."
    : isIdea
      ? `“${source.brief}”`
      : source.kind === "x"
        ? `Post de @${source.author?.username ?? "alguém"} pronto para virar carrossel.`
        : source.kind === "web"
          ? `“${source.title ?? source.url}” pronto para virar carrossel.`
          : source.kind === "youtube"
            ? `Vídeo “${source.title ?? ""}” pronto para virar carrossel.`
          : `${source.slides.length} slides originais prontos para recriar.`;
  return (
    <div className="flex h-full items-center justify-center px-6 pb-28">
      <div className="flex max-w-[460px] flex-col items-center gap-5 text-center">
        <AuroraArt className="-mb-6 max-w-[440px] opacity-90" />
        <p className="text-pretty text-[15px] leading-relaxed text-ink-2">{what}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {source && (
            <Button variant="primary" size="lg" onClick={() => generate(isIdea ? "create" : "remix")}>
              {isIdea ? "Escrever na minha voz" : "Recriar na minha voz"}
              <Icon icon={ArrowRight02Icon} />
            </Button>
          )}
          <Button variant="ghost" size="lg" onClick={() => addSlide(null)}>
            Começar em branco
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Liga por alguns segundos depois que a resposta do ChatGPT mexeu no slide. */
function useFlash(at: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!at || Date.now() - at > FLASH_MS) return;
    setOn(true);
    const timer = setTimeout(() => setOn(false), FLASH_MS - (Date.now() - at));
    return () => clearTimeout(timer);
  }, [at]);
  return on;
}

/** Enquanto o ChatGPT trabalha: o original passa pela leitura, depois vira base da reescrita. */
function WorkView({ project, width, ratio }: { project: Project; width: number; ratio: number }) {
  const phase = useAgent((s) => s.phase);
  const source = project.source;
  const sources = source?.slides ?? [];

  if (source && (source.kind === "x" || source.kind === "web" || source.kind === "youtube")) {
    const isVideo = source.kind === "youtube";
    return (
      <div className="flex h-full items-start justify-center px-8 pt-[var(--stage-top)]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="glass relative flex w-full max-w-[520px] flex-col gap-4 overflow-hidden rounded-[22px] p-6"
          style={{ minHeight: width * 0.9 }}
        >
          <div className="flex items-center gap-3">
            {source.author?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={source.author.avatar} alt="" className="size-11 rounded-full object-cover" />
            ) : (
              <span className="grid size-11 place-items-center rounded-full bg-white/[0.08] text-[15px] font-semibold text-ink-2">{(source.site ?? "?").charAt(0).toUpperCase()}</span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{isVideo ? source.title : (source.author?.fullName ?? source.title ?? source.site)}</p>
              <p className="truncate text-[13px] text-ink-3">{isVideo ? `${source.author?.fullName ?? ""} · YouTube` : source.author ? `@${source.author.username} · X` : source.site}</p>
            </div>
          </div>
          <AgentSteps
            steps={
              isVideo
                ? [
                    { label: "Abrir o vídeo", state: "done" },
                    { label: `Ler a transcrição${source.duration ? ` (${Math.round(source.duration / 60)} min de fala)` : ""}`, state: "done" },
                    { label: "Escrever na sua voz", state: "active" },
                  ]
                : [
                    { label: source.kind === "x" ? "Abrir o post" : "Abrir a página", state: "done" },
                    { label: "Ler e escrever na sua voz", state: "active" },
                  ]
            }
          />
          {isVideo && source.media[0] ? (
            <div className="relative overflow-hidden rounded-[14px] border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source.media[0]} alt="" className="aspect-video w-full object-cover" />
              {source.duration && (
                <span className="absolute bottom-2 right-2 rounded-[6px] bg-black/75 px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-white">
                  {Math.floor(source.duration / 60)}:{String(source.duration % 60).padStart(2, "0")}
                </span>
              )}
            </div>
          ) : (
            <>
              <p className="line-clamp-[7] whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{source.text}</p>
              {source.media[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={source.media[0]} alt="" className="max-h-[180px] w-full rounded-[14px] border border-white/10 object-cover" />
              )}
            </>
          )}
          <div className="pointer-events-none absolute inset-0">
            <div className="arrasta-scan absolute inset-x-0 top-0 h-[10%]" style={{ background: "linear-gradient(to bottom, transparent, rgb(255 255 255 / 0.12) 70%, rgb(255 255 255 / 0.4) 96%, transparent)" }} />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!sources.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-8 pb-28 text-center">
        <ThinkingOrb state="composing" size={64} theme="dark" aria-label="Escrevendo" />
        {source?.brief && <p className="max-w-[460px] text-pretty text-[15px] leading-relaxed text-ink-2">“{source.brief}”</p>}
        <div className="flex gap-3 opacity-80">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="arrasta-shimmer glass-flat rounded-[12px]" style={{ width: width * 0.32, height: width * 0.4, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  const analysis = phase === "write" ? source?.analysis : null;
  const style = phase === "write" ? source?.style : null;
  const steps = [
    { label: "Abrir o carrossel", state: "done" as const },
    { label: `Ler ${sources.length === 1 ? "o slide" : `os ${sources.length} slides`}`, state: phase === "read" ? ("active" as const) : ("done" as const) },
    { label: "Entender por que funciona", state: analysis ? ("done" as const) : ("todo" as const) },
    { label: "Escrever na sua voz", state: phase === "write" ? ("active" as const) : ("todo" as const) },
  ];
  return (
    <div
      className="no-scrollbar flex h-full items-start overflow-x-auto px-[max(32px,calc(50%-var(--strip)/2))] pt-[var(--stage-top)]"
      style={{ ["--strip" as string]: `${sources.length * (width + 20) + width * 1.15 + 20}px` }}
    >
      <div className="flex items-start gap-5 pb-6">
        {(
          <motion.div
            initial={{ opacity: 0, x: -12, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="shrink-0"
            style={{ width: width * 1.15 }}
          >
            <div className="mb-2.5 h-[18px] px-0.5 text-[12px] text-ink-2">ChatGPT trabalhando</div>
            <div className="glass flex flex-col gap-4 overflow-y-auto rounded-[16px] p-5" style={{ height: width * ratio }}>
              <AgentSteps steps={steps} />
              {analysis && <div className="h-px shrink-0 bg-line" />}
              {analysis && [
                ["Gancho", analysis.hook],
                ["Estrutura", analysis.structure],
                ["Por que funciona", analysis.why],
              ].map(([term, text], i) => (
                <motion.div
                  key={term}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.25 + i * 0.35 }}
                >
                  <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-3">{term}</p>
                  <p className="mt-1 text-[13.5px] leading-snug text-ink">{text}</p>
                </motion.div>
              ))}
              {style && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 1.4 }}
                  className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-[12px] text-ink-2"
                >
                  <span className="text-ink-3">Estilo:</span>
                  <span className="rounded-full bg-white/[0.07] px-2 py-0.5">{TEMPLATES.find((t) => t.id === style.template)?.name}</span>
                  <span className="rounded-full bg-white/[0.07] px-2 py-0.5">{style.theme === "dark" ? "Escuro" : "Claro"}</span>
                  <span className="flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-0.5">
                    <span className="size-2.5 rounded-full" style={{ background: style.accent }} />
                    {style.accent}
                  </span>
                  <span className="rounded-full bg-white/[0.07] px-2 py-0.5">{FONTS.find((f) => f.id === style.font)?.name}</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
        {sources.map((s, i) => {
          const read = Boolean(s.text.trim());
          return (
            <motion.div
              key={s.src}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: phase === "write" ? 0.72 : 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: i * 0.05 }}
              className="shrink-0"
              style={{ width }}
            >
              <div className="mb-2.5 flex h-[18px] items-center justify-between px-0.5 text-[12px] text-ink-3">
                <span className="tabular-nums">Original {i + 1}</span>
                {read && (
                  <span className="flex items-center gap-1 text-ink-2">
                    <Icon icon={Tick02Icon} className="size-3.5" /> lido
                  </span>
                )}
              </div>
              <div className="relative overflow-hidden rounded-[16px] shadow-[0_0_0_1px_rgb(255_255_255/0.08)]" style={{ height: width * ratio }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={`Slide original ${i + 1}`} className="size-full object-cover" />
                {phase === "write" && read && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-3.5 pb-3.5 pt-10"
                  >
                    <p className="line-clamp-5 whitespace-pre-line text-[11.5px] leading-snug text-white/85">{s.text}</p>
                  </motion.div>
                )}
                {phase === "read" && !read && (
                  <div className="pointer-events-none absolute inset-0">
                    <div className="arrasta-scan absolute inset-x-0 top-0 h-[10%]" style={{ animationDelay: `${i * 0.25}s`, background: "linear-gradient(to bottom, transparent, rgb(255 255 255 / 0.22) 70%, rgb(255 255 255 / 0.6) 96%, transparent)" }} />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
