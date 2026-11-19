import { makeImage, makeSlide, MAX_SLIDES } from "../defaults.ts";
import type { Slide } from "../types";
import type { EditResult } from "./prompts.ts";

/** O número da imagem é base 1; os ajustes do slide atual são preservados pelo id. */
export function applyEditResult(current: readonly Slide[], edited: EditResult["slides"], images: readonly string[]): Slide[] {
  const byId = new Map(current.map((slide) => [slide.id, slide]));
  return edited.slice(0, MAX_SLIDES).map((slide) => {
    const previous = byId.get(slide.id);
    const text = { kind: slide.kind, tag: slide.tag, title: slide.title, body: slide.body };
    const next = previous ? { ...previous, ...text } : makeSlide(text);
    const url = slide.image !== null && Number.isInteger(slide.image) && slide.image >= 1 && slide.image <= images.length
      ? images[slide.image - 1]
      : undefined;
    return url ? { ...next, image: makeImage(url, { mode: previous?.image?.mode ?? "inline" }) } : next;
  });
}
