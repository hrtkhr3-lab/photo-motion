import type { AspectRatio, Spec } from '../types'
import type { DepthMap } from '../depth/estimateDepth'
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
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

  /** デプス由来の前景（人物）レイヤー。null ならパララックスなし */
  private fgCanvas: HTMLCanvasElement | null = null

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
    // 画像が変わったら前景レイヤーは無効化（再推定が必要）
    this.fgCanvas = null
  }

  /** 前景レイヤーがあるか（= パララックス利用可能か） */
  get hasDepth(): boolean {
    return this.fgCanvas !== null
  }

  /**
   * デプスマップから前景(人物)レイヤーを構築する。
   * 近い(値が大きい)画素ほど不透明にして、人物だけを切り出す。
   */
  setDepth(depth: DepthMap) {
    const img = this.img
    if (!img) return
    const maxW = 1280
    const scale = Math.min(1, maxW / img.naturalWidth)
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))

    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cx = c.getContext('2d')
    if (!cx) return
    cx.drawImage(img, 0, 0, w, h)
    const id = cx.getImageData(0, 0, w, h)

    // 近さの分布から閾値を自動決定（上位 ~45% を前景候補に）
    const ch = depth.channels
    const dw = depth.width
    const dh = depth.height
    const hist = new Array(256).fill(0)
    for (let i = 0; i < dw * dh; i++) hist[depth.data[i * ch]]++
    const target = dw * dh * 0.45
    let acc = 0
    let thr = 128
    for (let v = 255; v >= 0; v--) {
      acc += hist[v]
      if (acc >= target) {
        thr = v
        break
      }
    }
    const edge0 = Math.max(0, (thr - 28) / 255)
    const edge1 = Math.min(1, (thr + 28) / 255)

    for (let y = 0; y < h; y++) {
      const dy = Math.min(dh - 1, Math.floor((y / h) * dh))
      for (let x = 0; x < w; x++) {
        const dx = Math.min(dw - 1, Math.floor((x / w) * dw))
        const near = depth.data[(dy * dw + dx) * ch] / 255
        const a = smoothstep(edge0, edge1, near)
        id.data[(y * w + x) * 4 + 3] = Math.round(a * 255)
      }
    }
    cx.putImageData(id, 0, 0)
    this.fgCanvas = c
  }

  clearDepth() {
    this.fgCanvas = null
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

    const time = t * spec.durationSec
    if (spec.motion.sway > 0) {
      panX += Math.sin(time * 1.6) * spec.motion.sway * 0.5
      panY += Math.cos(time * 1.1) * spec.motion.sway * 0.3
    }

    const useParallax = spec.parallax.enabled && this.fgCanvas !== null

    if (img) {
      if (useParallax && this.fgCanvas) {
        const strength = spec.parallax.strength
        // 背景：少しぼかして奥行き感を出す（前景の輪郭ゴーストも目立ちにくくなる）
        ctx.save()
        ctx.filter = 'blur(2px)'
        this.drawCover(img, img.naturalWidth, img.naturalHeight, w, h, zoom * 1.02, panX, panY)
        ctx.restore()

        // 前景(人物)：背景より大きく動かして視差を作る + 独立した微細揺れで“生きている”感
        const fgPanX = panX * (1 + strength) + Math.sin(time * 1.3) * strength * 0.012
        const fgPanY = panY * (1 + strength) + Math.cos(time * 0.9) * strength * 0.006
        this.drawCover(
          this.fgCanvas,
          this.fgCanvas.width,
          this.fgCanvas.height,
          w,
          h,
          zoom * (1 + strength * 0.06),
          fgPanX,
          fgPanY,
        )
      } else {
        this.drawCover(img, img.naturalWidth, img.naturalHeight, w, h, zoom, panX, panY)
      }
    }

    // --- 色・ライティング ---
    applyColorGrade(ctx, w, h, spec.color, t)

    // --- エフェクト ---
    for (const fx of this.effects) {
      fx.update(dt, w, h)
      fx.draw(ctx, w, h, t)
    }
  }

  /** object-fit: cover 相当でズーム・パンを適用して描画（画像/キャンバス両対応） */
  private drawCover(
    src: CanvasImageSource,
    srcW: number,
    srcH: number,
    cw: number,
    ch: number,
    zoom: number,
    panX: number,
    panY: number,
  ) {
    const imgRatio = srcW / srcH
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
    this.ctx.drawImage(src, x, y, drawW, drawH)
  }

  /** 静止状態で最初のフレームを描画（プレビュー前の表示用） */
  renderStill() {
    this.renderAt(0, 0)
  }
}
