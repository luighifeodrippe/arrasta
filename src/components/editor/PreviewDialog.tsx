"use client";

import { ArrowLeft01Icon, ArrowRight01Icon, Bookmark02Icon, BubbleChatIcon, Cancel01Icon, FavouriteIcon, MoreHorizontalIcon, SentIcon } from "@hugeicons/core-free-icons";
import { Dialog as D, Tabs as T } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { identityOf, useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { SLIDE_W, slideHeight } from "@/lib/defaults";
import { SlideCanvas, SlideFrame } from "../slide/SlideCanvas";
import { cn } from "../ui/cn";
import { fullCaption } from "./CaptionPanel";
import { Icon } from "@/components/ui/icon";
import { CarouselTips } from "./PostGuide";

type Surface = "feed" | "story" | "explore" | "reels";
const SURFACES: { id: Surface; name: string; hint: string }[] = [
  { id: "feed", name: "Feed", hint: "Confira a leitura do card inteiro e a sequência ao arrastar." },
  { id: "story", name: "Story", hint: "Repost em uma tela 9:16. No Instagram, você pode mover e redimensionar o post." },
  { id: "explore", name: "Explorar", hint: "Teste a leitura da miniatura. O recorte e a composição da grade podem variar." },
  { id: "reels", name: "Reels", hint: "Prévia 9:16. O download é PNG, sem música. Carrosséis com música podem aparecer em Reels; a distribuição depende do Instagram." },
];

function Dots({ total, current }: { total: number; current: number }) {
  if (total < 2) return null;
  const start = Math.min(Math.max(0, current - 2), Math.max(0, total - 5));
  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1" aria-hidden>
      {Array.from({ length: Math.min(total, 5) }, (_, k) => {
        const i = start + k;
        const edge = (k === 0 && start > 0) || (k === 4 && start + 5 < total);
        return <span key={i} className={cn("rounded-full", i === current ? "bg-[#0095f6]" : "bg-white/30", edge ? "size-1" : "size-1.5")} />;
      })}
    </div>
  );
}

/** Margens editoriais aproximadas; não são uma garantia de recorte ou distribuição. */
function SafeArea({ surface }: { surface: Surface }) {
  const inset = surface === "story" ? "14% 6% 20%" : surface === "reels" ? "14% 17% 32% 6%" : "6%";
  return (
    <div className="pointer-events-none absolute z-10 border border-dashed border-emerald-300/90" style={{ inset }} aria-hidden>
      {surface !== "explore" && <span className="absolute left-1 top-1 max-w-[calc(100%-8px)] rounded bg-black/80 px-1.5 py-1 text-[10px] leading-tight text-emerald-200">
        {surface === "feed" ? "Margem sugerida" : "Área livre aproximada"}
      </span>}
    </div>
  );
}

