import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

const button = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,background-color,border-color,opacity,box-shadow] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "keycap hover:brightness-[1.03]",
        glass: "control text-ink hover:border-line-strong hover:bg-white/[0.08]",
        ghost: "border border-transparent text-ink-2 hover:bg-white/[0.06] hover:text-ink",
        danger: "border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20",
      },
      size: {
        sm: "h-8 rounded-[10px] px-3 text-[13px] [&_svg]:size-4",
        md: "h-10 rounded-[12px] px-4 text-sm [&_svg]:size-[18px]",
        lg: "h-12 rounded-[14px] px-5 text-[15px] [&_svg]:size-5",
        icon: "size-9 rounded-[10px] [&_svg]:size-[18px]",
        "icon-sm": "size-8 rounded-[9px] [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...props} />;
});
