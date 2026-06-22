import type { BrightnessCurve, ColorSpec, Mood } from '../types'

interface MoodStyle {
  /** overlay 合成でかけるティント色 */
  tint: string
  /** ティントの不透明度 */
  tintAlpha: number
  /** 追加の暗さ（source-over の黒） */
  baseDark: number
}

const MOODS: Record<Mood, MoodStyle> = {
  none: { tint: '#000000', tintAlpha: 0, baseDark: 0 },
  dusk: { tint: '#ff7a2f', tintAlpha: 0.28, baseDark: 0.08 },
  morning: { tint: '#ffe6a8', tintAlpha: 0.22, baseDark: 0 },
  night: { tint: '#16285a', tintAlpha: 0.42, baseDark: 0.22 },
  warm: { tint: '#ff9d4d', tintAlpha: 0.2, baseDark: 0 },
  cool: { tint: '#4da6ff', tintAlpha: 0.2, baseDark: 0.04 },
}

function brightnessAlpha(curve: BrightnessCurve, t: number): number {
  // 戻り値 > 0 なら黒、< 0 なら白を、その絶対値の不透明度で重ねる
  switch (curve) {
    case 'darken':
      return 0.3 * t
    case 'brighten':
      return -0.25 * (1 - t)
    case 'pulse':
      return -0.12 * Math.sin(t * Math.PI * 2)
    case 'none':
    default:
      return 0
  }
}

/**
 * 写真描画の「上」に色・明るさ・ビネットを重ねる。
 * tNorm は 0..1 の進捗。
 */
export function applyColorGrade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: ColorSpec,
  tNorm: number,
) {
  const mood = MOODS[color.mood] ?? MOODS.none

  // 1) ムードのティント（overlay でなじませる）
  if (mood.tintAlpha > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = mood.tintAlpha
    ctx.fillStyle = mood.tint
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // 2) ベースの暗さ + 明るさカーブ
  const dark = mood.baseDark + brightnessAlpha(color.brightnessCurve, tNorm)
  if (dark > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.8, dark)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  } else if (dark < 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.8, -dark)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // 3) ビネット
  if (color.vignette > 0) {
    ctx.save()
    const cx = w / 2
    const cy = h / 2
    const inner = Math.min(w, h) * 0.35
    const outer = Math.hypot(w, h) * 0.62
    const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, color.vignette)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }
}
