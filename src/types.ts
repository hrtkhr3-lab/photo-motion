// 演出仕様(JSON)の型。
// この型を境界として、解釈器(A: ルール/LLM)の実装を差し替えても
// レンダラ側は一切変更不要にする。

export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export type AspectRatio = '16:9' | '9:16' | '1:1'

/** カラーグレードの雰囲気 */
export type Mood = 'none' | 'dusk' | 'morning' | 'night' | 'warm' | 'cool'

/** 明るさの時間変化カーブ */
export type BrightnessCurve = 'none' | 'darken' | 'brighten' | 'pulse'

/** パーティクル/オーバーレイ系エフェクトの種類 */
export type EffectType =
  | 'rain'
  | 'snow'
  | 'lightrays'
  | 'sparkle'
  | 'dust'
  | 'bokeh'

export interface CameraSpec {
  /** ズーム開始倍率 (>=1 推奨) */
  zoomFrom: number
  /** ズーム終了倍率 */
  zoomTo: number
  /** パン開始位置。キャンバス幅・高さに対する割合 [-0.5..0.5] */
  panFrom: [number, number]
  /** パン終了位置 */
  panTo: [number, number]
  easing: Easing
}

export interface EffectSpec {
  type: EffectType
  /** 強度 0..1 */
  intensity: number
  /** lightrays 等の角度（度） */
  angleDeg?: number
}

export interface ColorSpec {
  mood: Mood
  /** ビネット強度 0..1 */
  vignette: number
  brightnessCurve: BrightnessCurve
}

export interface ParallaxSpec {
  /** 奥行きパララックス（任意・デプス推定が必要）。Step5で有効化 */
  enabled: boolean
  /** 視差の強さ 0..1 */
  strength: number
}

export interface MotionSpec {
  /** そよ風のような微細な揺れ 0..1 */
  sway: number
}

/** 演出仕様(JSON) 本体 */
export interface Spec {
  durationSec: number
  aspectRatio: AspectRatio
  camera: CameraSpec
  parallax: ParallaxSpec
  effects: EffectSpec[]
  color: ColorSpec
  motion: MotionSpec
}

/** 既定の演出仕様（何も指定が解釈できなかった場合のベースライン） */
export function defaultSpec(aspectRatio: AspectRatio = '16:9'): Spec {
  return {
    durationSec: 6,
    aspectRatio,
    camera: {
      zoomFrom: 1.0,
      zoomTo: 1.12,
      panFrom: [0, 0],
      panTo: [0.04, -0.02],
      easing: 'easeInOut',
    },
    parallax: { enabled: false, strength: 0.3 },
    effects: [],
    color: { mood: 'none', vignette: 0.18, brightnessCurve: 'none' },
    motion: { sway: 0.0 },
  }
}
