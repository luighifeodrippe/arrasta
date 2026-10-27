"use client";

import { ArrowRight02Icon, BulbIcon, Delete02Icon, ImageAdd02Icon, Link04Icon, MoreHorizontalIcon, PlusSignIcon, Upload04Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/lib/client/api";
import { identityOf, useApp } from "@/lib/client/app-store";
import { SLIDE_W, slideHeight } from "@/lib/defaults";
import type { Project } from "@/lib/types";
import { ChatGPTAccount } from "../app/ChatGPTAccount";
import { FormatPicker } from "../app/FormatPicker";
import { Logo } from "../app/Logo";
import { ProfileButton } from "../app/ProfileButton";
import { SlideCanvas, SlideFrame } from "../slide/SlideCanvas";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Dialog, DialogContent } from "../ui/dialog";
import { Segmented } from "../ui/segmented";
import { Onboarding } from "./Onboarding";
import { Showcase } from "./Showcase";
import { ContentBank } from "./ContentBank";
import { Icon } from "@/components/ui/icon";

type Mode = "link" | "idea" | "prints";

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
function ago(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  for (const [limit, unit] of steps) {
    if (Math.abs(diff) < limit) {
      const size = unit === "second" ? 1 : unit === "minute" ? 60 : unit === "hour" ? 3600 : unit === "day" ? 86400 : unit === "week" ? 604800 : 2629800;
      return relative.format(Math.round(diff / size), unit);
    }
  }
  return relative.format(Math.round(diff / 31557600), "year");
}

