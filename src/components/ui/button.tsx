
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "text-primary hover:opacity-70",
        destructive: "text-destructive hover:opacity-70",
        outline: "text-foreground hover:opacity-70",
        secondary: "text-secondary-foreground hover:opacity-70",
        ghost: "hover:opacity-70",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-auto py-2 px-3",
        sm: "h-auto py-1 px-2",
        lg: "h-auto py-3 px-4",
        icon: "h-auto p-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

import { Button as CarbonButton } from '@carbon/react'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    let kind: any = "primary";
    if (variant === "destructive") kind = "danger";
    else if (variant === "outline") kind = "tertiary";
    else if (variant === "secondary") kind = "secondary";
    else if (variant === "ghost") kind = "ghost";

    let carbonSize: any = "md";
    if (size === "sm") carbonSize = "sm";
    else if (size === "lg") carbonSize = "lg";

    return (
      <CarbonButton
        kind={kind}
        size={carbonSize}
        className={className}
        ref={ref}
        {...props as any}
      >
        {children}
      </CarbonButton>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
