"use client";

import { BorderBeam } from "border-beam";
import { ArrowRight02Icon, BulbIcon, Delete02Icon, ImageAdd02Icon, Link04Icon, MoreHorizontalIcon, Upload04Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion } from "motion/react";
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
import { GooeyTabs } from "../ui/gooey-tabs";
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
  const [mode, setMode] = useState<Mode>("link");
  const [link, setLink] = useState("");
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [formatId, setFormatId] = useState<string | null>(null);
  const [formatPicked, setFormatPicked] = useState(false);
  const profile = useApp((s) => s.profile);
  const connected = useApp((s) => s.auth?.connected ?? false);
  const setLoginOpen = useApp((s) => s.setLoginOpen);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const pending = useRef(false);

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

  const focusLink = () => {
    setMode("link");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => linkRef.current?.focus(), 250);
  };

  const blank = async () => {
    const project = await api.createProject({ kind: "blank" });
    router.push(`/editor/${project.id}`);
  };

  const remove = async (id: string) => {
    await api.deleteProject(id);
    setProjects((list) => list?.filter((p) => p.id !== id) ?? null);
    toast("Carrossel excluído");
  };

  const identity = identityOf(profile);

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-70"
        style={{ background: "radial-gradient(60% 55% at 50% 0%, rgb(255 255 255 / 0.07), transparent 70%)" }}
      />
      <header className="relative z-10 mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-7">
        <Logo />
        <div className="flex items-center gap-2">
          <ProfileButton />
          <ChatGPTAccount />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1200px] px-4 pb-24 sm:px-7">
        <section className="mx-auto flex max-w-[760px] flex-col items-center pt-[clamp(40px,11vh,120px)] text-center">
          <span className="glass-flat mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12.5px] text-ink-2">
            <span className="size-1.5 rounded-full bg-brand" />
            Open source · roda no seu computador
          </span>
          <h1 className="text-balance text-[clamp(36px,5.6vw,60px)] font-semibold leading-[1.02] tracking-[-0.035em]">
            {["Sua ideia vira carrossel.", "Na sua voz."].map((part, i) => (
              <motion.span
                key={part}
                initial={{ opacity: 0, filter: "blur(10px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.05 + i * 0.18 }}
                className={i ? "text-ink-3" : undefined}
              >
                {part}
                {i === 0 ? " " : ""}
              </motion.span>
            ))}
          </h1>
          <p className="mt-5 max-w-[560px] text-pretty text-[clamp(15px,1.6vw,17px)] leading-relaxed text-ink-2">
            Comece com uma ideia, prints ou um link acessível. O ChatGPT organiza o conteúdo e escreve no seu estilo. Você dá o acabamento.
          </p>
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
            <strong className="font-medium text-ink">Sua conta do ChatGPT. Sem cobrança de API.</strong>
            <span className="mt-1 block text-[12.5px] text-ink-3">Sem chave de API. O uso segue os limites do Codex na sua conta.</span>
          </p>

          <GooeyTabs
            label="Como começar"
            className="mt-9"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: "link", label: "Link", icon: <Icon icon={Link04Icon} /> },
              { value: "idea", label: "Ideia", icon: <Icon icon={BulbIcon} /> },
              { value: "prints", label: "Prints", icon: <Icon icon={ImageAdd02Icon} /> },
            ]}
          />

          <div className="mt-4 w-full">
            <BorderBeam
              size={busy ? "line" : "pulse-outside"}
              colorVariant="mono"
              theme="dark"
              active={busy || (!ready && mode === "link")}
              className="w-full rounded-[22px]"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
                className="glass flex w-full flex-col gap-2 rounded-[22px] p-2 sm:flex-row sm:items-center"
              >
                {mode === "link" && (
                  <label className="flex h-14 min-w-0 flex-1 items-center gap-3 pl-4 pr-2">
                    <Icon icon={Link04Icon} className="size-5 shrink-0 text-ink-3" />
                    <input
                      ref={linkRef}
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="Cole um link: Instagram, YouTube, X ou qualquer site"
                      className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
                      autoFocus
                      inputMode="url"
                      aria-label="Link do conteúdo"
                    />
                  </label>
                )}
                {mode === "idea" && (
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
                    }}
                    rows={3}
                    placeholder="Sobre o que é o carrossel? Ex.: 5 erros de quem começa a usar IA no trabalho"
                    className="min-h-[96px] min-w-0 flex-1 resize-none bg-transparent px-4 py-3.5 text-left text-[16px] leading-relaxed outline-none placeholder:text-ink-3"
                    aria-label="Ideia do carrossel"
                    autoFocus
                  />
                )}
                {mode === "prints" && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      setFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
                    }}
                    className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-[16px] pl-4 pr-2 text-left text-[15px] text-ink-2 transition-colors hover:text-ink"
                  >
                    <Icon icon={Upload04Icon} className="size-5 shrink-0 text-ink-3" />
                    <span className="truncate">
                      {files.length ? `${files.length} ${files.length === 1 ? "imagem escolhida" : "imagens escolhidas"}` : "Escolha ou arraste os prints dos slides, na ordem"}
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
                <Button type="submit" variant="primary" size="lg" className="h-12 shrink-0 rounded-[15px] px-5 sm:self-center" disabled={!ready || busy}>
                  {busy ? (
                    <>
                      <ThinkingOrb state="searching" size={20} theme="light" aria-hidden />
                      {mode === "link" ? "Abrindo o post" : "Preparando"}
                    </>
                  ) : (
                    <>
                      {mode === "idea" ? "Criar" : "Recriar"}
                      <Icon icon={ArrowRight02Icon} />
                    </>
                  )}
                </Button>
              </form>
            </BorderBeam>
            <AnimatePresence initial={false}>
              {showFormats && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                  className="overflow-hidden"
                >
                  <FormatPicker
                    value={chosenFormat}
                    onChange={(id) => {
                      setFormatId(id);
                      setFormatPicked(true);
                    }}
                    className="mt-3"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            {error ? (
              <p role="alert" className="mt-3 text-[13.5px] text-red-300">
                {error}
              </p>
            ) : (
              <p className="mt-3 text-[13px] text-ink-3">
                {mode === "link"
                  ? "Instagram público, YouTube com legenda, X e artigos, quando a fonte permite a leitura. Projetos salvos neste computador."
                  : mode === "idea"
                    ? "O ChatGPT escreve de 6 a 9 slides na sua voz."
                    : "Para posts privados ou de outras redes: envie os prints e o ChatGPT lê o texto."}
                {" "}
                <button onClick={blank} className="text-ink-2 underline decoration-white/20 underline-offset-4 transition-colors hover:text-ink">
                  Começar em branco
                </button>
              </p>
            )}
          </div>

          <Onboarding hasProjects={Boolean(projects?.length)} onPaste={focusLink} />
        </section>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.25 }}
          className="mt-14"
        >
          <Showcase />
        </motion.div>

        <ContentBank />

        {projects && projects.length > 0 ? (
          <section className="mt-16">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Seus carrosséis</h2>
              <span className="text-[13px] text-ink-3">{projects.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {projects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} identity={identity} onOpen={() => router.push(`/editor/${project.id}`)} onDelete={() => remove(project.id)} />
              ))}
            </div>
          </section>
        ) : projects ? (
          <HowItWorks />
        ) : null}
      </main>
    </div>
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
  onDelete: () => void;
}) {
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
              "absolute inset-x-0 top-0 overflow-hidden rounded-[14px] border border-white/[0.08] bg-raised shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)] transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
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
        <div className="relative overflow-hidden rounded-[14px] border border-white/[0.08] bg-raised shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)] transition-[transform,border-color] duration-300 ease-out group-hover:-translate-y-1 group-hover:border-white/[0.16]">
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
        <p className="mt-2.5 truncate text-[13.5px] font-medium text-ink">{project.title}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">{ago(project.updatedAt)}</p>
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className={cn(
              "absolute right-2 top-2 grid size-8 place-items-center rounded-[9px] bg-black/60 text-ink opacity-0 backdrop-blur transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100",
            )}
            aria-label="Mais opções"
          >
            <Icon icon={MoreHorizontalIcon} className="size-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="arrasta-pop glass z-50 min-w-[160px] rounded-[14px] p-1.5 text-ink">
            <DropdownMenu.Item
              onSelect={onDelete}
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

function HowItWorks() {
  const steps = [
    { n: "1", title: "Cole o link", text: "Um carrossel que viralizou, um post do X ou um artigo que você queria ter escrito." },
    { n: "2", title: "O ChatGPT trabalha", text: "Lê tudo, mantém a estrutura que funciona e reescreve na sua voz." },
    { n: "3", title: "Edite e poste", text: "Ajuste o design, peça mudanças e baixe os PNGs em 1080×1440." },
  ];
  return (
    <section className="mx-auto mt-16 grid max-w-[920px] grid-cols-1 gap-3 sm:grid-cols-3">
      {steps.map((s) => (
        <div key={s.n} className="glass-flat rounded-[18px] p-5">
          <span className="text-[12px] font-semibold tabular-nums text-ink-3">{s.n}</span>
          <p className="mt-3 text-[15px] font-medium">{s.title}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{s.text}</p>
        </div>
      ))}
    </section>
  );
}
