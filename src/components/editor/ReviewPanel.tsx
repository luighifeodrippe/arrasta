"use client";

import { AiMagicIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { useEditor } from "@/lib/client/editor-store";
import { reviewProject, type ReviewCheck } from "@/lib/review";
import { Section } from "../ui/field";
import { useAgent } from "./agent-store";
import { useAgentActions } from "./use-agent-actions";

/** Quantas linhas da revisão ainda faltam (o número aceso na aba). */
export function usePendingReview() {
  const project = useEditor((s) => s.project);
  return useMemo(() => (project ? reviewProject(project).filter((check) => !check.ok).length : 0), [project]);
}

/**
 * Revisão antes de postar: as réguas que o redator segue, medidas no carrossel como ele está agora. Cada linha
 * que falta tem a tecla que manda o conserto ao ChatGPT Work, valendo só para os cards que ela toca.
 */
export function ReviewPanel({ onOpen }: { onOpen: (tab: "legenda") => void }) {
  const project = useEditor((s) => s.project)!;
  const busy = useAgent((s) => s.running || s.imaging.length > 0);
  const { edit, picture } = useAgentActions();
  const checks = useMemo(() => reviewProject(project), [project]);
  const pending = checks.filter((check) => !check.ok);
  const ready = checks.filter((check) => check.ok);

  if (!checks.length) {
    return (
      <Section title="Revisão">
        <p className="panel-note">Quando o carrossel estiver criado, aqui aparece o que falta antes de postar.</p>
      </Section>
    );
  }

  const fix = (check: ReviewCheck) => {
    const state = useEditor.getState();
    if (check.id === "imagens") return void picture(check.slideIds.map((id) => ({ id })));
    if (check.slideIds.length === 1) state.select(check.slideIds[0]);
    else if (check.slideIds.length > 1) state.setSelection(check.slideIds);
    else state.clearSelection();
    if (check.request) void edit(check.request);
  };
  const show = (check: ReviewCheck) => {
    if (check.slideIds.length) useEditor.getState().select(check.slideIds[0]);
    else onOpen("legenda");
  };

  return (
    <div>
      <Section title="Pronto para postar?">
        <div className="review-score">
          <p className="review-score__number">
            {ready.length}
            <small> de {checks.length}</small>
          </p>
          <div className="review-lights" aria-hidden>
            {checks.map((check) => (
              <i key={check.id} data-on={check.ok ? "" : undefined} />
            ))}
          </div>
        </div>
        <p className="panel-note">{pending.length ? `Falta${pending.length === 1 ? "" : "m"} ${pending.length} ajuste${pending.length === 1 ? "" : "s"} antes de baixar.` : "Tudo certo. É só baixar e postar."}</p>
      </Section>

      {pending.length > 0 && (
        <Section title="Falta">
          <ul className="review-list">
            {pending.map((check) => (
              <li key={check.id} className="review-item" data-pending>
                <i aria-hidden />
                <button type="button" onClick={() => show(check)} className="min-w-0 text-left" aria-label={`Ver: ${check.name}`}>
                  <p className="review-item__name">{check.name}</p>
                  <p className="review-item__detail">{check.detail}</p>
                </button>
                <button type="button" className="chip-key" onClick={() => fix(check)} disabled={busy}>
                  <Icon icon={AiMagicIcon} className="size-3.5" />
                  {check.id === "imagens" ? "Gerar" : "Corrigir"}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {ready.length > 0 && (
        <Section title="Pronto">
          <ul className="review-list">
            {ready.map((check) => (
              <li key={check.id} className="review-item">
                <i aria-hidden />
                <div className="min-w-0">
                  <p className="review-item__name">{check.name}</p>
                  <p className="review-item__detail">{check.detail}</p>
                </div>
                {check.id === "legenda" && (
                  <button type="button" className="chip-key" onClick={() => onOpen("legenda")}>
                    Ver
                    <Icon icon={ArrowRight01Icon} className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
