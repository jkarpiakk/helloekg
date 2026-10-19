import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-[.9375rem] font-medium leading-none ring-offset-background transition-[transform,background-color,border-color,color,opacity] duration-200 ease-out active:scale-[.97] active:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-35 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--puls)] text-[var(--on-puls)] hover:bg-[color-mix(in_srgb,var(--puls)_88%,white)]",
        destructive:
          "bg-[var(--alarm-solid)] text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--alarm-solid)_90%,black)]",
        outline:
          "border-[var(--line2)] bg-transparent text-[var(--txt)] hover:border-[var(--txt3)]",
        secondary:
          "border-[var(--line2)] bg-transparent text-[var(--txt)] hover:border-[var(--txt3)]",
        ghost: "text-[var(--txt2)] hover:bg-[var(--tint)] hover:text-[var(--txt)]",
        link: "text-[var(--puls)] underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-12 px-[26px]",
        sm: "h-[38px] px-4 text-sm [@media(pointer:coarse)]:h-11",
        lg: "h-[52px] px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
