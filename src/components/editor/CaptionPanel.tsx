"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useEditor } from "@/lib/client/editor-store";
import { Button } from "../ui/button";
import { Label, Section, Textarea } from "../ui/field";
import { Icon } from "@/components/ui/icon";

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
  const total = fullCaption(project.caption, project.hashtags).length;

  const copy = async () => {
    await navigator.clipboard.writeText(fullCaption(project.caption, project.hashtags));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div>
      <Section title="Legenda">
        <div>
          <Label htmlFor="caption" hint={<span className={total > 2200 ? "text-red-300" : undefined}>{total}/2200</span>}>
            Texto do post
          </Label>
          <Textarea
            id="caption"
            rows={12}
            value={project.caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="A legenda aparece aqui depois que o ChatGPT recriar o carrossel. Você também pode escrever."
          />
        </div>
        <div>
          <Label htmlFor="tags">Hashtags</Label>
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
          />
        </div>
        <Button variant="primary" className="w-full" onClick={copy} disabled={!project.caption.trim() && !project.hashtags.length}>
          {copied ? <Icon icon={Tick02Icon} /> : <Icon icon={Copy01Icon} />}
          {copied ? "Copiada" : "Copiar legenda"}
        </Button>
      </Section>
    </div>
  );
}
