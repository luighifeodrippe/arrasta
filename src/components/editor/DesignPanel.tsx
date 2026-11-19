"use client";

import { Moon02Icon, Sun03Icon, TextAlignCenterIcon, TextAlignJustifyLeftIcon, TextAlignLeftIcon, TextAlignRightIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { identityOf, useApp } from "@/lib/client/app-store";
import { useEditor } from "@/lib/client/editor-store";
import { ACCENTS, effectiveFont, fontChoice, FONTS, fontVar, makeSlide, MANCHETE_STYLES, NICHE_PALETTES, SLIDE_SIZES, TEMPLATES } from "@/lib/defaults";
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

  return (
    <div>
      <Section title="Modelo" note="Vale para todos os cards. Para mudar um card só, use a barra em cima dele.">
        <div className="grid min-w-0 grid-cols-3 gap-x-2 gap-y-2.5">
          {TEMPLATES.map((t) => {
            const active = design.template === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setDesign(t.id === "manchete" ? { template: t.id, theme: "dark" } : { template: t.id })}
                aria-pressed={active}
                aria-label={`Modelo ${t.name}`}
                title={t.hint}
                className="group/model min-w-0 text-left"
              >
                <div
                  aria-hidden
                  className={cn(
                    "well flex h-[112px] items-center justify-center overflow-hidden rounded-[10px] p-[5px] transition-shadow duration-200",
                    active ? "shadow-[0_0_0_2px_rgb(255_255_255/0.92)]" : "group-hover/model:shadow-[inset_0_1px_2px_rgb(0_0_0/0.5),0_0_0_1px_rgb(255_255_255/0.28)]",
                  )}
                >
                  <SlideFrame size={design.size} style={{ maxWidth: 74, flexShrink: 0 }}>
                    <SlideCanvas slide={sample} index={index} total={Math.max(2, project.slides.length)} design={{ ...design, template: t.id }} identity={identity} />
                  </SlideFrame>
                </div>
                <p className={cn("mt-1.5 truncate text-[12px] font-medium", active ? "text-ink" : "text-ink-2")}>{t.name}</p>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Aparência">
        <Row label="Tema">
          <Segmented
            label="Tema"
            size="sm"
            className="w-full"
            value={design.theme}
            onChange={(theme) => setDesign({ theme, background: null })}
            options={[
              { value: "light", label: "Claro", icon: <Icon icon={Sun03Icon} /> },
              { value: "dark", label: "Escuro", icon: <Icon icon={Moon02Icon} /> },
            ]}
          />
        </Row>
        <Row label="Proporção">
          <Segmented
            label="Proporção do card"
            size="sm"
            className="w-full"
            value={design.size}
            onChange={(size) => setDesign({ size })}
            options={SLIDE_SIZES.map((option) => ({ value: option.id, label: option.id }))}
          />
        </Row>
        <p className="panel-note">{SLIDE_SIZES.find((o) => o.id === design.size)?.hint}.</p>
        {design.template === "manchete" && (
          <>
            <Segmented
              label="Estilo do modelo"
              size="sm"
              className="w-full"
              value={design.style}
              onChange={(style) => setDesign({ style, titleFont: null, bodyFont: null })}
              options={MANCHETE_STYLES.map((option) => ({ value: option.id, label: option.name }))}
            />
            <p className="panel-note">{MANCHETE_STYLES.find((option) => option.id === design.style)?.hint}.</p>
          </>
        )}
      </Section>

      <Section title="Fonte">
        <div className="grid grid-cols-3 gap-2">
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => setDesign(fontChoice(design, f.id))}
              aria-pressed={effectiveFont(design, "title") === f.id}
              className={cn(
                "flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[11px] border transition-colors",
                effectiveFont(design, "title") === f.id ? "selected text-ink" : "border-transparent bg-black/20 text-ink-2 hover:bg-white/[0.06] hover:text-ink",
              )}
            >
              <span style={{ fontFamily: fontVar(f.id), fontWeight: f.weight, fontSize: 20, lineHeight: 1 }}>Aa</span>
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
          {design.template === "manchete" && (
            <div>
              <p className="mb-2 text-[12.5px] text-ink-2">Cores por nicho</p>
              <div className="flex flex-wrap gap-1.5">
                {NICHE_PALETTES.map((palette) => {
                  const active = design.surfaces?.dark === palette.dark && design.accent === palette.accent;
                  return (
                    <button
                      key={palette.id}
                      aria-pressed={active}
                      onClick={() => setDesign(active ? { surfaces: null } : { accent: palette.accent, surfaces: { light: palette.light, dark: palette.dark } })}
                      className={cn("flex h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors", active ? "selected text-ink" : "control text-ink-2 hover:text-ink")}
                    >
                      <span aria-hidden className="size-3 rounded-full" style={{ background: palette.accent }} />
                      {palette.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
          label="Tamanho do texto"
          value={design.textScale}
          min={0.8}
          max={1.3}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(textScale) => setDesign({ textScale })}
        />
        <Segmented
          label="Alinhamento de todos os cards"
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
          <Toggle label="Número do card" checked={design.showCounter} onChange={(showCounter) => setDesign({ showCounter })} />
          <Toggle label="“Arrasta pro lado” na capa" checked={design.showSwipe} onChange={(showSwipe) => setDesign({ showSwipe })} />
        </div>
      </Section>
    </div>
  );
}

/** Uma linha de ajuste: o nome à esquerda, o controle ocupando o resto. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      {children}
    </div>
  );
}
