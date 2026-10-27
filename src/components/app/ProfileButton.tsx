"use client";

import { useApp } from "@/lib/client/app-store";
import { cn } from "../ui/cn";

/** Foto e @ no topo; abre os Ajustes. Em telas estreitas fica só a foto (labelClass decide quando o @ aparece). */
export function ProfileButton({ className, labelClass, compact = false }: { className?: string; labelClass?: string; compact?: boolean }) {
  const profile = useApp((s) => s.profile);
  const openSettings = useApp((s) => s.openSettings);
  const ready = Boolean(profile?.handle);
  return (
    <button
      onClick={() => openSettings("perfil")}
      aria-label="Ajustes: perfil, voz e escrita"
      title={profile?.handle ? `@${profile.handle} · Ajustes` : "Seu perfil e sua voz"}
      className={cn("relative flex items-center justify-center gap-2 text-ink transition-colors", compact ? "control size-[32px] rounded-[10px] p-0 hover:border-line-strong" : "home-profile home-pill", className)}
    >
      {profile?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar} alt="" className={cn("shrink-0 rounded-full object-cover", compact ? "size-6" : "size-7")} />
      ) : (
        <span className={cn("grid shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-ink-2", compact ? "size-6" : "size-7")}>
          {(profile?.name || "?").charAt(0).toUpperCase()}
        </span>
      )}
      {!compact && <span className={cn("home-profile-label max-w-[140px] truncate", labelClass)}>{ready ? `@${profile!.handle}` : "Sua voz"}</span>}
    </button>
  );
}