export function PreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const project = useEditor((s) => s.project)!;
  const profile = useApp((s) => s.profile);
  const identity = identityOf(profile);
  const [surface, setSurface] = useState<Surface>("feed");
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [safe, setSafe] = useState(false);
  const [squareCrop, setSquareCrop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const total = project.slides.length;
  const selected = Math.min(current, Math.max(0, total - 1));
  const slide = project.slides[selected];
  const handle = identity.handle || "seuperfil";
  const caption = fullCaption(project.caption, project.hashtags);

  useEffect(() => {
    if (open) {
      setCurrent(0);
      setExpanded(false);
      setSurface("feed");
    }
  }, [open]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (surface === "feed" && scrollRef.current) {
      scrollRef.current.scrollLeft = selected * scrollRef.current.clientWidth;
    }
  }, [surface]);

  const go = (index: number) => {
    const next = Math.max(0, Math.min(total - 1, index));
    if (surface === "feed" && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTo({ left: next * el.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    } else setCurrent(next);
  };

  const avatar = identity.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={identity.avatar} alt="" className="size-7 shrink-0 rounded-full object-cover" />
  ) : <span className="size-7 shrink-0 rounded-full bg-white/20" />;

  const card = slide ? <SlideFrame size={project.design.size}><SlideCanvas slide={slide} index={selected} total={total} design={project.design} identity={identity} /></SlideFrame> : null;

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="arrasta-veil fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <D.Content className="arrasta-dialog glass fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[22px] text-ink outline-none">
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div>
              <D.Title className="text-[15px] font-semibold">Prévia no Instagram</D.Title>
              <D.Description className="mt-1 text-[12px] text-ink-2">Simulação para revisar leitura, recortes e sobreposições.</D.Description>
            </div>
            <D.Close className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-white/[0.07] hover:text-ink" aria-label="Fechar prévia"><Icon icon={Cancel01Icon} className="size-[18px]" /></D.Close>
          </div>
          <T.Root value={surface} onValueChange={(value) => setSurface(value as Surface)} className="flex min-h-0 flex-col">
            <T.List aria-label="Local da publicação" className="mx-5 grid shrink-0 grid-cols-4 gap-1 rounded-xl bg-white/[0.05] p-1">
              {SURFACES.map((item) => <T.Trigger key={item.id} value={item.id} className="rounded-lg px-1 py-2 text-[12px] font-medium text-ink-2 hover:text-ink data-[state=active]:bg-white/[0.12] data-[state=active]:text-ink">{item.name}</T.Trigger>)}
            </T.List>
            <div ref={bodyRef} className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain px-5 pb-4">
              <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2 text-[12px] text-ink-2">
                <label className="flex min-h-7 cursor-pointer items-center gap-2"><input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} className="size-3.5 accent-[var(--accent)]" />Mostrar áreas de segurança</label>
                {surface === "explore" && <label className="flex items-center gap-1.5">Recorte<select aria-label="Recorte da miniatura" value={squareCrop ? "1:1" : "3:4"} onChange={(e) => setSquareCrop(e.target.value === "1:1")} className="rounded-md border border-line bg-panel px-1.5 py-1 text-ink"><option value="3:4">3:4</option><option value="1:1">1:1</option></select></label>}
              </div>
              <div className="relative grid place-items-center overflow-hidden rounded-xl bg-black/25" style={{ height: "min(540px, max(250px, calc(100dvh - 330px)))", containerType: "size" }}>
                {surface === "feed" && <T.Content value="feed" className="overflow-hidden rounded-lg bg-black text-white" style={{ width: `min(360px, 100cqw, calc((100cqh - 145px) * ${SLIDE_W / slideHeight(project.design.size)}))` }}>
                  <div className="flex h-11 items-center gap-2 px-3 text-[12px]">{avatar}<span className="min-w-0 truncate font-semibold">{handle}</span><Icon icon={MoreHorizontalIcon} className="ml-auto size-5 shrink-0" /></div>
                  <div className="relative">
                    <div ref={scrollRef} tabIndex={0} aria-label="Cards do carrossel. Use as setas para navegar." onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go(selected + (e.key === "ArrowRight" ? 1 : -1)); } }} onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
                      {project.slides.map((item, index) => <div key={item.id} className="w-full shrink-0 snap-center"><SlideFrame size={project.design.size}><SlideCanvas slide={item} index={index} total={total} design={project.design} identity={identity} /></SlideFrame></div>)}
                    </div>
                    <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] tabular-nums">{selected + 1}/{total}</span>
                    {safe && <SafeArea surface="feed" />}
                  </div>
                  <div className="relative flex h-9 items-center gap-3 px-3" aria-hidden><Icon icon={FavouriteIcon} className="size-[18px]" /><Icon icon={BubbleChatIcon} className="size-[18px] -scale-x-100" /><Icon icon={SentIcon} className="size-[18px]" /><Dots total={total} current={selected} /><Icon icon={Bookmark02Icon} className="ml-auto size-[18px]" /></div>
                  {caption && <div className="max-h-20 overflow-y-auto overscroll-contain px-3 pb-3 text-[11px] leading-[1.4]"><span className="font-semibold">{handle}</span>{" "}{expanded || caption.length <= 100 ? caption : <>{caption.slice(0, 100).trimEnd()}… <button type="button" onClick={() => setExpanded(true)} className="text-white/65 underline underline-offset-2">mais</button></>}</div>}
                </T.Content>}
                {surface === "story" && <T.Content value="story" className="relative grid aspect-[9/16] place-items-center overflow-hidden rounded-xl bg-[#272026] text-white" style={{ width: "min(100cqw, calc(100cqh * 9 / 16))" }}>
                  <div className="absolute inset-x-3 top-2 h-0.5 rounded bg-white/50" aria-hidden />
                  <div className="absolute inset-x-3 top-4 flex items-center gap-2 text-[11px]">{avatar}<span className="truncate font-semibold">{handle}</span><span className="text-white/60">agora</span><Icon icon={MoreHorizontalIcon} className="ml-auto size-4" /></div>
                  <div className="w-[80%] overflow-hidden rounded-lg bg-white p-1 text-center text-black">{card}<div className="py-1.5 text-[11px] font-semibold">@{handle.replace(/^@/, "")}</div></div>
                  <div className="absolute inset-x-3 bottom-4 flex items-center gap-3 text-white/75" aria-hidden><span className="min-w-0 flex-1 rounded-full border border-white/40 px-3 py-2 text-[11px]">Enviar mensagem</span><Icon icon={FavouriteIcon} className="size-5" /><Icon icon={SentIcon} className="size-5" /></div>
                  {safe && <SafeArea surface="story" />}
                </T.Content>}
                {surface === "explore" && <T.Content value="explore" className="overflow-hidden rounded-lg bg-black text-white" style={{ width: `min(360px, 100cqw, calc(100cqh * ${squareCrop ? 0.85 : 0.67}))` }}>
                  <div className="m-2 rounded-lg bg-white/10 px-3 py-2 text-[12px] text-white/60">Pesquisar</div>
                  <div className="grid grid-cols-3 gap-0.5" aria-label="Grade ilustrativa do Explorar">
                    {Array.from({ length: 9 }, (_, index) => <div key={index} className="relative overflow-hidden" style={{ aspectRatio: squareCrop ? "1" : "3 / 4", background: ["#263a34", "#453a32", "#303344", "#413238", "#141414", "#303e42", "#464231", "#292f3e", "#393331"][index] }}>
                      {index === 4 ? <><div className="absolute inset-x-0 top-1/2 -translate-y-1/2">{card}</div><span className="absolute right-1.5 top-1.5 rounded-sm border border-white/80 bg-black/25 p-0.5 text-[8px]" aria-hidden>▣</span>{safe && <SafeArea surface="explore" />}</> : <div className="absolute inset-[18%] rounded-[40%] bg-white/[0.06]" aria-hidden />}
                    </div>)}
                  </div>
                </T.Content>}
                {surface === "reels" && <T.Content value="reels" className="relative grid aspect-[9/16] place-items-center overflow-hidden rounded-xl bg-black text-white" style={{ width: "min(100cqw, calc(100cqh * 9 / 16))" }}>
                  <div className="w-full">{card}</div>
                  <div className="absolute inset-x-3 top-4 text-[17px] font-semibold">Reels</div>
                  <div className="absolute right-3 bottom-[22%] flex flex-col gap-4" aria-hidden><Icon icon={FavouriteIcon} className="size-6" /><Icon icon={BubbleChatIcon} className="size-6" /><Icon icon={SentIcon} className="size-6" /><Icon icon={MoreHorizontalIcon} className="size-6" /></div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-4 pt-10"><div className="flex items-center gap-2 text-[11px]">{avatar}<span className="truncate font-semibold">{handle}</span></div><p className="mt-2 line-clamp-2 max-w-[85%] text-[11px]">{caption || "A legenda da publicação aparece aqui."}</p><p className="mt-2 text-[10px] text-white/70">♪ Música adicionada no Instagram</p></div>
                  {safe && <SafeArea surface="reels" />}
                </T.Content>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button type="button" onClick={() => go(selected - 1)} disabled={selected === 0} className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-2 hover:bg-white/[0.1] disabled:opacity-30" aria-label="Card anterior"><Icon icon={ArrowLeft01Icon} className="size-4" /></button>
                <span className="text-[12px] tabular-nums text-ink-2" role="status">Card {selected + 1} de {total}</span>
                <button type="button" onClick={() => go(selected + 1)} disabled={selected >= total - 1} className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-2 hover:bg-white/[0.1] disabled:opacity-30" aria-label="Próximo card"><Icon icon={ArrowRight01Icon} className="size-4" /></button>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{SURFACES.find((item) => item.id === surface)?.hint}</p>
              {safe && <p className="mt-1 text-[11px] leading-relaxed text-ink-3">As guias não entram no download. Confira o enquadramento final no Instagram.</p>}
              <details className="mt-4 rounded-xl bg-white/[0.04] px-3 py-2.5"><summary className="cursor-pointer text-[12px] font-medium">Como aproveitar cada card</summary><div className="mt-3"><CarouselTips /></div></details>
            </div>
          </T.Root>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
