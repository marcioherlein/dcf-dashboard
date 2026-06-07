'use client'

import { useRef, useEffect, useCallback } from 'react'

interface DrumRollPickerProps {
  value: number
  min: number
  max: number
  step: number
  color: string        // hex, used for selected item highlight
  format: (v: number) => string
  onChange: (v: number) => void
  label: string
}

const ITEM_H = 36          // px height of each row
const VISIBLE = 5          // odd number — selected is centre
const SNAP_AFTER_MS = 80   // debounce before snapping

export function DrumRollPicker({ value, min, max, step, color, format, onChange, label }: DrumRollPickerProps) {
  const steps = Math.round((max - min) / step)
  const items: number[] = Array.from({ length: steps + 1 }, (_, i) => min + i * step)

  const idx = Math.round((value - min) / step)
  const clampedIdx = Math.max(0, Math.min(items.length - 1, idx))

  const listRef  = useRef<HTMLUListElement>(null)
  const snapRef  = useRef<ReturnType<typeof setTimeout>>()
  const dragging = useRef(false)
  const startY   = useRef(0)
  const startScrollTop = useRef(0)

  // Scroll to the correct item without animation on first mount / external value change
  const scrollToIdx = useCallback((i: number, smooth = false) => {
    const el = listRef.current
    if (!el) return
    const target = i * ITEM_H
    if (smooth) {
      el.scrollTo({ top: target, behavior: 'smooth' })
    } else {
      el.scrollTop = target
    }
  }, [])

  useEffect(() => {
    scrollToIdx(clampedIdx, false)
  // Only on mount and when value changes externally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedIdx])

  function snapToNearest() {
    const el = listRef.current
    if (!el) return
    const raw = el.scrollTop / ITEM_H
    const nearest = Math.round(raw)
    const clamped = Math.max(0, Math.min(items.length - 1, nearest))
    scrollToIdx(clamped, true)
    const newVal = items[clamped]
    if (Math.abs(newVal - value) > step * 0.01) onChange(newVal)
  }

  function onScroll() {
    clearTimeout(snapRef.current)
    snapRef.current = setTimeout(snapToNearest, SNAP_AFTER_MS)
  }

  // Touch drag — feel like native iOS
  function onTouchStart(e: React.TouchEvent) {
    dragging.current = true
    startY.current = e.touches[0].clientY
    startScrollTop.current = listRef.current?.scrollTop ?? 0
    clearTimeout(snapRef.current)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current || !listRef.current) return
    const dy = startY.current - e.touches[0].clientY
    listRef.current.scrollTop = startScrollTop.current + dy
  }

  function onTouchEnd() {
    dragging.current = false
    snapToNearest()
  }

  // Mouse drag for desktop
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    startY.current = e.clientY
    startScrollTop.current = listRef.current?.scrollTop ?? 0
    clearTimeout(snapRef.current)
    e.preventDefault()
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !listRef.current) return
      const dy = startY.current - e.clientY
      listRef.current.scrollTop = startScrollTop.current + dy
    }
    function onMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      snapToNearest()
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, value, step, onChange])

  const containerH = ITEM_H * VISIBLE
  const paddingItems = Math.floor(VISIBLE / 2)  // items above/below centre

  return (
    <div
      className="relative select-none overflow-hidden rounded-xl"
      style={{ height: containerH, touchAction: 'none' }}
      aria-label={label}
      role="listbox"
      aria-activedescendant={`drum-item-${clampedIdx}`}
    >
      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 z-10 pointer-events-none"
        style={{
          height: containerH / 2 - ITEM_H / 2,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.96), rgba(255,255,255,0.0))',
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{
          height: containerH / 2 - ITEM_H / 2,
          background: 'linear-gradient(to top, rgba(255,255,255,0.96), rgba(255,255,255,0.0))',
        }}
      />
      {/* Selection band */}
      <div
        className="absolute inset-x-0 z-10 pointer-events-none rounded-lg"
        style={{
          top: paddingItems * ITEM_H,
          height: ITEM_H,
          background: `${color}14`,
          borderTop: `1.5px solid ${color}40`,
          borderBottom: `1.5px solid ${color}40`,
        }}
      />

      {/* Scrollable list */}
      <ul
        ref={listRef}
        className="absolute inset-0 overflow-y-scroll"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        {/* Top padding rows */}
        {Array.from({ length: paddingItems }).map((_, i) => (
          <li key={`pad-top-${i}`} style={{ height: ITEM_H }} aria-hidden="true" />
        ))}

        {items.map((v, i) => {
          const dist = Math.abs(i - clampedIdx)
          const isSelected = dist === 0
          const opacity = isSelected ? 1 : dist === 1 ? 0.45 : 0.18
          const scale = isSelected ? 1 : dist === 1 ? 0.88 : 0.76
          return (
            <li
              key={i}
              id={`drum-item-${i}`}
              role="option"
              aria-selected={isSelected}
              onClick={() => { scrollToIdx(i, true); onChange(v) }}
              className="flex items-center justify-center cursor-pointer"
              style={{ height: ITEM_H }}
            >
              <span
                className="tabular-nums font-[700] transition-all duration-75"
                style={{
                  fontSize: isSelected ? 17 : 14,
                  color: isSelected ? color : '#566174',
                  opacity,
                  transform: `scale(${scale})`,
                  letterSpacing: '-0.01em',
                }}
              >
                {format(v)}
              </span>
            </li>
          )
        })}

        {/* Bottom padding rows */}
        {Array.from({ length: paddingItems }).map((_, i) => (
          <li key={`pad-bot-${i}`} style={{ height: ITEM_H }} aria-hidden="true" />
        ))}
      </ul>
    </div>
  )
}
