"use client";

import { AiMagicIcon, Delete02Icon, Upload04Icon } from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { useEditor } from "@/lib/client/editor-store";
import { IMAGE_DRAG_TYPE, imageLibrary, placeImage, uploadImages } from "@/lib/client/images";
import { cn } from "../ui/cn";
import { Section } from "../ui/field";
import { useAgent } from "./agent-store";
import { useAgentActions } from "./use-agent-actions";
import { Icon } from "@/components/ui/icon";

/**
 * O lugar das imagens: gerar a do card escolhido com o ChatGPT Work, enviar as suas e reusar qualquer uma, com um
 * clique ou arrastando para um card.
 */
export function ImagesPanel() {
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const updateSlide = useEditor((s) => s.updateSlide);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [idea, setIdea] = useState("");
  const { picture } = useAgentActions();
  const { uploads, original } = imageLibrary(project);
  const generated = uploads.filter((src) => src.includes("/gerada-"));
  const sent = uploads.filter((src) => !src.includes("/gerada-"));
  const index = project.slides.findIndex((s) => s.id === selectedId);
  const slide = project.slides[index];
  const current = slide?.image?.src ?? null;
  const imaging = useAgent((state) => (slide ? state.imaging.includes(slide.id) : false));
  const where = index >= 0 ? `no card ${index + 1}` : "no card escolhido";

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    await uploadImages(files);
    setBusy(false);
  };

  return (
    <div>
      {slide && (
        <Section
          title={`Imagem do card ${index + 1}`}
          action={
            current ? (
              <button type="button" className="chip-key" onClick={() => updateSlide(slide.id, { image: null })}>
                <Icon icon={Delete02Icon} className="size-3.5" />
                Tirar
              </button>
            ) : undefined
          }
        >
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void picture([{ id: slide.id, idea: idea.trim() || undefined }]);
            }}
          >
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              rows={2}
              placeholder={slide.imageIdea || "Diga a cena, ou deixe em branco para o ChatGPT Work decidir pelo texto do card"}
              aria-label="Que imagem gerar"
              className="field min-h-[60px] resize-none px-3 py-2 text-[13px] leading-snug"
            />
            <button type="submit" disabled={imaging} className="chip-key h-9 justify-center">
              <Icon icon={AiMagicIcon} className="size-4" />
              {imaging ? "Gerando a imagem…" : current ? "Gerar outra com o ChatGPT Work" : "Gerar com o ChatGPT Work"}
            </button>
          </form>
        </Section>
      )}

      <Section title="Suas imagens" note={`Clique para pôr ${where}, ou arraste para qualquer card.`}>
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload(Array.from(e.dataTransfer.files));
          }}
          disabled={busy}
          className={cn(
            "well flex h-[72px] items-center justify-center gap-2 rounded-[12px] text-[13px] font-medium transition-[color,box-shadow] disabled:opacity-60",
            over ? "text-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.5)]" : "text-ink-2 hover:text-ink hover:shadow-[inset_0_1px_2px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(255_255_255/0.16)]",
          )}
        >
          <Icon icon={Upload04Icon} className="size-[18px]" />
          {busy ? "Enviando…" : "Enviar ou soltar imagens"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void upload(files);
          }}
        />
        {sent.length > 0 && <Grid images={sent} current={current} onPick={(src) => placeImage(selectedId, src)} />}
      </Section>
      {generated.length > 0 && (
        <Section title="Geradas pelo ChatGPT Work">
          <Grid images={generated} current={current} onPick={(src) => placeImage(selectedId, src)} />
        </Section>
      )}
      {original.length > 0 && (
        <Section title="Do post original" note="Os prints que serviram de base. Use como referência.">
          <Grid images={original} current={current} onPick={(src) => placeImage(selectedId, src)} />
        </Section>
      )}
    </div>
  );
}

function Grid({ images, current, onPick }: { images: string[]; current: string | null; onPick: (src: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((src, i) => (
        <button
          key={src}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(IMAGE_DRAG_TYPE, src);
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onPick(src)}
          aria-label={`Usar a imagem ${i + 1}`}
          className={cn(
            "relative overflow-hidden rounded-[10px] transition-shadow duration-150",
            current === src ? "shadow-[0_0_0_2px_rgb(255_255_255/0.92)]" : "shadow-[0_0_0_1px_rgb(255_255_255/0.1)] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.36)]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} className="aspect-square w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
