import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold transition-colors',
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md font-bold transition-colors',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm font-semibold transition-colors',
        outline: 'border border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground text-foreground font-medium transition-colors',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold transition-colors',
        ghost: 'hover:bg-accent hover:text-accent-foreground text-foreground font-medium transition-colors',
        link: 'text-primary underline-offset-4 hover:underline font-medium transition-colors',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg gap-1.5 px-3 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
