import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-6 min-h-[200px] text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="w-10 h-10 flex items-center justify-center text-[#8A95A6]">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[16px] font-medium text-[#06101F]">{title}</p>
        {description && (
          <p className="text-[14px] text-[#566174] max-w-xs leading-snug">{description}</p>
        )}
      </div>
      {action && (
        action.href ? (
          <a
            href={action.href}
            className="inline-flex items-center justify-center h-9 gap-1 rounded-[9px] px-3.5 text-[13px] font-semibold border border-[#CDD1C8] bg-white text-[#06101F] hover:bg-[#F6F9EC] hover:border-[#5F790B] transition-colors"
          >
            {action.label}
          </a>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  )
}

export { EmptyState }
