"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Launcher } from "./Launcher";

export function NewCarouselDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== previousPath.current && open) onOpenChange(false);
    previousPath.current = pathname;
  }, [pathname, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Novo carrossel"
        description="Cole um link, um texto ou os prints de um carrossel que funcionou. O ChatGPT Work recria na sua voz."
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Launcher autoFocus />
      </DialogContent>
    </Dialog>
  );
}
