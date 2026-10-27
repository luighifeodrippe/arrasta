export interface NumberedTitle {
  number: string;
  punct: string;
  rest: string;
}

export function splitNumberedTitle(title: string): NumberedTitle | null {
  const match = /^(\d{1,2})([.)])\s+([\s\S]+)$/.exec(title);
  return match ? { number: match[1], punct: match[2], rest: match[3] } : null;
}

export function joinNumberedTitle(parts: NumberedTitle, rest: string): string {
  return `${parts.number}${parts.punct} ${rest}`;
}

export interface PromptBody {
  lead: string;
  prompt: { open: string; text: string; close: string; labeled: boolean };
  tail: string;
}

export function parsePromptBody(body: string): PromptBody | null {
  const paragraphs = body.split(/\n[ \t]*\n/);
  for (let i = 0; i < paragraphs.length; i++) {
    let text = paragraphs[i];
    const label = /^prompt:\s*/i.exec(text);
    if (label) text = text.slice(label[0].length);
    const open = /^["“]/.exec(text)?.[0] ?? "";
    const close = /["”]$/.exec(text)?.[0] ?? "";
    if (!label && !(open && close && /\[[^\]]+\]/.test(text.slice(1, -1)))) continue;
    return {
      lead: paragraphs.slice(0, i).join("\n\n"),
      prompt: { open, text: text.slice(open.length, close ? -1 : undefined), close, labeled: Boolean(label) },
      tail: paragraphs.slice(i + 1).join("\n\n"),
    };
  }
  return null;
}

export function joinPromptBody({ lead, prompt, tail }: PromptBody): string {
  const text = prompt.text.replace(/\n(?:[ \t]*\n)+/g, "\n");
  const block = `${prompt.labeled ? "Prompt: " : ""}${prompt.open}${text}${prompt.close}`;
  return [lead, block, tail].filter(Boolean).join("\n\n");
}
