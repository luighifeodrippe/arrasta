"use client";

import { useStageView } from "./stage-view";
import { useModKey } from "@/lib/client/shortcut";

import { Add01Icon, ArrowLeft02Icon, BulbIcon, ChatGptIcon, CheckListIcon, ClosedCaptionIcon, Download04Icon, FileTextIcon, Image02Icon, PaintBoardIcon, PanelLeftCloseIcon, PanelRightOpenIcon, Redo02Icon, TextIcon, Undo02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { ScrollArea } from "radix-ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/lib/client/api";
import { useLaunch } from "@/lib/client/launch-store";
import { useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { celebrateFirstCarousel } from "@/lib/client/celebrate";
import { useMediaQuery } from "@/lib/client/use-media";
import { download, exportZip, slideToPng, slugify } from "@/lib/client/export";
import { uploadToSlide } from "@/lib/client/images";
import { REMIX_LEVELS, slideHeight } from "@/lib/defaults";
import type { Project, RemixLevel } from "@/lib/types";
import { LogoMark } from "../app/Logo";
import { NewCarouselDialog } from "../app/NewCarouselDialog";
import { ProfileButton } from "../app/ProfileButton";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Segmented } from "../ui/segmented";
import { Tip } from "../ui/tooltip";
import { useAgent } from "./agent-store";
import { AgentBar } from "./AgentBar";
import { CaptionPanel, fullCaption } from "./CaptionPanel";
import { ChatCard } from "./ChatCard";
import { DesignPanel } from "./DesignPanel";
import { ExportStage } from "./ExportStage";
import { ExportDialog } from "./ExportDialog";
import { ImagesPanel } from "./ImagesPanel";
import { PostGuide, postGuideHidden } from "./PostGuide";
import { PreviewDialog } from "./PreviewDialog";
import { ReviewPanel, usePendingReview } from "./ReviewPanel";
import { SlidePanel } from "./SlidePanel";
import { SourcePanel } from "./SourcePanel";
import { Stage, ViewControls } from "./Stage";
import { Tour, tourDone } from "./Tour";
import { useAgentActions } from "./use-agent-actions";
import { Icon, type IconData } from "@/components/ui/icon";

type Tab = "slide" | "design" | "imagens" | "legenda" | "revisao" | "original";

const PANEL_KEY = "arrasta:panel-open";
const CHAT_KEY = "arrasta:chat-open";

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

  // O carrossel abriu: a tela de começo (missão em tela cheia) entrega o trabalho ao palco.
  useEffect(() => {
    if (!missing && project?.id !== id) return;
    const timer = setTimeout(() => useLaunch.getState().clear(), missing ? 0 : 450);
    return () => clearTimeout(timer);
  }, [project?.id, id, missing]);

  useAutosave();
  useShortcuts();
  useAutoStart(params.get("auto"), params.get("level"), () => router.replace(`/editor/${id}`));

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

/** Um painel aberto ou fechado (o das ferramentas, o do ChatGPT); a escolha fica salva neste navegador. */
function usePanelOpen(key: string): [boolean, (open: boolean) => void] {
  // O editor só monta no navegador, depois de carregar o projeto: dá para ler a escolha já no primeiro quadro.
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== "0";
    } catch {
      return true; // Sem armazenamento: o painel começa aberto.
    }
  });
  const update = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
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
  const [panelOpen, setPanelOpen] = usePanelOpen(PANEL_KEY);
  // Com espaço na tela, o ChatGPT fica num cartão ao lado do palco; sem espaço, na barra de baixo.
  const roomy = useMediaQuery("(min-width: 1200px)");
  const [chatOpen, setChatOpen] = usePanelOpen(CHAT_KEY);
  const chatDocked = roomy && chatOpen;
  // Em tela menor cabe um painel por vez ao lado do palco: o ChatGPT fica e o das ferramentas espera.
  const both = useMediaQuery("(min-width: 1560px)");
  const panelShown = panelOpen && (both || !chatDocked);
  // Sem a barra de pedidos embaixo do palco, os cards ganham essa altura (antes de pintar, para não pular).
  useLayoutEffect(() => {
    useStageView.setState({ barSpace: chatDocked ? 16 : 112 });
  }, [chatDocked]);
  // Sem lugar para os dois, abrir um fecha o outro, e fechar as ferramentas devolve o ChatGPT.
  const openPanel = (open: boolean) => {
    setPanelOpen(open);
    if (!both) setChatOpen(!open);
  };
  const openChat = (open: boolean) => {
    setChatOpen(open);
    if (open && !both) setPanelOpen(false);
  };
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

  const profile = useApp((s) => s.profile);
  const pending = usePendingReview();
  const sourceIsText = project.source?.kind === "idea";
  // Na ordem do caminho: o texto, a cara, as imagens, a legenda, a revisão antes de baixar; a origem fica por último.
  const tabs: { value: Tab; label: string; icon: IconData; count?: number }[] = [
    { value: "slide", label: "Roteiro", icon: TextIcon },
    { value: "design", label: "Design", icon: PaintBoardIcon },
    { value: "imagens", label: "Imagens", icon: Image02Icon },
    { value: "legenda", label: "Legenda", icon: ClosedCaptionIcon },
    ...(project.slides.length ? [{ value: "revisao" as const, label: "Revisão", icon: CheckListIcon, count: pending }] : []),
    ...(project.source ? [{ value: "original" as const, label: "Origem", icon: sourceIsText ? BulbIcon : FileTextIcon }] : []),
  ];
  const current = tabs.find((t) => t.value === tab) ?? tabs[0];
  const openTab = (value: Tab) => {
    setTab(value);
    openPanel(true);
  };

  const panel = (
    <>
      {current.value === "slide" && <SlidePanel />}
      {current.value === "design" && <DesignPanel />}
      {current.value === "imagens" && <ImagesPanel />}
      {current.value === "legenda" && <CaptionPanel />}
      {current.value === "revisao" && <ReviewPanel onOpen={openTab} />}
      {current.value === "original" && <SourcePanel />}
    </>
  );

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden lg:flex-row lg:gap-2 lg:p-2">
      {desktop && (
        <div className="pane flex shrink-0 overflow-hidden rounded-[18px]">
          <nav aria-label="Painéis do editor" className="rail">
            {tabs.map((item) => {
              const active = panelShown && current.value === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => (active ? openPanel(false) : openTab(item.value))}
                  aria-pressed={active}
                  aria-controls="painel-do-editor"
                  className="rail-tab"
                >
                  <Icon icon={item.icon} className="size-5" />
                  {item.label}
                  {item.count ? <span className="rail-count" aria-label={`${item.count} para ajustar`}>{item.count}</span> : null}
                </button>
              );
            })}
            <button onClick={() => openSettings("perfil")} className="rail-tab mt-auto" aria-label="Ajustes: perfil, voz e escrita">
              {profile?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar} alt="" />
              ) : (
                <span className="rail-face">{(profile?.name || "?").charAt(0).toUpperCase()}</span>
              )}
              Ajustes
            </button>
          </nav>
          <aside
            id="painel-do-editor"
            aria-label={current.label}
            inert={!panelShown}
            className="shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
            style={{ width: panelShown ? 320 : 0 }}
          >
            <div className="flex h-full w-[320px] flex-col border-l border-white/[0.06]">
              <div className="flex h-[52px] shrink-0 items-center justify-between pl-[22px] pr-3.5">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{current.label}</h2>
                <Tip label="Fechar o painel">
                  <button onClick={() => openPanel(false)} className="work-act" aria-label="Fechar o painel">
                    <Icon icon={PanelLeftCloseIcon} className="size-4" />
                  </button>
                </Tip>
              </div>
              <ScrollArea.Root type="hover" className="min-h-0 flex-1 overflow-hidden">
                <ScrollArea.Viewport className="size-full">
                  <div key={current.value} className="panel-in">{panel}</div>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar orientation="vertical" className="flex w-2 touch-none select-none p-[2px] transition-opacity duration-150 data-[state=hidden]:opacity-0">
                  <ScrollArea.Thumb className="relative flex-1 rounded-full bg-white/[0.18] transition-colors hover:bg-white/[0.3]" />
                </ScrollArea.Scrollbar>
              </ScrollArea.Root>
            </div>
          </aside>
        </div>
      )}

      <main className={cn("flex h-[62dvh] min-w-0 shrink-0 flex-col overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1", desktop && "pane rounded-[18px]")}>
        <StageHead onPreview={() => setPreview(true)} desktop={desktop} />
        <div className={cn("relative min-h-0 flex-1 overflow-hidden", desktop ? "stage-well mx-2 mb-2 rounded-[12px]" : "border-t border-line")}>
          <Stage onDownload={(ids) => window.dispatchEvent(new CustomEvent("arrasta:download-selection", { detail: ids }))} />
          {!chatDocked && <AgentBar />}
        </div>
      </main>

      {chatDocked && <ChatCard onClose={() => openChat(false)} />}
      {roomy && !chatOpen && (
        <Tip label="Abrir o ChatGPT Work" side="left">
          <button onClick={() => openChat(true)} className="work-tab pane" aria-label="Abrir o ChatGPT Work" aria-expanded={false}>
            <span className="work-head__mark">
              <Icon icon={ChatGptIcon} className="size-4" />
            </span>
            <span className="work-tab__name">ChatGPT Work</span>
            <Icon icon={PanelRightOpenIcon} className="mt-auto size-4" />
          </button>
        </Tip>
      )}

      {!desktop && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-line">
          <div className="no-scrollbar overflow-x-auto px-4 pt-3">
            <Segmented label="Painel" size="sm" className="w-full min-w-max" value={current.value} onChange={setTab} options={tabs.map((t) => ({ value: t.value, label: t.count ? `${t.label} · ${t.count}` : t.label }))} />
          </div>
          <div key={current.value} className="panel-in min-h-0 flex-1 overflow-y-auto pt-1">{panel}</div>
        </div>
      )}
      <PreviewDialog open={preview} onOpenChange={setPreview} />
      <Tour open={tour} onClose={() => setTour(false)} />
    </div>
  );
}

