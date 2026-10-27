"use client";

import { useStageView } from "./stage-view";
import { useModKey } from "@/lib/client/shortcut";

import { ArrowLeft01Icon, ArrowLeft02Icon, ArrowRight01Icon, BulbIcon, ClosedCaptionIcon, Download04Icon, FileTextIcon, Image02Icon, PaintBoardIcon, PanelLeftCloseIcon, Redo02Icon, Settings02Icon, TextIcon, Undo02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { ScrollArea } from "radix-ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { celebrateFirstCarousel } from "@/lib/client/celebrate";
import { useMediaQuery } from "@/lib/client/use-media";
import { download, exportZip, slideToPng, slugify } from "@/lib/client/export";
import { uploadToSlide } from "@/lib/client/images";
import { slideHeight } from "@/lib/defaults";
import type { Project } from "@/lib/types";
import { ChatGPTAccount } from "../app/ChatGPTAccount";
import { LogoMark } from "../app/Logo";
import { ProfileButton } from "../app/ProfileButton";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Segmented } from "../ui/segmented";
import { Tip } from "../ui/tooltip";
import { useAgent } from "./agent-store";
import { AgentBar } from "./AgentBar";
import { CaptionPanel, fullCaption } from "./CaptionPanel";
import { DesignPanel } from "./DesignPanel";
import { ExportStage } from "./ExportStage";
import { ExportDialog } from "./ExportDialog";
import { ImagesPanel } from "./ImagesPanel";
import { PostGuide, postGuideHidden } from "./PostGuide";
import { PreviewDialog } from "./PreviewDialog";
import { SlidePanel } from "./SlidePanel";
import { SourcePanel } from "./SourcePanel";
import { Stage, ViewControls } from "./Stage";
import { Tour, tourDone } from "./Tour";
import { useAgentActions } from "./use-agent-actions";
import { Icon, type IconData } from "@/components/ui/icon";

type Tab = "slide" | "design" | "imagens" | "legenda" | "original";

const PANEL_KEY = "arrasta:panel-open";

export function Editor({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const project = useEditor((s) => s.project);
  const load = useEditor((s) => s.load);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .project(id)
      .then((p) => alive && load(p))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
      useAgent.getState().stop();
    };
  }, [id, load]);

  useAutosave();
  useShortcuts();
  useAutoStart(params.get("auto"), () => router.replace(`/editor/${id}`));

  if (missing) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-[15px]">Esse carrossel não existe mais.</p>
          <Link href="/" className="mt-3 inline-block text-[14px] text-ink-2 underline underline-offset-4">
            Voltar
          </Link>
        </div>
      </div>
    );
  }
  if (!project || project.id !== id) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ThinkingOrb state="breathing" size={64} theme="dark" aria-label="Carregando" />
      </div>
    );
  }
  return <Workspace />;
}

/** Painel lateral aberto ou fechado; a escolha fica salva neste navegador. */
function usePanelOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(PANEL_KEY) === "0") setOpen(false);
    } catch {
      // Sem armazenamento: o painel começa aberto.
    }
  }, []);
  const update = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(PANEL_KEY, next ? "1" : "0");
    } catch {
      // Sem armazenamento: vale só nesta visita.
    }
  };
  return [open, update];
}

/** Colar uma imagem (⌘V) põe a imagem no slide escolhido. */
function usePasteImage() {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      // Colando texto e imagem juntos dentro de um texto do card, fica só o texto.
      if (target?.closest("[contenteditable=true]") && event.clipboardData?.getData("text/plain").trim()) return;
      event.preventDefault();
      void uploadToSlide(useEditor.getState().selectedId, file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);
}

