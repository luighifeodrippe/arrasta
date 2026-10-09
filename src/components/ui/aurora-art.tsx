"use client";

import { Ascii } from "ascii.rest/react";
import * as auroraFjord from "ascii.rest/pieces/aurora-fjord";
import { cn } from "./cn";

/** "Aurora fjord" do ascii.rest (MIT, © 2026 bas3line), sumindo nas bordas: a imagem calma de um lugar ainda vazio. */
export function AuroraArt({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none mx-auto w-full [mask-composite:intersect] [mask-image:linear-gradient(90deg,transparent,#000_22%,#000_78%,transparent),linear-gradient(180deg,transparent,#000_18%,#000_62%,transparent)]",
        className,
      )}
    >
      <Ascii piece={auroraFjord} />
    </div>
  );
}
