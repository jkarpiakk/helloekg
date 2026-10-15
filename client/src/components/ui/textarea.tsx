import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-[10px] border border-[var(--line2)] bg-transparent px-4 py-3 text-base leading-relaxed text-[var(--txt)] transition-colors duration-200 placeholder:text-[var(--txt3)] hover:border-[var(--txt3)] focus-visible:border-[var(--puls)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