export function Home() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("link");
  const [link, setLink] = useState("");
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [removing, setRemoving] = useState(false);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const [formatId, setFormatId] = useState<string | null>(null);
  const [formatPicked, setFormatPicked] = useState(false);
  const profile = useApp((s) => s.profile);
  const connected = useApp((s) => s.auth?.connected ?? false);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const printsRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("arrasta:home-mode");
      if (saved === "link" || saved === "idea" || saved === "prints") setMode(saved);
    } catch {
      // Sem armazenamento: começa em Link.
    }
  }, []);

  useEffect(() => {
    api.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const ready = mode === "link" ? link.trim().length > 0 : mode === "idea" ? idea.trim().length > 0 : files.length > 0;

  // Formatos servem para ideias e para links que não são carrossel do Instagram (esses seguem o original).
  const isInstagram = /instagram\.com|instagr\.am/i.test(link);
  const showFormats = mode === "idea" || (mode === "link" && link.trim().length > 0 && !isInstagram);
  // Vídeo vira história: o Storytelling já vem escolhido, até a pessoa trocar.
  const isVideo = mode === "link" && /youtube\.com|youtu\.be/i.test(link);
  const chosenFormat = formatPicked ? formatId : isVideo ? "storytelling" : formatId;

  const submit = async () => {
    if (!ready || busy) return;
    // Sem ChatGPT conectado: entra primeiro e continua sozinho depois do login.
    if (!connected) {
      pending.current = true;
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const chosen = showFormats ? chosenFormat : null;
      const project =
        mode === "link"
          ? await api.createProject({ kind: "link", url: link.trim(), formatId: chosen })
          : mode === "idea"
            ? await api.createProject({ kind: "idea", brief: idea.trim(), formatId: chosen })
            : await api.createFromImages(files);
      router.push(`/editor/${project.id}?auto=${mode === "idea" ? "create" : "remix"}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (connected && pending.current) {
      pending.current = false;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const focusInput = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      const input = mode === "link" ? linkRef.current : mode === "idea" ? ideaRef.current : printsRef.current;
      input?.focus();
    }, 250);
  };

  const blank = async () => {
    const project = await api.createProject({ kind: "blank" });
    router.push(`/editor/${project.id}`);
  };

  const remove = async (id: string) => {
    if (removing) return;
    setRemoving(true);
    try {
      await api.deleteProject(id);
      setProjects((list) => list?.filter((p) => p.id !== id) ?? null);
      setDeleting(null);
      toast("Carrossel excluído");
    } catch {
      toast.error("Não consegui excluir. Tente de novo.");
    } finally {
      setRemoving(false);
    }
  };

  const identity = identityOf(profile);

  return (
    <div className="home min-h-dvh overflow-x-clip">
      <header className="home-header">
        <div className="home-shell flex h-full items-center justify-between gap-2">
          <Logo />
          <div className="flex shrink-0 items-center gap-2">
            <ProfileButton />
            <ChatGPTAccount />
          </div>
        </div>
      </header>

      <main className="home-shell">
        <section className="home-opening" aria-labelledby="home-heading">
          <h1 id="home-heading" className="titulo home-heading">
            {["Sua ideia vira carrossel.", "Na sua voz."].map((part, i) => (
              <motion.span
                key={part}
                initial={reducedMotion ? false : { opacity: 0, filter: "blur(10px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.05 + i * 0.18 }}
                className="block"
              >
                <span className={i ? "quente" : undefined}>{part}</span>
              </motion.span>
            ))}
          </h1>
          <div className="home-opening-grid">
            <div className="home-composer">
              <p className="home-intro">
                <span>Comece com uma ideia, um texto, prints ou um link.</span>{" "}
                O ChatGPT escreve no seu estilo, com a sua conta e sem chave nem cobrança de API.
              </p>
              <Segmented
                label="Como começar"
                appearance="pill"
                className="mt-10"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  try {
                    localStorage.setItem("arrasta:home-mode", m);
                  } catch {
                    // Sem armazenamento: a aba vale só nesta visita.
                  }
                  setError(null);
                }}
                options={[
                  { value: "link", label: "Link", icon: <Icon icon={Link04Icon} /> },
                  { value: "idea", label: "Texto", icon: <Icon icon={BulbIcon} /> },
                  { value: "prints", label: "Prints", icon: <Icon icon={ImageAdd02Icon} /> },
                ]}
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
                className={cn("home-field", mode === "idea" && "home-field-text")}
              >
                {mode === "link" && (
                  <label className="home-field-source">
                    <Icon icon={Link04Icon} className="size-[18px] shrink-0 text-ink-3" />
                    <span className="relative flex h-full min-w-0 flex-1 items-center">
                      {!link && <span aria-hidden className="home-link-example pointer-events-none absolute inset-x-0 truncate text-ink-3">Cole um link: Instagram, YouTube, X ou qualquer site</span>}
                      <input
                        ref={linkRef}
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="Cole um link"
                        className="home-link h-full min-w-0 w-full bg-transparent outline-none placeholder:text-ink-3"
                        autoFocus
                        inputMode="url"
                        aria-label="Link do conteúdo"
                      />
                    </span>
                  </label>
                )}
                {mode === "idea" && (
                  <textarea
                    ref={ideaRef}
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
                    }}
                    rows={4}
                    placeholder="Cole um texto ou escreva a ideia. Ex.: 5 erros de quem começa a usar IA no trabalho"
                    className="home-textarea"
                    aria-label="Texto ou ideia do carrossel"
                    autoFocus
                  />
                )}
                {mode === "prints" && (
                  <button
                    ref={printsRef}
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      setFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
                    }}
                    className="home-field-source rounded-full text-left text-ink-2 transition-colors hover:text-ink"
                  >
                    <Icon icon={Upload04Icon} className="size-[18px] shrink-0 text-ink-3" />
                    <span className="truncate">
                      {files.length ? `${files.length} ${files.length === 1 ? "imagem escolhida" : "imagens escolhidas"}` : <><span className="home-example-full">Escolha ou arraste os prints dos slides, na ordem</span><span className="home-example-short">Escolha os prints</span></>}
                    </span>
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))}
                />
                <Button
                  type="submit" variant="lit" className="home-submit h-10 shrink-0 rounded-full px-4 text-[15px]"
                  disabled={!ready || busy}
                  aria-label={busy ? mode === "link" ? "Abrindo o post" : "Preparando" : mode === "idea" ? "Criar" : "Recriar"}
                  aria-busy={busy}
                >
                  {busy ? (
                    <>
                      <ThinkingOrb state="searching" size={20} theme="dark" aria-hidden />
                      <span className="home-submit-label">{mode === "link" ? "Abrindo o post" : "Preparando"}</span>
                    </>
                  ) : (
                    <>
                      <span className="home-submit-label">{mode === "idea" ? "Criar" : "Recriar"}</span>
                      <Icon icon={ArrowRight02Icon} />
                    </>
                  )}
                </Button>
              </form>
              <AnimatePresence initial={false}>
                {showFormats && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden"
                  >
                    <FormatPicker
                      value={chosenFormat}
                      onChange={(id) => {
                        setFormatId(id);
                        setFormatPicked(true);
                      }}
                      align="start"
                      className="mt-4 pl-5"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="home-note">
                {error ? (
                  <p role="alert" className="text-red-300">{error}</p>
                ) : (
                  <p className="text-ink-3">
                    {mode === "link"
                      ? "Instagram público, YouTube com legenda, X e artigos."
                      : mode === "idea"
                        ? "Ideia curta ou texto longo: vira de 6 a 9 slides na sua voz."
                        : "Posts privados ou de outras redes: o ChatGPT lê os prints."}
                  </p>
                )}
                <button onClick={blank} className="home-blank">
                  <Icon icon={PlusSignIcon} className="size-4" />
                  Começar em branco
                </button>
              </div>
            </div>
            <Onboarding hasProjects={Boolean(projects?.length)} onPaste={focusInput} />
          </div>
        </section>

        {projects && projects.length > 0 ? (
          <section className="home-section" aria-labelledby="projects-heading">
            <div className="home-section-heading flex items-baseline gap-3">
              <h2 id="projects-heading" className="titulo">Seus carrosséis</h2>
              <span className="text-[15px] tabular-nums text-ink-3">{projects.length}</span>
            </div>
            <div className="home-projects">
              {projects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} identity={identity} onOpen={() => router.push(`/editor/${project.id}`)} onDelete={(trigger) => { deleteTrigger.current = trigger; setDeleting(project); }} />
              ))}
            </div>
          </section>
        ) : null}
        {Boolean(projects?.length) && <ContentBank key="content-bank" />}
        <Models key="models" />
        {!projects?.length && <ContentBank key="content-bank" />}
      </main>
      <footer className="home-shell home-footer">
        <p>Código aberto · roda no seu computador. Seus projetos ficam salvos aqui.</p>
      </footer>
      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !removing) setDeleting(null); }}>
        <DialogContent
          title={`Excluir “${deleting?.title ?? ""}”?`}
          description="O carrossel e as imagens dele saem deste computador. Não dá para desfazer."
          hideClose
          onOpenAutoFocus={(event) => { event.preventDefault(); cancelDelete.current?.focus(); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (deleteTrigger.current?.isConnected) deleteTrigger.current.focus();
            else (mode === "link" ? linkRef.current : mode === "idea" ? ideaRef.current : printsRef.current)?.focus();
          }}
          footer={<>
            <Button ref={cancelDelete} disabled={removing} onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" disabled={removing} onClick={() => { if (deleting) void remove(deleting.id); }}>Excluir</Button>
          </>}
        >{null}</DialogContent>
      </Dialog>
    </div>
  );
}

function Models() {
  return (
    <section className="home-section" aria-labelledby="models-heading">
      <div className="home-section-heading">
        <h2 id="models-heading" className="titulo">Modelos</h2>
        <p>Os cards já saem com o seu nome e a sua foto.</p>
      </div>
      <Showcase />
    </section>
  );
}

function ProjectCard({
  project,
  index,
  identity,
  onOpen,
  onDelete,
}: {
  project: Project;
  index: number;
  identity: ReturnType<typeof identityOf>;
  onOpen: () => void;
  onDelete: (trigger: HTMLButtonElement | null) => void;
}) {
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const cover = project.slides[0];
  const sourceCover = project.source?.slides[0]?.src ?? project.source?.media[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: Math.min(index, 10) * 0.035 }}
      className="group relative hover:z-10"
    >
      <button onClick={onOpen} className="relative block w-full text-left" aria-label={`Abrir ${project.title}`}>
        {/* Os próximos slides espiam atrás da capa e abrem em leque no hover (ideia do Polaroid Stack da uselayouts, MIT). */}
        {project.slides.slice(1, 3).map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden
            className={cn(
              "absolute inset-x-0 top-0 overflow-hidden rounded-[16px] border border-white/[0.1] bg-raised shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)] transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
              i === 0
                ? "origin-bottom-left rotate-[2.5deg] group-hover:translate-x-[10%] group-hover:rotate-[9deg]"
                : "origin-bottom-right -rotate-[2deg] group-hover:-translate-x-[10%] group-hover:-rotate-[8deg]",
            )}
            style={{ aspectRatio: `${SLIDE_W} / ${slideHeight(project.design.size)}` }}
          >
            <SlideFrame size={project.design.size}>
              <SlideCanvas slide={slide} index={i + 1} total={project.slides.length} design={project.design} identity={identity} />
            </SlideFrame>
          </div>
        ))}
        <div className="relative overflow-hidden rounded-[16px] border border-white/[0.1] bg-raised shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)] transition-[transform,border-color] duration-300 ease-out group-hover:-translate-y-1 group-hover:border-white/[0.16]">
          {cover ? (
            <SlideFrame size={project.design.size}>
              <SlideCanvas slide={cover} index={0} total={project.slides.length} design={project.design} identity={identity} />
            </SlideFrame>
          ) : sourceCover ? (
            <div className="relative aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sourceCover} alt="" className="size-full object-cover opacity-60" />
              <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[11.5px] text-ink-2 backdrop-blur">Não recriado</span>
            </div>
          ) : (
            <div className="grid aspect-[3/4] place-items-center text-[13px] text-ink-3">Vazio</div>
          )}
        </div>
        <p className="mt-3 truncate text-[15px] font-medium text-ink">{project.title}</p>
        <p className="mt-0.5 text-[13px] text-ink-3">{ago(project.updatedAt)}</p>
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            ref={menuTrigger}
            className={cn(
              "home-project-options absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-ink opacity-0 backdrop-blur transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100",
            )}
            aria-label="Mais opções"
          >
            <Icon icon={MoreHorizontalIcon} className="size-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="arrasta-pop glass z-50 min-w-[160px] rounded-[14px] p-1.5 text-ink">
            <DropdownMenu.Item
              onSelect={() => onDelete(menuTrigger.current)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-2.5 text-[13.5px] text-red-300 outline-none data-[highlighted]:bg-red-500/15"
            >
              <Icon icon={Delete02Icon} className="size-4" />
              Excluir
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </motion.div>
  );
}
