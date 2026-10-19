import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[10px] border border-[var(--field-border)] bg-[var(--panel)] px-4 text-base text-[var(--txt)] transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--txt3)] hover:border-[var(--txt2)] focus-visible:border-[var(--puls)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--puls)] focus-visible:ring-offset-0 aria-[invalid=true]:border-[var(--alarm)] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