function Workspace() {
  const project = useEditor((s) => s.project)!;
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [tab, setTab] = useState<Tab>(project.slides.length || !project.source ? "slide" : "original");
  const [panelOpen, setPanelOpen] = usePanelOpen();
  const openSettings = useApp((s) => s.openSettings);
  const [preview, setPreview] = useState(false);
  const [tour, setTour] = useState(false);

  usePasteImage();

  // Primeira vez: confete no primeiro carrossel e um tour curto do editor.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const showTour = () => {
      // Não interrompe configurações, prévia, download ou login abertos durante a espera.
      if (!document.querySelector('[role="dialog"]')) setTour(true);
    };
    if (useEditor.getState().project?.slides.length && !tourDone()) timer = setTimeout(showTour, 900);
    const onGenerated = () => {
      celebrateFirstCarousel();
      if (!tourDone()) timer = setTimeout(showTour, 1600);
    };
    window.addEventListener("arrasta:generated", onGenerated);
    return () => {
      window.removeEventListener("arrasta:generated", onGenerated);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const tabs: { value: Tab; label: string; icon: IconData }[] = [
    { value: "design", label: "Design", icon: PaintBoardIcon },
    { value: "slide", label: "Slide", icon: TextIcon },
    { value: "imagens", label: "Imagens", icon: Image02Icon },
    { value: "legenda", label: "Legenda", icon: ClosedCaptionIcon },
    ...(project.source
      ? [{ value: "original" as const, label: project.source.kind === "idea" ? "Texto" : "Original", icon: project.source.kind === "idea" ? BulbIcon : FileTextIcon }]
      : []),
  ];
  const current = tabs.find((t) => t.value === tab) ?? tabs[1];

  const panel = (
    <>
      {current.value === "slide" && <SlidePanel />}
      {current.value === "design" && <DesignPanel />}
      {current.value === "imagens" && <ImagesPanel />}
      {current.value === "legenda" && <CaptionPanel />}
      {current.value === "original" && <SourcePanel />}
    </>
  );

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
      <TopBar onPreview={() => setPreview(true)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        {desktop && (
          <>
            <nav aria-label="Painéis do editor" className="flex w-[56px] shrink-0 flex-col items-center gap-1.5 border-r border-line bg-panel/60 px-2 py-3">
              {tabs.map((item) => {
                const active = panelOpen && current.value === item.value;
                return (
                  <Tip key={item.value} label={item.label} side="right"><button
                    onClick={() => {
                      if (active) setPanelOpen(false);
                      else {
                        setTab(item.value);
                        setPanelOpen(true);
                      }
                    }}
                    aria-pressed={active}
                    aria-label={item.label}
                    aria-controls="painel-do-editor"
                    className={cn(
                      "grid size-[40px] place-items-center rounded-[10px] transition-colors duration-150",
                      active ? "bg-white/[0.09] text-ink" : "text-ink-3 hover:bg-white/[0.05] hover:text-ink",
                    )}
                  >
                    <Icon icon={item.icon} className="size-5" />
                  </button></Tip>
                );
              })}
              <div className="mt-auto"><Tip label="Ajustes" side="right"><button
                onClick={() => openSettings("perfil")}
                aria-label="Ajustes"
                className="grid size-[40px] place-items-center rounded-[10px] text-ink-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink"
              >
                <Icon icon={Settings02Icon} className="size-5" />
              </button></Tip></div>
            </nav>
            <aside
              id="painel-do-editor"
              aria-label={current.label}
              inert={!panelOpen}
              className="shrink-0 overflow-hidden border-r border-line bg-panel/60 transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ width: panelOpen ? 320 : 0, borderRightWidth: panelOpen ? 1 : 0 }}
            >
              <div className="flex h-full w-[320px] flex-col">
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-line pl-5 pr-2">
                  <h2 className="text-[14px] font-semibold">{current.label}</h2>
                  <Tip label="Fechar o painel">
                    <button onClick={() => setPanelOpen(false)} className="grid size-8 place-items-center rounded-[9px] text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink" aria-label="Fechar o painel">
                      <Icon icon={PanelLeftCloseIcon} className="size-4" />
                    </button>
                  </Tip>
                </div>
                <ScrollArea.Root type="hover" className="min-h-0 flex-1 overflow-hidden">
                  <ScrollArea.Viewport className="size-full">{panel}</ScrollArea.Viewport>
                  <ScrollArea.Scrollbar orientation="vertical" className="flex w-2.5 touch-none select-none p-[3px] transition-opacity duration-150 data-[state=hidden]:opacity-0">
                    <ScrollArea.Thumb className="relative flex-1 rounded-full bg-white/[0.18] transition-colors hover:bg-white/[0.3]" />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>
              </div>
            </aside>
          </>
        )}

        <main className="relative h-[60dvh] min-w-0 shrink-0 overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1">
          <Stage onDownload={(ids) => window.dispatchEvent(new CustomEvent("arrasta:download-selection", { detail: ids }))} />
          <AgentBar />
          {desktop && (
            // Puxador na borda do painel, como no Canva: abre e fecha sem precisar adivinhar.
            <Tip label={panelOpen ? "Esconder o painel" : `Mostrar o painel (${current.label})`} side="right">
              <button
                onClick={() => setPanelOpen(!panelOpen)}
                aria-label={panelOpen ? "Esconder o painel" : "Mostrar o painel"}
                aria-controls="painel-do-editor"
                aria-expanded={panelOpen}
                className="glass absolute left-0 top-1/2 z-20 grid h-16 w-[18px] -translate-y-1/2 place-items-center rounded-l-none rounded-r-[10px] border-l-0 text-ink-2 transition-[width,color] duration-150 hover:w-[22px] hover:text-ink"
              >
                <Icon icon={panelOpen ? ArrowLeft01Icon : ArrowRight01Icon} className="size-3.5" strokeWidth={2.2} />
              </button>
            </Tip>
          )}
        </main>

        {!desktop && (
          <div className="flex min-h-0 flex-1 flex-col border-t border-line">
            <div className="no-scrollbar overflow-x-auto px-4 pt-3">
              <Segmented label="Painel" size="sm" className="w-full min-w-max" value={current.value} onChange={setTab} options={tabs.map((t) => ({ value: t.value, label: t.label }))} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
          </div>
        )}
      </div>
      <PreviewDialog open={preview} onOpenChange={setPreview} />
      <Tour open={tour} onClose={() => setTour(false)} />
    </div>
  );
}

