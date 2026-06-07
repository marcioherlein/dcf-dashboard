import * as React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

function PageHeader({ title, subtitle, action, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 mb-6 sm:mb-8", className)}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-[24px] sm:text-[30px] font-bold leading-tight tracking-tight text-[#06101F]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[14px] text-[#566174] leading-snug">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { PageHeader }