/** O nome do carrossel e o que se faz com ele (desfazer, ver, prévia, baixar), em cima dos cards. */
function StageHead({ onPreview, desktop }: { onPreview: () => void; desktop: boolean }) {
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
      setInitialSelection((event as CustomEvent<string[] | undefined>).detail);
      setExportOpen(true);
    };
    window.addEventListener("arrasta:download-selection", open);
    return () => window.removeEventListener("arrasta:download-selection", open);
  }, []);
  const [postGuide, setPostGuide] = useState(false);
  const [lastExport, setLastExport] = useState({ count: 0, caption: "" });
  const toastId = useRef<string | number | null>(null);
  const hasSlides = project.slides.length > 0;
  const [newOpen, setNewOpen] = useState(false);
  const working = useAgent((s) => s.running);

  const onReady = useCallback(
    async (nodes: HTMLElement[]) => {
      const current = exporting;
      if (!current) return;
      const snapshot = current.project;
      try {
        if (current.indices.length === 1) {
          const blob = await slideToPng(nodes[0]);
          download(blob, `${slugify(snapshot.title)}-${String(current.indices[0] + 1).padStart(2, "0")}.png`);
          toast.success("Card baixado", { id: toastId.current ?? undefined });
        } else {
          await exportZip(nodes, snapshot.title, fullCaption(snapshot.caption, snapshot.hashtags), (done, total) =>
            toast.loading(`Gerando ${done}/${total} cards…`, { id: toastId.current ?? undefined }),
            current.indices,
          );
          toast.success(`${nodes.length} cards baixados em 1080×${slideHeight(snapshot.design.size)}`, { id: toastId.current ?? undefined });
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
    toastId.current = toast.loading(indices.length > 1 ? "Preparando os cards…" : "Preparando o card…");
    setExporting({ indices, project: structuredClone(project) });
  };

  return (
    <header className="stage-head @container">
      <Tip label="Seus carrosséis">
        <Link href="/" className="flex h-9 shrink-0 items-center gap-1 rounded-[10px] px-1.5 text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink" aria-label="Voltar para o início">
          <Icon icon={ArrowLeft02Icon} className="size-4" />
          <LogoMark size={24} />
        </Link>
      </Tip>
      <Tip label="Novo carrossel: de um link, de um texto ou de prints">
        <button type="button" className="chip-key" onClick={() => setNewOpen(true)} disabled={working} aria-label="Novo carrossel">
          <Icon icon={Add01Icon} className="size-3.5" />
          <span className="hidden @[820px]:inline">Novo</span>
        </button>
      </Tip>
      <NewCarouselDialog open={newOpen} onOpenChange={setNewOpen} />
      <input
        value={project.title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-9 min-w-0 max-w-[320px] flex-1 truncate rounded-[10px] border border-transparent bg-transparent px-2 text-[14px] font-semibold tracking-[-0.01em] outline-none transition-colors hover:bg-white/[0.04] focus:bg-black/30 focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]"
        aria-label="Nome do carrossel"
      />
      <div className="hidden shrink-0 items-center gap-0.5 @[460px]:flex">
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
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {hasSlides && (
          <div className="hidden @[720px]:block">
            <ViewControls />
          </div>
        )}
        {!desktop && <ProfileButton compact />}
        <Tip label="Ver como fica no Instagram">
          <Button variant="glass" size="sm" className="w-9 px-0 @[560px]:w-auto @[560px]:px-3" aria-label="Prévia" onClick={onPreview} disabled={!hasSlides}>
            <Icon icon={ViewIcon} />
            <span className="hidden @[560px]:inline">Prévia</span>
          </Button>
        </Tip>
        <Button data-tour="export" variant="lit" size="sm" className="w-9 px-0 @[560px]:w-auto @[560px]:px-3.5" aria-label="Baixar" onClick={() => { setInitialSelection(undefined); setExportOpen(true); }} disabled={!hasSlides || exporting !== null}>
          <Icon icon={Download04Icon} />
          <span className="hidden @[560px]:inline">Baixar</span>
        </Button>
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
function useAutoStart(auto: string | null, level: string | null, clear: () => void) {
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
    void generate(auto, auto === "remix" && REMIX_LEVELS.some((item) => item.id === level) ? { level: level as RemixLevel } : {});
  }, [auto, level, project, connected, authLoaded, generate, clear, setLoginOpen]);
}
