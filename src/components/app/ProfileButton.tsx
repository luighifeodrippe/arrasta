"use client";

import { useApp } from "@/lib/client/app-store";
import { cn } from "../ui/cn";

/** Foto e @ no topo; abre os Ajustes. Em telas estreitas fica só a foto (labelClass decide quando o @ aparece). */
export function ProfileButton({ className, labelClass = "hidden sm:inline", compact = false }: { className?: string; labelClass?: string; compact?: boolean }) {
  const profile = useApp((s) => s.profile);
  const openSettings = useApp((s) => s.openSettings);
  const ready = Boolean(profile?.handle);
  return (
    <button
      onClick={() => openSettings("perfil")}
      aria-label="Ajustes: perfil, voz e escrita"
      title={profile?.handle ? `@${profile.handle} · Ajustes` : "Seu perfil e sua voz"}
      className={cn("control relative flex h-9 items-center justify-center gap-2 rounded-[10px] px-1.5 text-[13.5px] text-ink transition-colors hover:border-line-strong", compact && "size-[32px] p-0", className)}
    >
      {profile?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar} alt="" className="size-6 rounded-full object-cover" />
      ) : (
        <span className="grid size-6 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-ink-2">
          {(profile?.name || "?").charAt(0).toUpperCase()}
        </span>
      )}
      {!compact && <span className={cn("max-w-[140px] truncate pr-1.5", labelClass)}>{ready ? `@${profile!.handle}` : "Sua voz"}</span>}
      {!ready && <span className={cn("size-1.5 rounded-full bg-brand", compact ? "absolute right-0.5 top-0.5" : "mr-1")} aria-label="Incompleto" />}
    </button>
  );
}
