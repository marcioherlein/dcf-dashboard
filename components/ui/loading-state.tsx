import * as React from "react"
import { cn } from "@/lib/utils"

interface CardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
  height?: string
}

function CardSkeleton({ lines = 3, height, className, ...props }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] p-4 animate-pulse",
        height,
        className
      )}
      aria-hidden="true"
      {...props}
    >
      <div className="space-y-3">
        <div className="h-4 bg-[#E3E1DA] rounded w-2/5" />
        {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 bg-[#E3E1DA] rounded",
              i === lines - 2 ? "w-3/5" : "w-full"
            )}
          />
        ))}
      </div>
    </div>
  )
}

function SkeletonGrid({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  )
}

function LoadingSpinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-[#E3E1DA] border-t-[#5F790B]",
        className
      )}
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    />
  )
}

export { CardSkeleton, SkeletonGrid, LoadingSpinner }
