import type { WriteResult } from "./prompts.ts";

export function isValidReview(result: unknown, slideCount: number): result is WriteResult {
  return typeof result === "object" && result !== null && "slides" in result &&
    Array.isArray(result.slides) && result.slides.length > 0 && result.slides.length === slideCount;
}

/** A fonte vai na legenda: dentro do card, ela só pesa o texto. */
export function withoutSources(result: WriteResult): WriteResult {
  const clean = (body: string) => body.replace(/(^|\s)Fontes?:[^\n]*$/gim, "").replace(/\n{3,}/g, "\n\n").trim();
  return { ...result, slides: result.slides.map((slide) => ({ ...slide, body: clean(slide.body) })) };
}

/** Falhas editoriais preservam a primeira versão; cancelamento interrompe a tarefa. */
export async function withReviewFallback(original: WriteResult, review: () => Promise<WriteResult>, signal: AbortSignal): Promise<WriteResult> {
  signal.throwIfAborted();
  try {
    const revised = await review();
    signal.throwIfAborted();
    return isValidReview(revised, original.slides.length) ? revised : original;
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof Error && error.name === "AbortError") throw error;
    return original;
  }
}
