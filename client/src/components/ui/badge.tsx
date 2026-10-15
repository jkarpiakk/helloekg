import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-normal uppercase leading-none tracking-[.14em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[var(--puls-deep)] bg-[var(--tint)] text-[var(--puls)]",
        secondary:
          "border-[var(--line2)] bg-transparent text-[var(--label)]",
        destructive:
          "border-[color-mix(in_srgb,var(--alarm)_50%,transparent)] bg-transparent text-[var(--alarm)]",
        outline: "border-[var(--line2)] text-[var(--txt2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
