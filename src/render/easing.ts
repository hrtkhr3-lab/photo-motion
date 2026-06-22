import type { Easing } from '../types'

export function applyEasing(t: number, easing: Easing): number {
  const x = Math.min(1, Math.max(0, t))
  switch (easing) {
    case 'linear':
      return x
    case 'easeIn':
      return x * x
    case 'easeOut':
      return 1 - (1 - x) * (1 - x)
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
    default:
      return x
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
