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
import { ArrowRight02Icon, Copy01Icon, Delete02Icon, DragDropVerticalIcon, Layout3ColumnIcon, Layout3RowIcon, PlusSignIcon, MinusSignIcon, GridViewIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { restoreLayout, useStageView, type Layout } from "./stage-view";
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useModKey } from "@/lib/client/shortcut";
import { cardWidth, MAX_ZOOM, MIN_ZOOM } from "@/lib/client/stage-math";
import { StageGuides } from "./StageGuides";
import { SelectionBar } from "./SelectionBar";
import { useStageCamera } from "./use-stage-camera";
import { identityOf, useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { IMAGE_DRAG_TYPE, placeImage, uploadToSlide } from "@/lib/client/images";
import { fitRowSlideWidth, MAX_SLIDES, SLIDE_KINDS, SLIDE_W, slideHeight } from "@/lib/defaults";
import type { Design, Project, Slide } from "@/lib/types";
import type { EditBinding } from "../slide/editing";
import { SlideCanvas, SlideFrame, type SlideIdentity } from "../slide/SlideCanvas";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Tip } from "../ui/tooltip";
import { useAgent } from "./agent-store";
import { Launcher } from "../app/Launcher";
import { Mission, Shots } from "./Mission";
import { useEditing } from "./editing-store";
import { EditorToolbar } from "./Toolbar";
import { useAgentActions } from "./use-agent-actions";
import { CoversDialog } from "./CoversDialog";
import { Icon } from "@/components/ui/icon";

/** Espaço vertical que não é do card: barra de ferramentas em cima, rótulo do card e a barra do ChatGPT embaixo. */
const LABEL = 28;
const TOOL = 64;
const FLASH_MS = 4000;

