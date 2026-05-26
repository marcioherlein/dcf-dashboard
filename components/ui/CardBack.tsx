import { cn } from '@/lib/utils'

interface Section { title: string; body: string }

interface Props {
  title: string
  emoji?: string
  intro?: string
  sections: Section[]
  warning?: string
  className?: string
}

export default function CardBack({ title, emoji, intro, sections, warning, className }: Props) {
  return (
    <div className={cn('text-left', className)}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">What this means</p>
      <p className="text-sm font-semibold text-white mb-3">
        {emoji && <span className="mr-1.5">{emoji}</span>}{title}
      </p>

      {intro && (
        <p className="text-[12px] text-slate-300 leading-relaxed mb-4">{intro}</p>
      )}

      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.title} className="rounded-lg bg-white/5 border border-white/8 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-blue-300 mb-0.5">{s.title}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      {warning && (
        <p className="mt-3 text-[10px] text-amber-500/80 leading-relaxed">⚠ {warning}</p>
      )}
    </div>
  )
}
