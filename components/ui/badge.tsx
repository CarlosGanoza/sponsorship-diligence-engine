import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
  {
    variants: {
      variant: {
        ink: "bg-ink-100 text-ink-700",
        sage: "bg-sage-100 text-sage-700",
        gold: "bg-gold-100 text-gold-700",
        muted: "bg-white text-ink-500 ring-1 ring-ink-200",
        danger: "bg-rose-100 text-rose-700",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

export function Badge({
  className,
  variant,
  children,
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
