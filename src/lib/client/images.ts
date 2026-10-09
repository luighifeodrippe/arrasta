"use client";

import { toast } from "sonner";
import { makeImage } from "../defaults";
import type { Project } from "../types";
import { api } from "./api";
import { useEditor } from "./editor-store";

/** Tipo usado ao arrastar uma imagem da biblioteca para um card. */
export const IMAGE_DRAG_TYPE = "application/x-arrasta-image";

/** Envia imagens do computador e guarda na biblioteca do carrossel. */
export async function uploadImages(files: File[]): Promise<string[]> {
  const project = useEditor.getState().project;
  if (!project) return [];
  const images = files.filter((f) => f.type.startsWith("image/"));
  if (!images.length) {
    toast.error("Envie uma imagem (JPG, PNG ou WebP).");
    return [];
  }
  const urls: string[] = [];
  for (const file of images) {
    try {
      urls.push((await api.upload(project.id, file)).url);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  useEditor.getState().addImages(urls);
  return urls;
}

/** Põe a imagem no slide, mantendo o modo (junto do texto ou no fundo) se ele já tinha uma. */
export function placeImage(slideId: string | null, src: string) {
  const { project, updateSlide, select } = useEditor.getState();
  const slide = project?.slides.find((s) => s.id === slideId);
  if (!slide) {
    toast("Escolha um slide no palco primeiro.");
    return;
  }
  updateSlide(slide.id, { image: makeImage(src, { mode: slide.image?.mode ?? "inline" }) });
  select(slide.id);
}

export async function uploadToSlide(slideId: string | null, file: File) {
  const [url] = await uploadImages([file]);
  if (url) placeImage(slideId, url);
}

/** Todas as imagens à mão: as enviadas (e as que já estão nos slides) e as do conteúdo original. */
export function imageLibrary(project: Project): { uploads: string[]; original: string[] } {
  const original = [...(project.source?.slides ?? []).map((s) => s.src), ...(project.source?.media ?? [])];
  const inSlides = project.slides.map((s) => s.image?.src).filter((src): src is string => Boolean(src) && !original.includes(src!));
  const uploads = [...new Set([...project.images, ...inSlides])];
  return { uploads, original: [...new Set(original)] };
}
