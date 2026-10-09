"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Icon } from "@/components/ui/icon";

const HIDE_KEY = "arrasta:hide-post-guide";

export function postGuideHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Dicas editoriais; distribuição e recortes são decididos pelo Instagram. */
export function CarouselTips() {
  const tips = [
    ["Duas aberturas fortes", "Faça a capa despertar interesse e o segundo card funcionar sozinho. O Instagram pode reapresentar um carrossel a partir da segunda imagem; não há frequência ou alcance garantidos."],
    ["Uma ideia por card", "Entregue a promessa da capa com exemplos e uma sequência clara. Corte o texto que exige zoom no celular."],
    ["Um próximo passo útil", "Feche com uma pergunta específica, um resumo para salvar ou um motivo real para compartilhar."],
    ["Aprenda com seus resultados", "Compare alcance, salvamentos, compartilhamentos e ações no perfil entre posts com objetivos parecidos. Um formato não garante melhor desempenho."],
  ];
  return <div className="space-y-3">
    {tips.map(([title, body]) => <div key={title}><h3 className="text-[12px] font-semibold text-ink">{title}</h3><p className="mt-1 text-[12px] leading-relaxed text-ink-2">{body}</p></div>)}
    <a href="https://www.instagram.com/reel/DBOeUmTSmIC/" target="_blank" rel="noreferrer" className="inline-block text-[11px] text-ink-2 underline underline-offset-2">Explicação do Instagram sobre carrosséis</a>
  </div>;
}

/** Depois do download: como postar no Instagram, com a legenda a um clique. */
export function PostGuide({ open, onOpenChange, count, caption }: { open: boolean; onOpenChange: (open: boolean) => void; count: number; caption: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) setCopied(false); }, [open]);
  const steps = [
    "Abra o Instagram, toque em + e escolha Post.",
    count > 1 ? `Selecione as ${count} imagens na ordem dos nomes dos arquivos. Confira o enquadramento de todos os cards antes de avançar.` : "Selecione a imagem baixada e confira o enquadramento antes de avançar.",
    "Cole a legenda e publique.",
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={count > 1 ? "Seu carrossel está pronto para postar" : "Seu card está pronto para postar"}
        description="Confira o arquivo baixado e publique pelo Instagram."
        className="w-[min(460px,calc(100vw-32px))]"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                try {
                  localStorage.setItem(HIDE_KEY, "1");
                } catch {
                  // ok
                }
                onOpenChange(false);
              }}
            >
              Não mostrar mais
            </Button>
            <Button
              variant="primary"
              disabled={!caption.trim()}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(caption);
                  setCopied(true);
                } catch {
                  toast.error("Não foi possível copiar. Selecione e copie a legenda no editor.");
                }
              }}
            >
              {copied ? <Icon icon={Tick02Icon} /> : <Icon icon={Copy01Icon} />}
              {copied ? "Legenda copiada" : "Copiar legenda"}
            </Button>
          </>
        }
      >
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-[14px] leading-relaxed">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.1] text-[12px] font-semibold tabular-nums">{i + 1}</span>
              <span className="text-ink-2">{step}</span>
            </li>
          ))}
        </ol>
        <details className="mt-5 rounded-xl bg-white/[0.04] px-3 py-3">
          <summary className="cursor-pointer text-[13px] font-medium">Como aproveitar cada card</summary>
          <div className="mt-3"><CarouselTips /></div>
        </details>
      </DialogContent>
    </Dialog>
  );
}
