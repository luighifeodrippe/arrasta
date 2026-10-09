/** Mantém os cards na ordem do carrossel, sem duplicatas ou índices inválidos. */
export function exportIndices(total: number, indices: readonly number[]): number[] {
  return [...new Set(indices)].filter((index) => Number.isInteger(index) && index >= 0 && index < total).sort((a, b) => a - b);
}

export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "carrossel"
  );
}

/** O número identifica a posição original, mesmo ao baixar parte do carrossel. */
export function slideFilename(title: string, index: number): string {
  return `${slugify(title)}-${String(index + 1).padStart(2, "0")}.png`;
}