function TopBar({ onPreview }: { onPreview: () => void }) {
  const modKey = useModKey();
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const setTitle = useEditor((s) => s.setTitle);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const [exporting, setExporting] = useState<{ indices: number[]; project: Project } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [initialSelection, setInitialSelection] = useState<string[] | undefined>();
  useEffect(() => {
    const open = (event: Event) => {
      setInitialSelection((event as CustomEvent<string[]>).detail);
      setExportOpen(true);
    };
    window.addEventListener("arrasta:download-selection", open);
    return () => window.removeEventListener("arrasta:download-selection", open);
  }, []);
  const [postGuide, setPostGuide] = useState(false);
  const [lastExport, setLastExport] = useState({ count: 0, caption: "" });
  const toastId = useRef<string | number | null>(null);
  const hasSlides = project.slides.length > 0;

  const onReady = useCallback(
    async (nodes: HTMLElement[]) => {
      const current = exporting;
      if (!current) return;
      const snapshot = current.project;
      try {
        if (current.indices.length === 1) {
          const blob = await slideToPng(nodes[0]);
          download(blob, `${slugify(snapshot.title)}-${String(current.indices[0] + 1).padStart(2, "0")}.png`);
          toast.success("Slide baixado", { id: toastId.current ?? undefined });
        } else {
          await exportZip(nodes, snapshot.title, fullCaption(snapshot.caption, snapshot.hashtags), (done, total) =>
            toast.loading(`Gerando ${done}/${total} slides…`, { id: toastId.current ?? undefined }),
            current.indices,
          );
          toast.success(`${nodes.length} slides baixados em 1080×${slideHeight(snapshot.design.size)}`, { id: toastId.current ?? undefined });
        }
        setLastExport({ count: current.indices.length, caption: fullCaption(snapshot.caption, snapshot.hashtags) });
        if (!postGuideHidden()) setPostGuide(true);
      } catch (error) {
        toast.error((error as Error).message || "Não consegui exportar.", { id: toastId.current ?? undefined });
      } finally {
        setExporting(null);
      }
    },
    [exporting],
  );

  const startExport = (selection: number[]) => {
    const indices = [...new Set(selection)].filter((index) => Number.isInteger(index) && index >= 0 && index < project.slides.length).sort((a, b) => a - b);
    if (!indices.length || exporting) return;
    setExportOpen(false);
    toastId.current = toast.loading(indices.length > 1 ? "Preparando os slides…" : "Preparando o slide…");
    setExporting({ indices, project: structuredClone(project) });
  };

  return (
    <header className="flex h-[48px] min-w-0 shrink-0 items-center gap-1.5 border-b border-line px-2 sm:px-3">
      <Tip label="Seus carrosséis">
        <Link href="/" className="flex h-8 shrink-0 items-center gap-1 rounded-[9px] px-1 text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink" aria-label="Voltar para o início">
          <Icon icon={ArrowLeft02Icon} className="size-4" />
          <LogoMark size={24} />
        </Link>
      </Tip>
      <input
        value={project.title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 min-w-0 max-w-[340px] flex-1 truncate rounded-[9px] border border-transparent bg-transparent px-2 text-[13px] font-medium outline-none transition-colors hover:border-white/[0.08] focus:border-white/[0.18] focus:bg-white/[0.04]"
        aria-label="Nome do carrossel"
      />
      <div className="ml-1 hidden items-center gap-0.5 sm:flex">
        <Tip label={`Desfazer (${modKey}Z)`}>
          <Button size="icon-sm" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Desfazer">
            <Icon icon={Undo02Icon} />
          </Button>
        </Tip>
        <Tip label={`Refazer (${modKey === "⌘" ? "⇧⌘Z" : "Ctrl+Shift+Z"})`}>
          <Button size="icon-sm" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Refazer">
            <Icon icon={Redo02Icon} />
          </Button>
        </Tip>
      </div>
      {hasSlides && (
        <div className="ml-1 hidden md:block">
          <ViewControls />
        </div>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <ProfileButton compact />
        <ChatGPTAccount compact />
        <Tip label="Prévia"><Button variant="ghost" size="icon-sm" className="h-[32px] w-[32px] sm:w-auto sm:px-3 sm:text-[13px]" aria-label="Prévia" onClick={onPreview} disabled={!hasSlides}>
          <Icon icon={ViewIcon} />
          <span className="hidden sm:inline">Prévia</span>
        </Button></Tip>
        <Tip label="Baixar"><Button data-tour="export" variant="primary" size="icon-sm" className="h-[32px] w-[32px] sm:w-auto sm:px-3 sm:text-[13px]" aria-label="Baixar" onClick={() => { setInitialSelection(undefined); setExportOpen(true); }} disabled={!hasSlides || exporting !== null}>
          <Icon icon={Download04Icon} />
          <span className="hidden sm:inline">Baixar</span>
        </Button></Tip>
      </div>
      <ExportDialog initialSelection={initialSelection} open={exportOpen} onOpenChange={setExportOpen} project={project} selectedId={selectedId} onExport={startExport} />
      {exporting && <ExportStage project={exporting.project} indices={exporting.indices} onReady={onReady} />}
      <PostGuide open={postGuide} onOpenChange={setPostGuide} count={lastExport.count} caption={lastExport.caption} />
    </header>
  );
}

/** Salva após 600 ms; ao sair, envia imediatamente a edição pendente. */
function useAutosave() {
  useEffect(() => {
    let pending: Project | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let leaving: Project | null = null;
    const flush = (keepalive = false) => {
      clearTimeout(timer);
      if (!pending) return;
      const project = pending;
      if (keepalive && leaving === project) return;
      if (keepalive) leaving = project;
      void (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await api.saveProject(project, keepalive);
            if (pending === project) pending = null;
            if (leaving === project) leaving = null;
            return;
          } catch {
            // Não repete uma edição antiga por cima de uma mais recente.
            if (pending !== project) return;
            if (attempt === 1) toast.error("Não consegui salvar. Confira se o Arrasta ainda está rodando.");
          }
        }
        if (leaving === project) leaving = null;
      })();
    };
    // A assinatura recebe até a edição feita imediatamente antes de desmontar.
    const unsubscribe = useEditor.subscribe((state, previous) => {
      if (state.project?.id !== previous.project?.id) flush();
      if (!state.project || state.revision === 0 || state.revision === previous.revision) return;
      pending = state.project;
      clearTimeout(timer);
      timer = setTimeout(() => flush(), 600);
    });
    const leave = () => flush(true);
    window.addEventListener("pagehide", leave);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, [contenteditable=true]");
      const mod = e.metaKey || e.ctrlKey;
      if (e.defaultPrevented || target.closest('[role="dialog"]')) return;
      if (!typing) {
        if (e.key === "Escape") useEditor.getState().clearSelection();
        if (mod && e.key.toLowerCase() === "a") {
          e.preventDefault();
          useEditor.getState().setSelection(useEditor.getState().project?.slides.map((slide) => slide.id) ?? []);
          return;
        }
        if (mod && ["=", "+", "-", "0"].includes(e.key)) {
          e.preventDefault();
          const view = useStageView.getState();
          if (e.key === "0") view.fit();
          else if (e.key === "-") view.zoomOut();
          else view.zoomIn();
          return;
        }
      }
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) useEditor.getState().redo();
        else useEditor.getState().undo();
        return;
      }
      // Setas usadas por um controle (slider, abas, menus) ou dentro de uma janela não trocam de slide.
      if (typing || mod || e.defaultPrevented || target.closest('[role="dialog"], [role="slider"], [role="radiogroup"], [role="menu"], [role="toolbar"], [role="listbox"]')) return;
      const { project, selectedId, select } = useEditor.getState();
      if (!project) return;
      const index = project.slides.findIndex((s) => s.id === selectedId);
      if (e.key === "ArrowRight" && index < project.slides.length - 1) select(project.slides[index + 1].id);
      if (e.key === "ArrowLeft" && index > 0) select(project.slides[index - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Vindo da home com um link ou ideia, já começa a trabalhar (ou espera o login). */
function useAutoStart(auto: string | null, clear: () => void) {
  const project = useEditor((s) => s.project);
  const connected = useApp((s) => s.auth?.connected);
  const authLoaded = useApp((s) => s.auth !== null);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const { generate } = useAgentActions();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !project || !authLoaded) return;
    if (auto !== "remix" && auto !== "create") return;
    if (project.slides.length) {
      started.current = true;
      clear();
      return;
    }
    if (!connected) {
      setLoginOpen(true);
      return;
    }
    started.current = true;
    clear();
    void generate(auto);
  }, [auto, project, connected, authLoaded, generate, clear, setLoginOpen]);
}
