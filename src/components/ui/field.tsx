import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px] font-medium text-ink-2">
      <span>{children}</span>
      {hint && <span className="font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("field h-10 w-full px-3.5 text-[14px]", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("field w-full resize-none px-3.5 py-2.5 text-[14px] leading-relaxed", className)} {...props} />;
});

/** Um grupo do painel: vidro fumê com o título em cima e, à direita, o que se faz com o grupo. */
export function Section({ title, children, action, note }: { title: ReactNode; children: ReactNode; action?: ReactNode; note?: ReactNode }) {
  return (
    <section className="panel-group">
      <div className="panel-group-head">
        <h3>{title}</h3>
        {action}
      </div>
      {note && <p className="panel-note -mt-2">{note}</p>}
      {children}
    </section>
  );
}
