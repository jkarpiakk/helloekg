import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-[10px] border border-[var(--field-border)] bg-[var(--panel)] px-4 py-3 text-base leading-relaxed text-[var(--txt)] transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--txt3)] hover:border-[var(--txt2)] focus-visible:border-[var(--puls)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--puls)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
