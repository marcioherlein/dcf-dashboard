import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      tone: {
        positive:      "bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]",
        negative:      "bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]",
        warning:       "bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]",
        informational: "bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]",
        neutral:       "bg-[#F0F1F6] text-[#566174] border-[#E3E1DA]",
        brand:         "bg-[#F6F9EC] text-[#5F790B] border-[#EDF3DD]",
        dark:          "bg-white/10 text-white border-white/20",
      },
      variant: {
        default:     "bg-primary text-primary-foreground border-transparent",
        secondary:   "bg-secondary text-secondary-foreground border-transparent",
        destructive: "bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]",
        outline:     "border-[#E3E1DA] text-[#06101F] bg-transparent",
        ghost:       "bg-transparent text-[#566174] border-transparent hover:bg-[#F0F1F6]",
        link:        "bg-transparent text-[#5F790B] border-transparent underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      tone: undefined,
      variant: undefined,
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        badgeVariants({ tone, variant }),
        !tone && !variant && "bg-[#F6F9EC] text-[#5F790B] border-[#EDF3DD]",
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
