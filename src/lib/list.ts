/** Listas no corpo do slide: uma linha por item. */
const ITEM = /^(\s*(?:(\d{1,2})[.)]|[-•→▸*])\s+)(.*)$/;

export interface ListLine {
  /** O começo da linha, como "1. " ou "→ ". */
  prefix: string;
  /** Número do item, quando a lista é numerada. */
  marker: string | null;
  text: string;
}

/** Corpo de lista: uma linha por item, com "1. ", "- " ou "→ ". */
export function listItems(body: string): ListLine[] | null {
  const lines = body.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return null;
  const items = lines.map((line) => {
    const match = ITEM.exec(line.trim());
    return match ? { prefix: match[1], marker: match[2] ?? null, text: match[3] } : null;
  });
  if (items.some((i) => !i)) return null;
  return items as ListLine[];
}

/** Junta os itens de volta, renumerando listas numeradas. */
export function joinItems(items: ListLine[]): string {
  let n = 0;
  return items
    .map((item) => {
      if (item.marker !== null) {
        n += 1;
        return `${n}. ${item.text}`;
      }
      return `${item.prefix}${item.text}`;
    })
    .join("\n");
}
