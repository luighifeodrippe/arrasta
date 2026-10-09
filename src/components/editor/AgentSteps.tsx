"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/icon";

export type StepState = "done" | "active" | "todo";

/** Passos reais do trabalho do ChatGPT (inspirado no Thinking "Steps" da Beautiful UI, MIT). */
export function AgentSteps({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="flex flex-col gap-2.5" aria-label="Andamento">
      {steps.map((step, i) => (
        <motion.li
          key={step.label}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: i * 0.06 }}
          className="flex items-center gap-2.5 text-[13.5px]"
          aria-current={step.state === "active" ? "step" : undefined}
        >
          <span className="grid size-4 shrink-0 place-items-center">
            {step.state === "done" && (
              <span className="grid size-4 place-items-center rounded-full bg-white/[0.12] text-ink-2">
                <Icon icon={Tick02Icon} className="size-2.5" strokeWidth={3} />
              </span>
            )}
            {step.state === "active" && (
              <span className="size-3.5 rounded-full border-2 border-white/15 border-t-white/80 [animation:arrasta-spin_0.8s_linear_infinite] motion-reduce:[animation:none]" />
            )}
            {step.state === "todo" && <span className="size-1.5 rounded-full bg-white/20" />}
          </span>
          <span className={step.state === "active" ? "arrasta-shimmer-text font-medium" : step.state === "done" ? "text-ink-2" : "text-ink-3"}>{step.label}</span>
        </motion.li>
      ))}
    </ol>
  );
}
