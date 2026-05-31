import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-semibold',
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md font-bold',
        destructive: 'bg-red-500 text-white hover:bg-red-600 shadow-sm font-semibold',
        outline: 'border border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:text-slate-900 text-slate-700 font-medium',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 font-semibold',
        ghost: 'hover:bg-slate-100 hover:text-slate-900 text-slate-600 font-medium',
        link: 'text-indigo-600 underline-offset-4 hover:underline font-medium',
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
