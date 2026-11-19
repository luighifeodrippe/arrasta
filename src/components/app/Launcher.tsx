"use client";

import { ArrowRight02Icon, BulbIcon, ImageAdd02Icon, Link04Icon, Upload04Icon } from "@hugeicons/core-free-icons";
import { useEffect, useId, useRef, useState } from "react";
import { useNewCarousel } from "@/lib/client/new-carousel";
import { REMIX_LEVELS } from "@/lib/defaults";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Icon } from "../ui/icon";
import { Segmented } from "../ui/segmented";
import { FormatPicker } from "./FormatPicker";

export function Launcher({ autoFocus, compact }: { autoFocus?: boolean; compact?: boolean }) {
  const {
    mode, setMode, link, setLink, idea, setIdea, files, setFiles,
    level, setLevel, setFormat, busy, error, ready, showFormats, chosenFormat, submit,
  } = useNewCarousel();
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const printsRef = useRef<HTMLButtonElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const errorId = useId();
  const hintId = useId();

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    if (!autoFocus) return;
    const input = mode === "link" ? linkRef.current : mode === "idea" ? ideaRef.current : printsRef.current;
    input?.focus();
  }, [autoFocus, mode]);

  const chooseFiles = (images: File[]) => {
    const chosen = images.filter((file) => file.type.startsWith("image/")).slice(0, 12);
    if (chosen.length) setFiles(chosen);
  };

  return (
    <form
      className={cn("flex min-w-0 flex-col", compact ? "gap-3" : "gap-5")}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onPaste={(event) => {
        if (mode !== "prints") return;
        const images = Array.from(event.clipboardData.items)
          .filter((item) => item.type.startsWith("image/"))
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null);
        if (images.length) {
          event.preventDefault();
          chooseFiles([...files, ...images]);
        }
      }}
    >
      <Segmented
        label="Como começar"
        value={mode}
        onChange={setMode}
        options={[
          { value: "link", label: "Link", icon: <Icon icon={Link04Icon} /> },
          { value: "idea", label: "Texto", icon: <Icon icon={BulbIcon} /> },
          { value: "prints", label: "Prints", icon: <Icon icon={ImageAdd02Icon} /> },
        ]}
      />
      {mode === "link" && (
        <label className="field flex h-11 min-w-0 items-center gap-2.5 px-3">
          <Icon icon={Link04Icon} className="size-[18px] shrink-0 text-ink-3" />
          <span className="sr-only">Link do conteúdo</span>
          <input
            ref={linkRef}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="Cole um link: Instagram, YouTube, X ou qualquer site"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
            inputMode="url"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
      )}
      {mode === "idea" && (
        <label className="min-w-0">
          <span className="sr-only">Texto ou ideia do carrossel</span>
          <textarea
            ref={ideaRef}
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={4}
            placeholder="Cole um texto ou escreva a ideia"
            className="field block w-full resize-y px-3 py-2.5 text-sm"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
      )}
      {mode === "prints" && (
        <button
          ref={printsRef}
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFiles(Array.from(event.dataTransfer.files));
          }}
          aria-label="Escolha, arraste ou cole os prints"
          aria-describedby={error ? errorId : undefined}
          className="well flex h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-[14px] px-3 text-[13px] text-ink-2 hover:text-ink"
        >
          {previews.length ? (
            <span className="flex w-full shrink-0 gap-2 overflow-x-auto">
              {previews.map((url, index) => (
                // Miniaturas locais, sem passar pelo otimizador de imagens.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={`Print ${index + 1}`} className="size-12 shrink-0 rounded-[10px] object-cover outline outline-1 -outline-offset-1 outline-white/10" />
              ))}
            </span>
          ) : <Icon icon={Upload04Icon} className="size-5" />}
          <span role="status" className="shrink-0">
            {files.length ? `${files.length} ${files.length === 1 ? "imagem escolhida" : "imagens escolhidas"}` : "Escolha, arraste ou cole os prints"}
          </span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          chooseFiles(Array.from(event.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
          event.target.value = "";
        }}
      />
      {showFormats && <FormatPicker value={chosenFormat} onChange={setFormat} align="start" />}
      {mode !== "idea" && (
        <div className={cn("glass-flat rounded-[16px]", compact ? "space-y-2 p-3" : "space-y-3 p-4")}>
          <div className="flex flex-wrap items-center justify-between gap-2" aria-describedby={hintId}>
            <span className="text-[13px] font-semibold text-ink-2">Quanto mudar</span>
            <Segmented
              label="Quanto mudar"
              size="sm"
              value={level}
              onChange={setLevel}
              options={REMIX_LEVELS.map((item) => ({ value: item.id, label: item.name }))}
            />
          </div>
          <p id={hintId} className="panel-note">{REMIX_LEVELS.find((item) => item.id === level)?.hint}</p>
        </div>
      )}
      {error && <p id={errorId} role="alert" className="text-[13px] text-red-300">{error}</p>}
      <Button type="submit" variant="lit" size="md" className="w-full" disabled={!ready || busy} aria-busy={busy}>
        {mode === "idea" ? "Criar na minha voz" : "Recriar na minha voz"}
        <Icon icon={ArrowRight02Icon} />
      </Button>
    </form>
  );
}
