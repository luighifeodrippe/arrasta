import { APP_NAME } from "@/lib/defaults";

/** Um slide na frente, o próximo espiando ao lado, e a seta de arrastar. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="23.5" y="7.5" width="6" height="17" rx="2.6" fill="#fff" opacity="0.26" />
      <rect x="2.5" y="4" width="18.5" height="24" rx="5" fill="#fff" />
      <path d="M7.6 16h8.6m-3.3-3.6L16.5 16l-3.6 3.6" stroke="#ff3500" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="-ml-0.5 flex shrink-0 items-center gap-2.5">
      <span className="drop-shadow-[0_0_12px_rgb(255_53_0/0.35)]"><LogoMark /></span>
      <span className="titulo text-[18px]">{APP_NAME}</span>
    </span>
  );
}
