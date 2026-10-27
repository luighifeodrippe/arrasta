import { Fragment, type ReactNode } from "react";

/** "Isso é **importante**" → o trecho entre asteriscos duplos ganha a cor de destaque. */
export function rich(text: string, emphasis: React.CSSProperties, mark?: React.CSSProperties): ReactNode {
  if (mark) {
    return text.split(/(\*\*[^*]+?\*\*|\[[^\]]+\])/g).map((part, index) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <span key={index} style={emphasis}>{rich(part.slice(2, -2), emphasis, mark)}</span>
      ) : part.startsWith("[") && part.endsWith("]") ? (
        <span key={index} data-mark="" style={mark}>{rich(part, { ...emphasis, ...mark })}</span>
      ) : <Fragment key={index}>{rich(part, emphasis)}</Fragment>,
    );
  }
  const parts = text.split(/(\*\*[^*]+?\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <span key={index} style={emphasis}>
        {part.slice(2, -2)}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

export function plain(text: string): string {
  return text.replace(/\*\*/g, "");
}

export { joinItems, listItems, type ListLine } from "@/lib/list";
