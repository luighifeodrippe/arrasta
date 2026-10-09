"use client";

import JSZip from "jszip";
import { domToBlob } from "modern-screenshot";
import { slideFilename, slugify } from "./export-selection";
export { exportIndices, slideFilename, slugify } from "./export-selection";

async function settle(node: HTMLElement) {
  await document.fonts?.ready;
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(images.map((img) => (img.complete ? img.decode().catch(() => undefined) : new Promise((r) => (img.onload = img.onerror = r)))));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/** Fotografa um slide renderizado em tamanho real (1080 de largura). */
export async function slideToPng(node: HTMLElement): Promise<Blob> {
  await settle(node);
  const blob = await domToBlob(node, { width: node.offsetWidth, height: node.offsetHeight, scale: 1, type: "image/png" });
  if (!blob) throw new Error("Não consegui gerar a imagem.");
  return blob;
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportZip(
  nodes: HTMLElement[],
  title: string,
  caption: string,
  onProgress?: (done: number, total: number) => void,
  indices: readonly number[] = nodes.map((_, index) => index),
): Promise<void> {
  if (!nodes.length) throw new Error("Selecione pelo menos um card para baixar.");
  if (indices.length !== nodes.length) throw new Error("A seleção mudou. Selecione os cards novamente.");
  const zip = new JSZip();
  const base = slugify(title);
  for (const [index, node] of nodes.entries()) {
    const blob = await slideToPng(node);
    zip.file(slideFilename(title, indices[index]), blob);
    onProgress?.(index + 1, nodes.length);
  }
  if (caption.trim()) zip.file("legenda.txt", caption);
  download(await zip.generateAsync({ type: "blob" }), `${base}.zip`);
}
