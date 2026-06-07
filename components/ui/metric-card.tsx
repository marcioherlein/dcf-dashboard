import * as React from "react"
import { cn } from "@/lib/utils"

type MetricTone = "neutral" | "positive" | "negative" | "warning" | "brand"

const toneBg: Record<MetricTone, string> = {
  neutral:  "bg-white border-[#E3E1DA]",
  positive: "bg-[#E8F7EF] border-[#A3D9BE]",
  negative: "bg-[#FCEAEA] border-[#F0B8B8]",
  warning:  "bg-[#FFF4DA] border-[#F3D391]",
  brand:    "bg-[#F6F9EC] border-[#EDF3DD]",
}

const toneValue: Record<MetricTone, string> = {
  neutral:  "text-[#06101F]",
  positive: "text-[#11875D]",
  negative: "text-[#D83B3B]",
  warning:  "text-[#B56A00]",
  brand:    "text-[#5F790B]",
}

const toneDelta: Record<"up" | "down" | "neutral", string> = {
  up:      "text-[#11875D]",
  down:    "text-[#D83B3B]",
  neutral: "text-[#566174]",
}

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  sub?: string
  tone?: MetricTone
  delta?: string
  deltaDirection?: "up" | "down" | "neutral"
}

function MetricCard({
  label,
  value,
  sub,
  tone = "neutral",
  delta,
  deltaDirection = "neutral",
  className,
  ...props
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-1",
        "shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
        toneBg[tone],
        className
      )}
      {...props}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A95A6]">
        {label}
      </p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={cn(
            "text-[26px] font-bold leading-none tabular-nums",
            toneValue[tone]
          )}
        >
          {value}
        </span>
        {delta && (
          <span className={cn("text-[12px] font-medium tabular-nums", toneDelta[deltaDirection])}>
            {delta}
          </span>
        )}
      </div>
      {sub && (
        <p className="text-[12px] text-[#566174] leading-snug">{sub}</p>
      )}
    </div>
  )
}

export { MetricCard }
export type { MetricCardProps, MetricTone }
