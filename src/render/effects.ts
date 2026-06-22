import type { EffectSpec } from '../types'

/** 時間駆動エフェクトの共通インターフェース */
export interface Effect {
  /** dt 秒、キャンバスサイズ w×h で状態更新 */
  update(dt: number, w: number, h: number): void
  /** 描画。tNorm は 0..1 の進捗 */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, tNorm: number): void
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

// ---------------------------------------------------------------------------
// 雨
// ---------------------------------------------------------------------------
interface Drop {
  x: number
  y: number
  len: number
  speed: number
  alpha: number
}
class RainEffect implements Effect {
  private drops: Drop[] = []
  private count: number
  private angle = 0.18 // ラジアン（やや斜め）
  constructor(intensity: number) {
    this.count = Math.floor(80 + intensity * 320)
  }
  private spawn(w: number, h: number): Drop {
    return {
      x: rand(-0.1 * w, 1.1 * w),
      y: rand(-h, 0),
      len: rand(12, 26),
      speed: rand(900, 1500),
      alpha: rand(0.15, 0.5),
    }
  }
  update(dt: number, w: number, h: number) {
    if (this.drops.length < this.count) {
      while (this.drops.length < this.count) this.drops.push(this.spawn(w, h))
    }
    for (const d of this.drops) {
      d.y += d.speed * dt
      d.x += d.speed * dt * Math.sin(this.angle)
      if (d.y > h) Object.assign(d, this.spawn(w, h), { y: rand(-40, 0) })
    }
  }
  draw(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
    ctx.save()
    ctx.strokeStyle = '#cfe8ff'
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'
    for (const d of this.drops) {
      ctx.globalAlpha = d.alpha
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x - Math.sin(this.angle) * d.len, d.y - d.len)
      ctx.stroke()
    }
    ctx.restore()
  }
}

