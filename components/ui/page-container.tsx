import * as React from "react"
import { cn } from "@/lib/utils"

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Restricts max-width. Default is 'default' (1024px). */
  width?: "sm" | "default" | "wide" | "full"
}

const widthClass: Record<NonNullable<PageContainerProps["width"]>, string> = {
  sm:      "max-w-2xl",
  default: "max-w-5xl",
  wide:    "max-w-7xl",
  full:    "max-w-none",
}

function PageContainer({
  width = "default",
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        widthClass[width],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { PageContainer }
