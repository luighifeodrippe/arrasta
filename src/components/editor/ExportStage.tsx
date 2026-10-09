"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { identityOf, useApp } from "@/lib/client/app-store";
import type { Project } from "@/lib/types";
import { exportIndices } from "@/lib/client/export-selection";
import { SlideCanvas } from "../slide/SlideCanvas";

/**
 * Renderiza os slides em tamanho real fora da tela, só durante a exportação,
 * e entrega os nós prontos para virar PNG.
 */
export function ExportStage({ project, indices, onReady }: { project: Project; indices: number[]; onReady: (nodes: HTMLElement[]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Um download inteiro usa a mesma versão, mesmo se o editor mudar enquanto gera.
  const [snapshot] = useState(() => ({
    project: structuredClone(project),
    indices: exportIndices(project.slides.length, indices),
    identity: identityOf(useApp.getState().profile),
  }));
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const timer = setTimeout(() => {
      const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-slide-root]") ?? []);
      done.current = true;
      onReady(nodes);
    }, 120);
    return () => clearTimeout(timer);
  }, [onReady]);

  const slides = snapshot.indices.map((index) => ({ slide: snapshot.project.slides[index], index }));
  return createPortal(
    <div ref={ref} aria-hidden style={{ position: "fixed", left: -20000, top: 0, display: "flex", flexDirection: "column", gap: 40, pointerEvents: "none" }}>
      {slides.map(({ slide, index }) => (
        <SlideCanvas key={slide.id} slide={slide} index={index} total={snapshot.project.slides.length} design={snapshot.project.design} identity={snapshot.identity} />
      ))}
    </div>,
    document.body,
  );
}
