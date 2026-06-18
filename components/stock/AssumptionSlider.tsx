'use client'

interface Marker {
  value: number
  label: string
}

interface Props {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  defaultValue: number
  markers?: Marker[]
  onChange: (value: number) => void
}

function toDisplay(v: number, unit: string) {
  return `${v.toFixed(1)}${unit}`
}

export default function AssumptionSlider({
  label, description, value, min, max, step, unit = '%',
  defaultValue, markers = [], onChange,
}: Props) {
  const isOverridden = Math.abs(value - defaultValue) > 0.001
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#E3E1DA]">{label}</p>
          <p className="text-xs text-[#8A95A6]">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOverridden && (
            <button
              onClick={() => onChange(defaultValue)}
              className="text-[11px] text-olive-600 hover:text-olive-700 underline underline-offset-2"
            >
              Reset
            </button>
          )}
          <span className={`text-base font-bold tabular-nums min-w-[52px] text-right ${isOverridden ? 'text-olive-600' : 'text-[#E3E1DA]'}`}>
            {toDisplay(value, unit)}
          </span>
        </div>
      </div>

      <div className="relative py-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer
            bg-[#F0F1F6]
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-olive-600
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-olive-600
            [&::-moz-range-thumb]:shadow-md"
          style={{
            background: `linear-gradient(to right, #5F790B ${pct}%, #E3E1DA ${pct}%)`,
          }}
        />
      </div>

      {/* Reference markers */}
      {markers.length > 0 && (
        <div className="relative h-5">
          {markers.map((m) => {
            const mPct = max > min ? ((m.value - min) / (max - min)) * 100 : 50
            return (
              <div
                key={m.label}
                className="absolute flex flex-col items-center"
                style={{ left: `${mPct}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-2 bg-[#CDD1C8]" />
                <span className="text-[10px] text-[#8A95A6] whitespace-nowrap">{m.label}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex justify-between text-[10px] text-[#8A95A6] -mt-1">
        <span>{toDisplay(min, unit)}</span>
        <span>{toDisplay(max, unit)}</span>
      </div>
    </div>
  )
}
