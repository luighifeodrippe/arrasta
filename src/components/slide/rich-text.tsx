import { Fragment, type ReactNode } from "react";

/** "Isso é **importante**" → o trecho entre asteriscos duplos ganha a cor de destaque. */
export function rich(text: string, emphasis: React.CSSProperties): ReactNode {
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
