"use client";

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { SVGProps } from "react";

export type IconData = IconSvgElement;

/** Ícones da Hugeicons (os mesmos dos componentes da uselayouts): traço fino e cantos redondos. */
export function Icon({ icon, strokeWidth = 1.7, ...props }: { icon: IconSvgElement; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "ref" | "strokeWidth">) {
  return <HugeiconsIcon icon={icon} strokeWidth={strokeWidth} aria-hidden={props["aria-label"] ? undefined : true} {...props} />;
}
