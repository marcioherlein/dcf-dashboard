'use client'
import { useEffect, useRef, CSSProperties } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useInView } from 'motion/react'

interface Props {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  style?: CSSProperties
}

export default function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 1, className, style }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 60, damping: 18, restDelta: 0.01 })
  const display = useTransform(spring, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`)

  useEffect(() => {
    if (inView) motionVal.set(value)
  }, [inView, value, motionVal])

  return (
    <motion.span ref={ref} className={className} style={style}>
      {display}
    </motion.span>
  )
}