/** Zoom dos cards e lado a lado ou em coluna; fica na barra do topo do editor. */
export function ViewControls({ className }: { className?: string }) {
  const zoom = useStageView((s) => s.zoom);
  const layout = useStageView((s) => s.layout);
  const zoomIn = useStageView((s) => s.zoomIn);
  const zoomOut = useStageView((s) => s.zoomOut);
  const fit = useStageView((s) => s.fit);
  const guides = useStageView((s) => s.guides);
  const toggleGuides = useStageView((s) => s.toggleGuides);
  const width = useStageView((s) => s.cardWidth);
  const mod = useModKey();
  const setLayout = useStageView((s) => s.setLayout);
  const button = "grid size-8 place-items-center rounded-[9px] transition-colors disabled:opacity-35";
  return (
    <div className={cn("well flex items-center rounded-[11px] p-0.5", className)}>
      <Tip label={`Diminuir (${mod}−)`}>
        <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className={cn(button, "text-ink-2 hover:bg-white/[0.07] hover:text-ink")} aria-label="Diminuir">
          <Icon icon={MinusSignIcon} className="size-4" />
        </button>
      </Tip>
      <Tip label={`Ajustar à tela (${mod}0)`}>
        <button onClick={fit} className="h-8 min-w-12 rounded-[9px] px-1.5 text-[12px] text-ink-2 tabular-nums hover:bg-white/[0.07] hover:text-ink" aria-label={`Ajustar à tela (${mod}0)`}>{Math.round(width / SLIDE_W * 100)}%</button>
      </Tip>
      <Tip label={`Aumentar (${mod}+)`}>
        <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM} className={cn(button, "text-ink-2 hover:bg-white/[0.07] hover:text-ink")} aria-label="Aumentar">
          <Icon icon={PlusSignIcon} className="size-4" />
        </button>
      </Tip>
      <Tip label="Margens do Instagram">
        <button onClick={toggleGuides} aria-pressed={guides} aria-label="Margens do Instagram" className={cn(button, guides ? "bg-white/[0.1] text-ink" : "text-ink-2 hover:bg-white/[0.07] hover:text-ink")}><Icon icon={GridViewIcon} className="size-4" /></button>
      </Tip>
      <span className="mx-0.5 h-4 w-px bg-white/[0.1]" aria-hidden />
      <div role="radiogroup" aria-label="Como mostrar os cards" className="flex">
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
export function Stage({ onDownload }: { onDownload: (ids: string[]) => void }) {
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const selection = useEditor((s) => s.selection);
  const running = useAgent((s) => s.running);
  const kind = useAgent((s) => s.kind);
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 700, gap: 20 });
  const zoom = useStageView((s) => s.zoom);
  const layout = useStageView((s) => s.layout);

  useEffect(restoreLayout, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBox({
      w: el.clientWidth,
      h: el.clientHeight,
      gap: 1.25 * parseFloat(getComputedStyle(document.documentElement).fontSize), // gap-5: 1.25rem
    });
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
  const barSpace = useStageView((s) => s.barSpace);
  const fitHeight = Math.max(0, box.h - toolSpace - LABEL - barSpace - 32);
  const fittedWidth = cardWidth(fitHeight, zoom, ratio, "row", box.w);
  const rowWidth = layout === "row" && !working && zoom <= 0.9
    ? fitRowSlideWidth(fittedWidth, box.w - 64, project.slides.length, box.gap)
    : fittedWidth;
  const columnWidth = cardWidth(fitHeight, zoom, ratio, "column", box.w);
  const width = layout === "column" ? columnWidth : rowWidth;
  useLayoutEffect(() => { useStageView.setState({ cardWidth: width }); }, [width]);
  const top = toolSpace + 16 + Math.max(0, (fitHeight - rowWidth * ratio) / 2);

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 min-w-0 overflow-hidden bg-[radial-gradient(rgb(255_255_255/0.055)_1px,transparent_1.2px)] [background-size:22px_22px]"
      style={{ ["--stage-top" as string]: `${top}px`, ["--tool" as string]: `${toolSpace}px`, ["--bar" as string]: `${barSpace + 40}px` }}
    >
      {working ? (
        <Mission project={project} />
      ) : project.slides.length === 0 ? (
        <EmptyStage project={project} />
      ) : (
        <SlideList project={project} width={layout === "column" ? columnWidth : rowWidth} ratio={ratio} layout={layout} />
      )}
      {tools && (
        <div className="@container pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-3 pt-3">
          <div className="pointer-events-auto flex min-w-0 max-w-full justify-center">
            {selection.length >= 2 ? <SelectionBar onDownload={onDownload} /> : <EditorToolbar />}
          </div>
        </div>
      )}
    </div>
  );
}

