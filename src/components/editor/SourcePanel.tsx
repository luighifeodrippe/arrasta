"use client";

import { BubbleChatIcon, FavouriteIcon, Image02Icon, LinkSquare02Icon, PlayIcon, RepeatIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useEditor } from "@/lib/client/editor-store";
import { REMIX_LEVELS } from "@/lib/defaults";
import type { RemixLevel } from "@/lib/types";
import { FormatPicker } from "../app/FormatPicker";
import { Button } from "../ui/button";
import { Input, Label, Section } from "../ui/field";
import { Segmented } from "../ui/segmented";
import { useAgent } from "./agent-store";
import { useAgentActions } from "./use-agent-actions";
import { Icon } from "@/components/ui/icon";

const count = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** "Quanto mudar": o padrão mantém o esqueleto do que viralizou e troca só a superfície. */
function LevelPicker({ value, onChange, keepText }: { value: RemixLevel; onChange: (level: RemixLevel) => void; keepText: boolean }) {
  const levels = REMIX_LEVELS.filter((l) => keepText || l.id !== "manter");
  return (
    <div>
      <Label>Quanto mudar</Label>
      <Segmented label="Quanto mudar" size="sm" className="w-full" value={value} onChange={onChange} options={levels.map((l) => ({ value: l.id, label: l.name }))} />
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{REMIX_LEVELS.find((l) => l.id === value)?.hint}</p>
    </div>
  );
}

export function SourcePanel() {
  const project = useEditor((s) => s.project)!;
  const running = useAgent((s) => s.running);
  const { generate } = useAgentActions();
  const [level, setLevel] = useState<RemixLevel>("pouco");
  const [instructions, setInstructions] = useState("");
  const [formatId, setFormatId] = useState<string | null>(project.source?.formatId ?? null);
  const source = project.source;

  if (!source) {
    return <p className="px-5 py-8 text-[13.5px] leading-relaxed text-ink-3">Este carrossel começou em branco. Use a conversa com o ChatGPT, embaixo do palco, para pedir ajuda.</p>;
  }

  if (source.kind === "idea") {
    return (
      <div>
        <Section title="Texto">
          <p className="text-pretty text-[14px] leading-relaxed text-ink">“{source.brief}”</p>
          <FormatPicker value={formatId} onChange={setFormatId} align="start" />
          <div>
            <Label htmlFor="again">Ajuste para a próxima versão</Label>
            <Input id="again" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex.: mais provocativo, 7 slides" />
          </div>
          <Button variant="primary" className="w-full" disabled={running} onClick={() => generate("create", { instructions, formatId: formatId ?? "" })}>
            <Icon icon={RepeatIcon} />
            Gerar de novo
          </Button>
        </Section>
        <Analysis />
      </div>
    );
  }

  const isLink = source.kind === "x" || source.kind === "web" || source.kind === "youtube";
  const isVideo = source.kind === "youtube";
  const author = source.author;

  return (
    <div>
      <Section title={source.kind === "x" ? "Post do X" : isVideo ? "Vídeo do YouTube" : source.kind === "web" ? "Página" : source.kind === "upload" ? "Prints" : "Original"}>
        {isVideo && source.media[0] && (
          <a href={source.url ?? undefined} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-[12px] border border-white/10" aria-label="Abrir o vídeo no YouTube">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={source.media[0]} alt="" className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
            <span className="absolute inset-0 grid place-items-center bg-black/25">
              <span className="grid size-11 place-items-center rounded-full bg-black/70 backdrop-blur">
                <Icon icon={PlayIcon} className="size-5 fill-white text-white" />
              </span>
            </span>
            {source.duration && (
              <span className="absolute bottom-2 right-2 rounded-[6px] bg-black/75 px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-white">
                {Math.floor(source.duration / 60)}:{String(source.duration % 60).padStart(2, "0")}
              </span>
            )}
          </a>
        )}
        <div className="flex items-center gap-3">
          {author?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatar} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <span className="grid size-10 place-items-center rounded-full bg-white/10 text-[14px] font-semibold text-ink-2">
              {source.kind === "upload" && !author
                ? <Icon icon={Image02Icon} className="size-5" />
                : ((isVideo ? (author?.fullName ?? author?.username) : null) ?? source.site ?? author?.username ?? "?").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{isVideo ? (source.title ?? "Vídeo") : author ? `@${author.username}` : (source.title ?? source.site ?? "Imagens enviadas")}</p>
            <p className="flex items-center gap-3 text-[12.5px] text-ink-3">
              {isVideo && author && <span className="truncate">{author.fullName ?? author.username}</span>}
              {source.site && !author && <span className="truncate">{source.site}</span>}
              {source.likes !== null && (
                <span className="flex items-center gap-1">
                  <Icon icon={FavouriteIcon} className="size-3.5" /> {count.format(source.likes)}
                </span>
              )}
              {source.comments !== null && (
                <span className="flex items-center gap-1">
                  <Icon icon={BubbleChatIcon} className="size-3.5" /> {count.format(source.comments)}
                </span>
              )}
            </p>
          </div>
          {source.url && (
            <a href={source.url} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-[9px] text-ink-2 hover:bg-white/[0.07] hover:text-ink" aria-label="Abrir o original">
              <Icon icon={LinkSquare02Icon} className="size-4" />
            </a>
          )}
        </div>
        {isLink && source.text && (
          <div className="rounded-[12px] bg-white/[0.04] px-3.5 py-3">
            {isVideo && <p className="mb-1 text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-3">Transcrição</p>}
            <p className="line-clamp-6 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-2">
              {isVideo ? (source.text.split("Transcrição do vídeo:\n")[1] ?? source.text) : source.text}
            </p>
          </div>
        )}
      </Section>

      <Analysis />

      <Section title="Recriar de novo">
        <LevelPicker value={level} onChange={setLevel} keepText={!isLink} />
        {isLink && <FormatPicker value={formatId} onChange={setFormatId} align="start" />}
        <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ajuste (opcional): foque em fotógrafos…" aria-label="Ajuste" />
        <Button variant="primary" className="w-full" disabled={running} onClick={() => generate("remix", { level, instructions, formatId: isLink ? (formatId ?? "") : undefined })}>
          <Icon icon={RepeatIcon} />
          {project.slides.length ? "Recriar de novo" : "Recriar na minha voz"}
        </Button>
      </Section>

      {source.slides.length > 0 && (
        <Section title={`Slides originais · ${source.slides.length}`}>
          <div className="flex flex-col gap-3">
            {source.slides.map((s, i) => (
              <div key={s.src} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={`Original ${i + 1}`} className="aspect-[4/5] w-16 shrink-0 rounded-[8px] border border-white/10 object-cover" />
                <p className="line-clamp-5 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-2">{s.text || "Ainda não lido."}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Analysis() {
  const analysis = useEditor((s) => s.project?.source?.analysis);
  if (!analysis) return null;
  return (
    <Section title="Por que funciona">
      <dl className="flex flex-col gap-3 text-[13.5px] leading-relaxed">
        {[
          ["Gancho", analysis.hook],
          ["Estrutura", analysis.structure],
          ["Motivo", analysis.why],
        ].map(([term, text]) => (
          <div key={term}>
            <dt className="text-[12px] text-ink-3">{term}</dt>
            <dd className="text-ink">{text}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
