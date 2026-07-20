"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      // Pasek postępu wg brand booka: wysokość 4px, radius 2px, tor w kolorze śladu.
      // Kolory przez tokeny, NIE zaszyte na sztywno — to prymityw współdzielony przez
      // cały produkt, a #3EE6A8 na jasnym tle ma kontrast 1,5:1 i jest zabroniony (§2).
      // `--brand-trace` i `--primary` mają osobne wartości dla obu motywów.
      "relative h-1 w-full overflow-hidden rounded-[2px] bg-[hsl(var(--brand-trace))]",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
