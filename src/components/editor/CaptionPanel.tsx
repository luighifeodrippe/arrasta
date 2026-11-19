"use client";

import { AiMagicIcon, Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useEditor } from "@/lib/client/editor-store";
import { CAPTION_LIMIT, MAX_HASHTAGS } from "@/lib/review";
import { Section, Textarea } from "../ui/field";
import { useAgent } from "./agent-store";
import { useAgentActions } from "./use-agent-actions";
import { Icon } from "@/components/ui/icon";

/** O feed corta a legenda neste ponto e mostra "mais" (a mesma conta da prévia). */
const FEED_CUT = 100;

export function fullCaption(caption: string, hashtags: string[]) {
  const tags = hashtags.map((t) => `#${t}`).join(" ");
  return [caption.trim(), tags].filter(Boolean).join("\n\n");
}

export function CaptionPanel() {
  const project = useEditor((s) => s.project)!;
  const setCaption = useEditor((s) => s.setCaption);
  const setHashtags = useEditor((s) => s.setHashtags);
  const [tagsDraft, setTagsDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const busy = useAgent((s) => s.running);
  const { edit } = useAgentActions();
  const total = fullCaption(project.caption, project.hashtags).length;

  const copy = async () => {
    await navigator.clipboard.writeText(fullCaption(project.caption, project.hashtags));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const rewrite = () => {
    useEditor.getState().clearSelection();
    void edit("Reescreva a legenda do post pelos cards como estão agora, na minha voz, com chamada final.");
  };
  const text = project.caption.trim();

  return (
    <div>
      <Section
        title="Legenda"
        action={
          <button type="button" className="chip-key" onClick={rewrite} disabled={busy || !project.slides.length}>
            <Icon icon={AiMagicIcon} className="size-3.5" />
            {text ? "Reescrever" : "Escrever"}
          </button>
        }
      >
        <Textarea
          id="caption"
          rows={12}
          value={project.caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="A legenda aparece aqui quando o ChatGPT Work criar o carrossel. Você também pode escrever."
          aria-label="Texto do post"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="seal" data-tone={total > CAPTION_LIMIT ? "warn" : undefined}>
            {total} de {CAPTION_LIMIT}
          </span>
          <button type="button" className="chip-key" onClick={copy} disabled={!text && !project.hashtags.length}>
            <Icon icon={copied ? Tick02Icon : Copy01Icon} className="size-3.5" />
            {copied ? "Copiada" : "Copiar legenda"}
          </button>
        </div>
      </Section>
      {text.length > FEED_CUT && (
        <Section title="O que aparece no feed" note="Antes do “mais”, o Instagram mostra só o começo. É ali que a legenda segura a pessoa.">
          <p className="well rounded-[12px] px-3 py-2.5 text-[13px] leading-relaxed text-ink">
            {text.slice(0, FEED_CUT).trimEnd()}
            <span className="text-ink-3">… mais</span>
          </p>
        </Section>
      )}
      <Section title="Hashtags" action={<span className="seal" data-tone={project.hashtags.length > MAX_HASHTAGS ? "warn" : undefined}>{project.hashtags.length} de {MAX_HASHTAGS}</span>}>
        <Textarea
          id="tags"
          rows={2}
          value={tagsDraft ?? project.hashtags.map((t) => `#${t}`).join(" ")}
          onChange={(e) => setTagsDraft(e.target.value)}
          onBlur={() => {
            if (tagsDraft === null) return;
            setHashtags(
              tagsDraft
                .split(/[\s,]+/)
                .map((t) => t.replace(/^#+/, "").trim())
                .filter(Boolean),
            );
            setTagsDraft(null);
          }}
          placeholder="#ia #marketing"
          aria-label="Hashtags"
        />
      </Section>
    </div>
  );
}