function SlideList({ project, width, ratio, layout }: { project: Project; width: number; ratio: number; layout: Layout }) {
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const selection = useEditor((s) => s.selection);
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

  const camera = useStageCamera(scrollRef, width, layout);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = project.slides.findIndex((s) => s.id === active.id);
    const to = project.slides.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) moveSlide(from, to);
  };

  return (
    <div className="relative h-full overflow-hidden [&[data-stage-panning=true]_*]:cursor-[inherit]" style={{ cursor: camera.cursor }} data-stage-panning={camera.cursor ? "true" : undefined}>
    <div
      ref={scrollRef}
      data-stage-scroll
      {...camera.handlers}
      className={cn(
        "h-full min-w-0 overscroll-none overflow-auto [overflow-anchor:none]",
        "pl-[calc(var(--stage-side)+var(--camera-left,0px))] pr-[calc(var(--stage-side)+var(--camera-right,0px))]",
        "pt-[calc(var(--stage-top)+var(--camera-top,0px))] pb-[calc(var(--bar)+var(--camera-bottom,0px))]",
        !column && "no-scrollbar",
      )}
      style={{
        ["--stage-side" as string]: column ? `max(24px, calc(50% - ${width / 2}px))` : `max(32px, calc(50% - ${(project.slides.length * (width + 20) + width * 0.5) / 2}px))`,
        ...(column ? { ["--stage-top" as string]: "calc(var(--tool) + 12px)" } : {}),
      }}
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
          <div data-tour="stage" className={cn("flex", column ? "flex-col gap-7" : "w-max items-start gap-5")} style={column ? { width } : undefined}>
            {project.slides.map((slide, index) => (
              <SortableCard
                key={slide.id}
                slide={slide}
                index={index}
                total={project.slides.length}
                design={project.design}
                identity={identity}
                width={width}
                selected={selection.length ? selection.includes(slide.id) : slide.id === selectedId}
                editable={slide.id === selectedId && selection.length < 2}
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
                Card
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
    {camera.marquee && <div aria-hidden className="pointer-events-none absolute z-20 rounded-[2px] border border-white/70 bg-white/[0.06]" style={camera.marquee} />}
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
  editable,
  onSelect,
}: {
  slide: Slide;
  index: number;
  total: number;
  design: Design;
  identity: SlideIdentity;
  width: number;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
}) {
  const guides = useStageView((s) => s.guides);
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
  const imaging = useAgent((s) => s.imaging.includes(slide.id));
  // O ChatGPT Work está mexendo neste card agora (pedido de edição em andamento).
  const rewriting = useAgent((s) => s.running && s.kind === "edit" && (s.focus.length === 0 || s.focus.includes(slide.id)));

  const binding = useMemo<EditBinding | undefined>(() => {
    if (!editable) return undefined;
    return {
      moveBlock: (block, offset) => useEditor.getState().moveBlock(slide.id, block, offset),
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
  }, [editable, slide.id, width, pendingFocus, updateSlide]);


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
        <div className="@container mb-2.5 flex h-[18px] items-center justify-between gap-2 text-[12px]">
          <span className={cn("flex min-w-0 items-center gap-1 font-medium tabular-nums transition-colors", selected ? "text-ink" : "text-ink-3")}>
            <span className="stage-n" data-on={selected || undefined}>{index + 1}</span>
            <span className={cn("ml-1 truncate font-normal", selected ? "text-ink" : "text-ink-3")}>{kindName}</span>
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
          <div className="-mr-[5px] flex shrink-0 items-center gap-0.5">
            {index === 0 && slide.kind === "cover" && <CoversDialog />}
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              {...attributes}
              aria-label={`Arrastar o card ${index + 1}`}
              className="grid size-6 cursor-grab touch-none place-items-center rounded-[7px] text-ink-3 opacity-60 transition-opacity hover:bg-white/[0.08] hover:text-ink hover:opacity-100 active:cursor-grabbing"
            >
              <Icon icon={DragDropVerticalIcon} className="size-3.5" />
            </button>
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
                  <button onClick={() => duplicateSlide(slide.id)} className="grid size-6 place-items-center rounded-[7px] text-ink-3 hover:bg-white/[0.08] hover:text-ink" aria-label="Duplicar card">
                    <Icon icon={Copy01Icon} className="size-3.5" />
                  </button>
                </Tip>
                {total > 1 && (
                  <Tip label="Excluir">
                    <button onClick={() => removeSlide(slide.id)} className="grid size-6 place-items-center rounded-[7px] text-ink-3 hover:bg-red-500/15 hover:text-red-300" aria-label="Excluir card">
                      <Icon icon={Delete02Icon} className="size-3.5" />
                    </button>
                  </Tip>
                )}
              </span>
            )}
          </div>
        </div>
        <div
          data-stage-card-face={slide.id}
          role="group"
          aria-label={`Card ${index + 1}${selected ? editable ? ", selecionado: clique no texto para editar" : ", selecionado" : ""}`}
          tabIndex={selected ? -1 : 0}
          onClickCapture={(event) => {
            if (event.shiftKey || event.metaKey || event.ctrlKey) {
              event.preventDefault();
              event.stopPropagation();
              (document.activeElement as HTMLElement | null)?.blur();
              useEditor.getState().toggleInSelection(slide.id);
            }
          }}
          onPointerDownCapture={(event) => {
            if (event.shiftKey || event.metaKey || event.ctrlKey) { event.preventDefault(); event.stopPropagation(); }
          }}
          onClick={onSelect}
          onKeyDown={(event) => {
            if (!selected && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              onSelect();
            }
          }}
          // Texto, perfil e imagem focada isolam seus gestos. O restante do card sempre pode reordenar.
          onPointerDown={(event) => { if (event.pointerType !== "touch") listeners?.onPointerDown?.(event); }}
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
            "relative block w-full overflow-hidden rounded-[16px] outline-none transition-[box-shadow,transform] duration-200 ease-out",
            selected
              ? "shadow-[0_0_0_1px_rgb(255_255_255/0.16),0_0_0_5px_#050505,0_0_0_7px_#ffffff,0_0_34px_2px_rgb(255_255_255/0.22),0_24px_60px_-20px_rgb(0_0_0/0.9)]"
              : "shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_18px_44px_-24px_rgb(0_0_0/0.9)] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.22),0_18px_44px_-24px_rgb(0_0_0/0.9)] focus-visible:shadow-[0_0_0_2px_rgb(255_255_255/0.5)]",
            "cursor-grab active:cursor-grabbing",
            flashed && !selected && "shadow-[0_0_0_2px_rgb(255_255_255/0.55),0_0_40px_-6px_rgb(255_255_255/0.35)]",
            isDragging && "scale-[1.02] cursor-grabbing shadow-[0_0_0_2px_rgb(255_255_255/0.9),0_40px_80px_-20px_rgb(0_0_0/0.95)]",
            rewriting && !selected && "shadow-[0_0_0_1.5px_rgb(255_106_42/0.7),0_0_34px_-6px_rgb(255_53_0/0.6)]",
            dropping && "shadow-[0_0_0_2px_#ff3500]",
          )}
        >
          <SlideFrame width={width} size={design.size}>
            <SlideCanvas slide={slide} index={index} total={total} design={design} identity={identity} edit={binding} />
          </SlideFrame>
          {guides && <StageGuides size={design.size} />}
          {rewriting && (
            <div className="card-working" role="status">
              <span className="exhibit-beam arrasta-scan" style={{ animationDelay: `${(index % 5) * 0.22}s` }} aria-hidden />
              <span className="seal" data-tone="warn">
                <i aria-hidden />
                reescrevendo
              </span>
            </div>
          )}
          {imaging && (
            <div className="card-imaging" role="status">
              <span className="seal" data-tone="good">
                <i className="animate-pulse" aria-hidden />
                gerando a imagem
              </span>
            </div>
          )}
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
    ? "Este carrossel ainda não tem cards."
    : isIdea
      ? `“${source.brief}”`
      : source.kind === "x"
        ? `Post de @${source.author?.username ?? "alguém"} pronto para virar carrossel.`
        : source.kind === "web"
          ? `“${source.title ?? source.url}” pronto para virar carrossel.`
          : source.kind === "youtube"
            ? `Vídeo “${source.title ?? ""}” pronto para virar carrossel.`
          : `${source.slides.length} cards originais prontos para recriar.`;
  const shots = source?.slides ?? [];
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        className="pane flex w-full max-w-[480px] flex-col gap-3 rounded-[20px] p-5"
      >
        {source ? (
          <>
            <div>
              <p className="mission-kicker">Pronto para começar</p>
              <h2 className="mt-0.5 text-pretty text-[17px] font-semibold leading-snug tracking-[-0.01em]">{what}</h2>
            </div>
            {shots.length > 0 && <Shots shots={shots.map((shot) => shot.src)} reading={false} />}
            <Button variant="lit" size="lg" className="mt-1 w-full" onClick={() => generate(isIdea ? "create" : "remix")}>
              {isIdea ? "Escrever na minha voz" : "Recriar na minha voz"}
              <Icon icon={ArrowRight02Icon} />
            </Button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Comece este carrossel</h2>
              <p className="panel-note mt-1">Cole um link, um texto ou os prints de um carrossel que funcionou. O ChatGPT Work recria na sua voz.</p>
            </div>
            <Launcher compact />
          </>
        )}
        <button type="button" className="chip-key h-9 w-full justify-center" onClick={() => addSlide(null)}>
          Começar com um card em branco
        </button>
      </motion.div>
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
