import type { AspectRatio, Spec } from '../types'
import { applyColorGrade } from './colorgrade'
import { applyEasing, lerp } from './easing'
import { createEffect, type Effect } from './effects'

/** アスペクト比 → 描画解像度 */
export function canvasSizeFor(aspect: AspectRatio): { w: number; h: number } {
  switch (aspect) {
    case '9:16':
      return { w: 720, h: 1280 }
    case '1:1':
      return { w: 960, h: 960 }
    case '16:9':
    default:
      return { w: 1280, h: 720 }
  }
}

interface PlayOptions {
  loop: boolean
  onComplete?: () => void
}

/**
 * 演出仕様(JSON)に従って写真をアニメーション描画する。
 * preview（ループ再生）と export（1ループ録画）の両方で同じ描画パスを使う。
 */
export class MotionRenderer {
  private ctx: CanvasRenderingContext2D
  private img: HTMLImageElement | null = null
  private spec: Spec | null = null
  private effects: Effect[] = []

  private raf = 0
  private startT = 0
  private lastT = 0
  private playing = false
  private opts: PlayOptions = { loop: true }

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D コンテキストを取得できませんでした')
    this.ctx = ctx
  }

  setImage(img: HTMLImageElement) {
    this.img = img
  }

  /** 演出仕様をセット。キャンバス解像度の更新とエフェクトの再構築を行う */
  setSpec(spec: Spec) {
    this.spec = spec
    const { w, h } = canvasSizeFor(spec.aspectRatio)
    this.canvas.width = w
    this.canvas.height = h
    this.effects = spec.effects.map(createEffect)
  }

  get durationSec(): number {
    return this.spec?.durationSec ?? 6
  }

  play(opts: PlayOptions) {
    this.stop()
    this.opts = opts
    this.playing = true
    this.startT = performance.now()
    this.lastT = this.startT
    this.effects = this.spec ? this.spec.effects.map(createEffect) : []
    this.raf = requestAnimationFrame(this.frame)
  }

  stop() {
    this.playing = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private frame = (now: number) => {
    if (!this.playing || !this.spec) return
    const dt = Math.min(0.05, (now - this.lastT) / 1000)
    this.lastT = now

    const elapsed = (now - this.startT) / 1000
    let t = elapsed / this.spec.durationSec

    if (t >= 1) {
      if (this.opts.loop) {
        this.startT = now
        t = 0
      } else {
        this.renderAt(1, dt)
        this.playing = false
        this.opts.onComplete?.()
        return
      }
    }

    this.renderAt(t, dt)
    this.raf = requestAnimationFrame(this.frame)
  }

  /** 単一フレームを描画。t は 0..1 の進捗、dt はエフェクト更新用 */
  private renderAt(t: number, dt: number) {
    const { ctx, spec, img } = this
    if (!spec) return
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    // --- カメラ（Ken Burns）+ 微細な揺れ ---
    const e = applyEasing(t, spec.camera.easing)
    const zoom = lerp(spec.camera.zoomFrom, spec.camera.zoomTo, e)
    let panX = lerp(spec.camera.panFrom[0], spec.camera.panTo[0], e)
    let panY = lerp(spec.camera.panFrom[1], spec.camera.panTo[1], e)

    if (spec.motion.sway > 0) {
      const time = t * spec.durationSec
      panX += Math.sin(time * 1.6) * spec.motion.sway * 0.5
      panY += Math.cos(time * 1.1) * spec.motion.sway * 0.3
    }

    if (img) this.drawCover(img, w, h, zoom, panX, panY)

    // --- 色・ライティング ---
    applyColorGrade(ctx, w, h, spec.color, t)

    // --- エフェクト ---
    for (const fx of this.effects) {
      fx.update(dt, w, h)
      fx.draw(ctx, w, h, t)
    }
  }

  /** object-fit: cover 相当でズーム・パンを適用して画像を描画 */
  private drawCover(
    img: HTMLImageElement,
    cw: number,
    ch: number,
    zoom: number,
    panX: number,
    panY: number,
  ) {
    const imgRatio = img.width / img.height
    const canvasRatio = cw / ch
    let drawW: number
    let drawH: number
    if (imgRatio > canvasRatio) {
      drawH = ch * zoom
      drawW = drawH * imgRatio
    } else {
      drawW = cw * zoom
      drawH = drawW / imgRatio
    }
    const x = (cw - drawW) / 2 + panX * cw
    const y = (ch - drawH) / 2 + panY * ch
    this.ctx.drawImage(img, x, y, drawW, drawH)
  }

  /** 静止状態で最初のフレームを描画（プレビュー前の表示用） */
  renderStill() {
    this.renderAt(0, 0)
  }
}
