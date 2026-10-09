"use client";

import { ArrowLeft02Icon, ArrowRight02Icon, Moon02Icon, Sun03Icon, TextAlignCenterIcon, TextAlignJustifyLeftIcon, TextAlignLeftIcon, TextAlignRightIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { identityOf, useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { ACCENTS, FONTS, fontVar, makeSlide, SLIDE_SIZES, TEMPLATES } from "@/lib/defaults";
import { SlideCanvas, SlideFrame } from "../slide/SlideCanvas";
import { cn } from "../ui/cn";
import { Section } from "../ui/field";
import { Segmented } from "../ui/segmented";
import { Range } from "../ui/slider";
import { Toggle } from "../ui/switch";
import { Swatches } from "./Swatches";
import { Icon } from "@/components/ui/icon";

const BACKGROUNDS = ["#ffffff", "#f3efe7", "#e8f0ff", "#111111", "#000000", "#1a1033", "#0f2a1d", "#ff3500"];
const DEMO = makeSlide({ id: "demo", kind: "cover", title: "O **gancho** do seu carrossel aparece aqui", body: "E o complemento logo abaixo." });

export function DesignPanel() {
  const project = useEditor((s) => s.project)!;
  const selectedId = useEditor((s) => s.selectedId);
  const setDesign = useEditor((s) => s.setDesign);
  const setTextStyleAll = useEditor((s) => s.setTextStyleAll);
  const profile = useApp((s) => s.profile);
  const design = project.design;
  const index = Math.max(0, project.slides.findIndex((s) => s.id === selectedId));
  const sample = project.slides[index] ?? DEMO;
  const identity = identityOf(profile);
  const [templatePage, setTemplatePage] = useState(() => Math.floor(Math.max(0, TEMPLATES.findIndex((t) => t.id === design.template)) / 3));
  const pageCount = Math.ceil(TEMPLATES.length / 3);

  return (
    <div>
      <Section title="Modelo" action={
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[11px] tabular-nums text-ink-3">{templatePage + 1}/{pageCount}</span>
          <button aria-label="Modelos anteriores" disabled={templatePage === 0} onClick={() => setTemplatePage((page) => page - 1)} className="grid size-[28px] place-items-center rounded-[7px] text-ink-2 hover:bg-white/[0.07] disabled:opacity-30">
            <Icon icon={ArrowLeft02Icon} className="size-[14px]" />
          </button>
          <button aria-label="Próximos modelos" disabled={templatePage === pageCount - 1} onClick={() => setTemplatePage((page) => page + 1)} className="grid size-[28px] place-items-center rounded-[7px] text-ink-2 hover:bg-white/[0.07] disabled:opacity-30">
            <Icon icon={ArrowRight02Icon} className="size-[14px]" />
          </button>
        </div>
      }>
        <div className="grid min-w-0 grid-cols-3 gap-2">
          {TEMPLATES.slice(templatePage * 3, templatePage * 3 + 3).map((t) => {
            const active = design.template === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setDesign({ template: t.id })}
                aria-pressed={active}
                aria-label={`Modelo ${t.name}`}
                title={t.hint}
                className="group min-w-0 text-left"
              >
                <div
                  aria-hidden
                  className={cn(
                    "flex h-[108px] items-center justify-center overflow-hidden rounded-[9px] bg-white/[0.03] p-[4px] transition-shadow duration-200",
                    active ? "shadow-[0_0_0_2px_rgb(255_255_255/0.9)]" : "shadow-[0_0_0_1px_rgb(255_255_255/0.1)] group-hover:shadow-[0_0_0_1px_rgb(255_255_255/0.28)]",
                  )}
                >
                  <SlideFrame size={design.size} style={{ maxWidth: 75, flexShrink: 0 }}>
                    <SlideCanvas slide={sample} index={index} total={Math.max(2, project.slides.length)} design={{ ...design, template: t.id }} identity={identity} />
                  </SlideFrame>
                </div>
                <p className={cn("mt-1.5 truncate text-[11.5px]", active ? "text-ink" : "text-ink-2")}>{t.name}</p>
              </button>
            );
          })}
        </div>
        <Segmented
          label="Tema"
          className="w-full"
          value={design.theme}
          onChange={(theme) => setDesign({ theme, background: null })}
          options={[
            { value: "light", label: "Claro", icon: <Icon icon={Sun03Icon} /> },
            { value: "dark", label: "Escuro", icon: <Icon icon={Moon02Icon} /> },
          ]}
        />
      </Section>

      <Section title="Proporção">
        <Segmented
          label="Proporção do slide"
          className="w-full"
          value={design.size}
          onChange={(size) => setDesign({ size })}
          options={SLIDE_SIZES.map((option) => ({ value: option.id, label: option.id }))}
        />
        <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-3">{SLIDE_SIZES.find((o) => o.id === design.size)?.hint}.</p>
      </Section>

      <Section title="Fonte">
        <div className="grid grid-cols-3 gap-2">
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => setDesign({ font: f.id, titleFont: null, bodyFont: null })}
              aria-pressed={design.font === f.id}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-0.5 rounded-[12px] border transition-colors",
                design.font === f.id ? "selected text-ink" : "border-white/[0.08] text-ink-2 hover:border-white/[0.16] hover:text-ink",
              )}
            >
              <span style={{ fontFamily: fontVar(f.id), fontWeight: f.weight, fontSize: 22, lineHeight: 1 }}>Aa</span>
              <span className="max-w-full truncate px-1 text-[11px]">{f.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Cores">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[12.5px] text-ink-2">Destaque</p>
            <Swatches value={design.accent} onChange={(accent) => setDesign({ accent: accent ?? "#ff3500" })} colors={ACCENTS} label="Cor de destaque" />
          </div>
          {design.template !== "foto" && (
            <div>
              <p className="mb-2 text-[12.5px] text-ink-2">Fundo</p>
              <Swatches value={design.background} onChange={(background) => setDesign({ background })} colors={BACKGROUNDS} allowDefault label="Cor de fundo" />
            </div>
          )}
        </div>
      </Section>

      <Section title="Texto">
        <Range
          label="Tamanho"
          value={design.textScale}
          min={0.8}
          max={1.3}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(textScale) => setDesign({ textScale })}
        />
        <Segmented
          label="Alinhamento de todos os slides"
          className="w-full"
          value={design.align}
          onChange={(align) => {
            setTextStyleAll(["title", "body"], { align: null });
            setDesign({ align });
          }}
          options={[
            { value: "left", label: <span className="sr-only">Esquerda</span>, icon: <Icon icon={TextAlignLeftIcon} /> },
            { value: "center", label: <span className="sr-only">Centro</span>, icon: <Icon icon={TextAlignCenterIcon} /> },
            { value: "right", label: <span className="sr-only">Direita</span>, icon: <Icon icon={TextAlignRightIcon} /> },
            { value: "justify", label: <span className="sr-only">Justificado</span>, icon: <Icon icon={TextAlignJustifyLeftIcon} /> },
          ]}
        />
      </Section>

      <Section title="Mostrar">
        <div className="-my-1 flex flex-col">
          <Toggle label="Sua foto e @" checked={design.showProfile} onChange={(showProfile) => setDesign({ showProfile })} />
          <Toggle label="Número do slide" checked={design.showCounter} onChange={(showCounter) => setDesign({ showCounter })} />
          <Toggle label="“Arrasta pro lado” na capa" checked={design.showSwipe} onChange={(showSwipe) => setDesign({ showSwipe })} />
        </div>
      </Section>
    </div>
  );
}
