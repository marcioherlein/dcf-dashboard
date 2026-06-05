import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(95,121,11,0.55)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Olive — primary brand CTA. Use for core actions: analyze, save, upgrade.
        default:
          "bg-[#5F790B] text-white hover:bg-[#526A08] active:bg-[#4A5E07] shadow-sm",
        // White surface with warm border — secondary actions
        outline:
          "border-[#C8C8C8] bg-white text-[#111111] hover:bg-[#F6FAEA] hover:border-[#5F790B]",
        // Subtle tinted — tertiary/low-emphasis
        secondary:
          "bg-[#FFFFFF] border-[#E5E5E5] text-[#6B6B6B] hover:bg-[#EEF4DD] hover:text-[#111111]",
        // Ghost — icon buttons, inline actions
        ghost:
          "text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#111111]",
        // Blue — secondary/info actions (links, saves, navigation)
        blue:
          "bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] shadow-sm",
        // Destructive — red, only for irreversible actions
        destructive:
          "bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8] hover:bg-[#F8D0D0]",
        // Text link style
        link:
          "text-[#5F790B] underline-offset-4 hover:underline hover:text-[#526A08]",
        // Dark ink surface (for use on light pages with ink card backgrounds)
        ink:
          "bg-[#111111] text-white hover:bg-[#1C1C1C] shadow-sm",
        // Legacy dark glass — kept for landing/dark hero sections
        glass:
          "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(255,255,255,0.14)] hover:border-[rgba(255,255,255,0.25)]",
      },
      size: {
        // Landing page buttons (44px)
        landing: "h-11 gap-2 px-5 text-[14px]",
        // App buttons (40px)
        default: "h-10 gap-1.5 px-4 text-[13.5px]",
        // Compact (36px) — inside cards, toolbars
        sm:   "h-9 gap-1 rounded-[9px] px-3.5 text-[13px]",
        // Extra small (32px)
        xs:   "h-8 gap-1 rounded-[8px] px-3 text-[12.5px]",
        // Tiny (28px) — chips, inline
        xxs:  "h-7 gap-0.5 rounded-[8px] px-2.5 text-[12px]",
        // Icon buttons
        icon:    "size-10 rounded-[10px]",
        "icon-sm": "size-9 rounded-[9px]",
        "icon-xs": "size-8 rounded-[8px]",
        lg: "h-11 gap-2 px-5 text-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