// ---------------------------------------------------------------------------
// 雪
// ---------------------------------------------------------------------------
interface Flake {
  x: number
  y: number
  r: number
  speed: number
  drift: number
  phase: number
  alpha: number
}
class SnowEffect implements Effect {
  private flakes: Flake[] = []
  private count: number
  constructor(intensity: number) {
    this.count = Math.floor(50 + intensity * 200)
  }
  private spawn(w: number, h: number): Flake {
    return {
      x: rand(0, w),
      y: rand(-h, 0),
      r: rand(1.2, 3.8),
      speed: rand(40, 110),
      drift: rand(12, 40),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.4, 0.95),
    }
  }
  update(dt: number, w: number, h: number) {
    while (this.flakes.length < this.count) this.flakes.push(this.spawn(w, h))
    for (const f of this.flakes) {
      f.phase += dt * 1.5
      f.y += f.speed * dt
      f.x += Math.sin(f.phase) * f.drift * dt
      if (f.y > h) Object.assign(f, this.spawn(w, h), { y: rand(-20, 0) })
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.fillStyle = '#ffffff'
    for (const f of this.flakes) {
      ctx.globalAlpha = f.alpha
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

// ---------------------------------------------------------------------------
// キラキラ（明滅する小さな光）
// ---------------------------------------------------------------------------
interface Spark {
  x: number
  y: number
  size: number
  life: number
  maxLife: number
}
class SparkleEffect implements Effect {
  private sparks: Spark[] = []
  private count: number
  constructor(intensity: number) {
    this.count = Math.floor(20 + intensity * 90)
  }
  private spawn(w: number, h: number): Spark {
    const maxLife = rand(0.6, 1.6)
    return {
      x: rand(0, w),
      y: rand(0, h),
      size: rand(1.5, 5),
      life: 0,
      maxLife,
    }
  }
  update(dt: number, w: number, h: number) {
    while (this.sparks.length < this.count) this.sparks.push(this.spawn(w, h))
    for (const s of this.sparks) {
      s.life += dt
      if (s.life > s.maxLife) Object.assign(s, this.spawn(w, h))
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const s of this.sparks) {
      const p = s.life / s.maxLife
      const a = Math.sin(p * Math.PI) // フェードイン→アウト
      if (a <= 0) continue
      ctx.globalAlpha = a
      const r = s.size
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.5)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.4, 'rgba(255,250,220,0.8)')
      g.addColorStop(1, 'rgba(255,250,220,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(s.x, s.y, r * 2.5, 0, Math.PI * 2)
      ctx.fill()
      // 十字グリント
      ctx.strokeStyle = `rgba(255,255,255,${a})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(s.x - r * 3, s.y)
      ctx.lineTo(s.x + r * 3, s.y)
      ctx.moveTo(s.x, s.y - r * 3)
      ctx.lineTo(s.x, s.y + r * 3)
      ctx.stroke()
    }
    ctx.restore()
  }
}

// ---------------------------------------------------------------------------
// ほこり（ゆっくり漂う微粒子）
// ---------------------------------------------------------------------------
interface Mote {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  phase: number
  alpha: number
}
class DustEffect implements Effect {
  private motes: Mote[] = []
  private count: number
  constructor(intensity: number) {
    this.count = Math.floor(30 + intensity * 120)
  }
  private spawn(w: number, h: number): Mote {
    return {
      x: rand(0, w),
      y: rand(0, h),
      r: rand(0.6, 2.2),
      vx: rand(-8, 8),
      vy: rand(-6, 6),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.1, 0.4),
    }
  }
  update(dt: number, w: number, h: number) {
    while (this.motes.length < this.count) this.motes.push(this.spawn(w, h))
    for (const m of this.motes) {
      m.phase += dt
      m.x += (m.vx + Math.sin(m.phase) * 6) * dt
      m.y += m.vy * dt
      if (m.x < -10) m.x = w + 10
      if (m.x > w + 10) m.x = -10
      if (m.y < -10) m.y = h + 10
      if (m.y > h + 10) m.y = -10
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = '#fff6e0'
    for (const m of this.motes) {
      ctx.globalAlpha = m.alpha
      ctx.beginPath()
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

// ---------------------------------------------------------------------------
// 玉ボケ（大きめのソフトな光円）
// ---------------------------------------------------------------------------
interface Orb {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  alpha: number
  hue: number
}
class BokehEffect implements Effect {
  private orbs: Orb[] = []
  private count: number
  constructor(intensity: number) {
    this.count = Math.floor(6 + intensity * 22)
  }
  private spawn(w: number, h: number): Orb {
    return {
      x: rand(0, w),
      y: rand(0, h),
      r: rand(w * 0.03, w * 0.09),
      vx: rand(-10, 10),
      vy: rand(-8, 8),
      alpha: rand(0.05, 0.22),
      hue: rand(35, 55),
    }
  }
  update(dt: number, w: number, h: number) {
    while (this.orbs.length < this.count) this.orbs.push(this.spawn(w, h))
    for (const o of this.orbs) {
      o.x += o.vx * dt
      o.y += o.vy * dt
      if (o.x < -o.r) o.x = w + o.r
      if (o.x > w + o.r) o.x = -o.r
      if (o.y < -o.r) o.y = h + o.r
      if (o.y > h + o.r) o.y = -o.r
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const o of this.orbs) {
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
      g.addColorStop(0, `hsla(${o.hue},80%,75%,${o.alpha})`)
      g.addColorStop(0.7, `hsla(${o.hue},80%,70%,${o.alpha * 0.5})`)
      g.addColorStop(1, `hsla(${o.hue},80%,70%,0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

// ---------------------------------------------------------------------------
// 光線（木漏れ日）— パーティクルではなく加算合成の帯
// ---------------------------------------------------------------------------
class LightRaysEffect implements Effect {
  private intensity: number
  private angle: number
  private t = 0
  constructor(intensity: number, angleDeg: number) {
    this.intensity = intensity
    this.angle = (angleDeg * Math.PI) / 180
  }
  update(dt: number) {
    this.t += dt
  }
  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const diag = Math.hypot(w, h)
    ctx.translate(w * 0.5, h * 0.2)
    ctx.rotate(this.angle)
    const rays = 6
    for (let i = 0; i < rays; i++) {
      const sway = Math.sin(this.t * 0.5 + i) * 12
      const x = (i - rays / 2) * (diag / rays) + sway
      const width = diag / rays * 0.5
      const g = ctx.createLinearGradient(x, -diag, x, diag)
      const a = this.intensity * (0.12 + 0.06 * Math.sin(this.t * 0.7 + i))
      g.addColorStop(0, 'rgba(255,244,200,0)')
      g.addColorStop(0.5, `rgba(255,244,200,${a})`)
      g.addColorStop(1, 'rgba(255,244,200,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - width / 2, -diag, width, diag * 2)
    }
    ctx.restore()
  }
}

/** EffectSpec から具体的なエフェクト実装を生成する */
export function createEffect(spec: EffectSpec): Effect {
  switch (spec.type) {
    case 'rain':
      return new RainEffect(spec.intensity)
    case 'snow':
      return new SnowEffect(spec.intensity)
    case 'sparkle':
      return new SparkleEffect(spec.intensity)
    case 'dust':
      return new DustEffect(spec.intensity)
    case 'bokeh':
      return new BokehEffect(spec.intensity)
    case 'lightrays':
      return new LightRaysEffect(spec.intensity, spec.angleDeg ?? 30)
    default:
      // 未知のエフェクトは無描画のダミー
      return { update: () => {}, draw: () => {} }
  }
}
