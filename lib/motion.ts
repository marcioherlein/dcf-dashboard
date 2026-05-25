import type { Transition, Variants } from 'motion/react'

export const springs = {
  snappy: { type: 'spring', duration: 0.25, bounce: 0.15 } as Transition,
  smooth: { type: 'spring', duration: 0.4,  bounce: 0.1  } as Transition,
  bounce: { type: 'spring', duration: 0.5,  bounce: 0.3  } as Transition,
}

export const stagger = {
  container: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } as Variants['container'],
  item: {
    hidden:  { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: springs.smooth },
  } as Variants,
}

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0,  transition: springs.smooth },
}

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
}

export const slideDown: Variants = {
  hidden:  { opacity: 0, y: -8,  scaleY: 0.96 },
  visible: { opacity: 1, y: 0,   scaleY: 1,    transition: springs.snappy },
  exit:    { opacity: 0, y: -6,  scaleY: 0.97, transition: { duration: 0.15, ease: 'easeIn' } },
}

export const tabContent: Variants = {
  hidden:  { opacity: 0, x: 8  },
  visible: { opacity: 1, x: 0, transition: springs.smooth },
  exit:    { opacity: 0, x: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}
