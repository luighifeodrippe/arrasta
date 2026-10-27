"use client";

import { useModKey } from "@/lib/client/shortcut";

import { Upload04Icon } from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { useEditor } from "@/lib/client/editor-store";
import { IMAGE_DRAG_TYPE, imageLibrary, placeImage, uploadImages } from "@/lib/client/images";
import { cn } from "../ui/cn";
import { Section } from "../ui/field";
import { Icon } from "@/components/ui/icon";

/** Biblioteca de imagens do carrossel: envie uma vez e use em qualquer slide, com um clique ou arrastando. */
export function ImagesPanel() {
  const modKey = useModKey();
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const { uploads, original } = imageLibrary(project);
  const index = project.slides.findIndex((s) => s.id === selectedId);
  const current = project.slides[index]?.image?.src ?? null;

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    await uploadImages(files);
    setBusy(false);
  };

  return (
    <div>
      <Section title="Suas imagens">
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
            "flex h-24 flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed text-[13px] transition-colors disabled:opacity-60",
            over ? "border-white/60 bg-white/[0.06] text-ink" : "border-white/[0.16] text-ink-2 hover:border-white/35 hover:text-ink",
          )}
        >
          <Icon icon={Upload04Icon} className="size-5" />
          {busy ? "Enviando…" : "Enviar imagens ou soltar aqui"}
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
        {uploads.length > 0 ? (
          <Grid images={uploads} current={current} onPick={(src) => placeImage(selectedId, src)} />
        ) : (
          <p className="text-[12.5px] leading-relaxed text-ink-3">As imagens que você enviar ficam aqui para usar em qualquer slide.</p>
        )}
      </Section>
      {original.length > 0 && (
        <Section title="Do conteúdo original">
          <Grid images={original} current={current} onPick={(src) => placeImage(selectedId, src)} />
        </Section>
      )}
      <p className="px-5 pb-6 pt-1 text-[12.5px] leading-relaxed text-ink-3">
        Clique numa imagem para pôr no slide {index >= 0 ? index + 1 : "escolhido"}, ou arraste para qualquer card. Também dá para colar uma imagem copiada com {modKey}V.
      </p>
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
            "group relative overflow-hidden rounded-[10px] border transition-[border-color,transform] duration-150 hover:scale-[1.03] active:scale-[0.98]",
            current === src ? "border-white/85" : "border-white/[0.1] hover:border-white/30",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} className="aspect-square w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
