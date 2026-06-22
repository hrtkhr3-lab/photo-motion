import {
  defaultSpec,
  type AspectRatio,
  type EffectSpec,
  type Spec,
} from '../types'

export interface InterpretOptions {
  aspectRatio: AspectRatio
  durationSec: number
}

interface Rule {
  /** マッチさせる語（日本語・英語）。小文字で比較 */
  keywords: string[]
  apply: (spec: Spec) => void
}

function addEffect(spec: Spec, e: EffectSpec) {
  // 同種エフェクトの重複を避ける
  if (!spec.effects.some((x) => x.type === e.type)) spec.effects.push(e)
}

// 各ルールは spec を破壊的に編集する。後勝ち。
const RULES: Rule[] = [
  // --- カメラ：寄る / 引く / パン ---
  {
    keywords: ['寄っ', '寄る', 'ズームイン', 'ズーム', '近づ', '接近', 'zoom in', 'zoom', 'closer', 'push in'],
    apply: (s) => {
      s.camera.zoomFrom = 1.0
      s.camera.zoomTo = 1.28
    },
  },
  {
    keywords: ['引い', '引く', 'ズームアウト', '遠ざか', '離れ', 'zoom out', 'pull back', 'pull out'],
    apply: (s) => {
      s.camera.zoomFrom = 1.28
      s.camera.zoomTo = 1.02
    },
  },
  {
    keywords: ['パン', '流れ', '横に', '横へ', 'スライド', 'pan', 'slide', 'drift'],
    apply: (s) => {
      s.camera.zoomFrom = Math.max(s.camera.zoomFrom, 1.12)
      s.camera.zoomTo = Math.max(s.camera.zoomTo, 1.12)
      s.camera.panFrom = [-0.06, 0]
      s.camera.panTo = [0.06, 0]
    },
  },
  // --- パーティクル / オーバーレイ ---
  {
    keywords: ['雨', 'あめ', 'rain', 'rainy'],
    apply: (s) => addEffect(s, { type: 'rain', intensity: 0.5 }),
  },
  {
    keywords: ['雪', 'ゆき', 'snow', 'snowy'],
    apply: (s) => addEffect(s, { type: 'snow', intensity: 0.5 }),
  },
  {
    keywords: ['光', '木漏れ日', '光線', '陽射し', '日差し', 'lightray', 'light ray', 'rays', 'sunlight', 'sunbeam'],
    apply: (s) => addEffect(s, { type: 'lightrays', intensity: 0.35, angleDeg: 30 }),
  },
  {
    keywords: ['キラキラ', 'きらきら', 'キラめ', '輝', 'sparkle', 'glitter', 'shimmer'],
    apply: (s) => addEffect(s, { type: 'sparkle', intensity: 0.5 }),
  },
  {
    keywords: ['ほこり', 'ダスト', '埃', 'dust', 'mote'],
    apply: (s) => addEffect(s, { type: 'dust', intensity: 0.4 }),
  },
  {
    keywords: ['ボケ', '玉ボケ', 'ぼけ', 'bokeh', 'orb'],
    apply: (s) => addEffect(s, { type: 'bokeh', intensity: 0.5 }),
  },
  // --- 色 / ライティング ---
  {
    keywords: ['夕暮れ', '夕焼け', '夕方', '夕日', 'たそがれ', 'dusk', 'sunset', 'golden hour', 'evening'],
    apply: (s) => {
      s.color.mood = 'dusk'
      s.color.brightnessCurve = 'darken'
    },
  },
  {
    keywords: ['朝焼け', '朝日', '朝', '夜明け', 'morning', 'dawn', 'sunrise'],
    apply: (s) => {
      s.color.mood = 'morning'
      s.color.brightnessCurve = 'brighten'
    },
  },
  {
    keywords: ['夜', 'ナイト', '深夜', 'night', 'midnight', 'nocturnal'],
    apply: (s) => {
      s.color.mood = 'night'
    },
  },
  {
    keywords: ['暖か', '暖色', 'あたたか', 'ぽかぽか', 'warm', 'cozy'],
    apply: (s) => {
      s.color.mood = 'warm'
    },
  },
  {
    keywords: ['寒色', 'クール', '涼し', '冷た', 'cool', 'cold', 'chilly'],
    apply: (s) => {
      s.color.mood = 'cool'
    },
  },
  // --- 複合ムード ---
  {
    keywords: ['ドラマチック', 'シネマ', '映画', 'ドラマ', 'dramatic', 'cinematic', 'epic'],
    apply: (s) => {
      s.color.vignette = Math.max(s.color.vignette, 0.4)
      s.color.brightnessCurve = s.color.brightnessCurve === 'none' ? 'darken' : s.color.brightnessCurve
      s.camera.zoomFrom = 1.0
      s.camera.zoomTo = Math.max(s.camera.zoomTo, 1.18)
      s.camera.easing = 'easeInOut'
    },
  },
  {
    keywords: ['幻想', 'ファンタジー', '夢', 'メルヘン', 'dreamy', 'fantasy', 'magical', 'ethereal'],
    apply: (s) => {
      addEffect(s, { type: 'bokeh', intensity: 0.45 })
      addEffect(s, { type: 'sparkle', intensity: 0.35 })
      s.color.brightnessCurve = 'pulse'
    },
  },
  // --- 微細モーション ---
  {
    keywords: ['風', 'そよ風', 'なびく', 'なびか', '揺れ', 'wind', 'breeze', 'sway', 'breath'],
    apply: (s) => {
      s.motion.sway = Math.max(s.motion.sway, 0.05)
    },
  },
  // --- テンポ ---
  {
    keywords: ['ゆっくり', 'のんびり', 'スロー', 'slow', 'gentle', 'calm'],
    apply: (s) => {
      s.durationSec = Math.min(8, s.durationSec + 2)
      s.camera.easing = 'easeInOut'
    },
  },
  {
    keywords: ['速く', '素早', 'ダイナミック', 'fast', 'quick', 'rapid', 'dynamic'],
    apply: (s) => {
      s.durationSec = Math.max(4, s.durationSec - 1)
    },
  },
]

/**
 * 自然文のお題 → 演出仕様(JSON)。0円・オフライン・確実に動くベースライン。
 * 何も語にマッチしなくても、必ず最低限の Ken Burns で“動いて見える”仕様を返す。
 */
export function interpretPrompt(prompt: string, opts: InterpretOptions): Spec {
  const spec = defaultSpec(opts.aspectRatio)
  spec.durationSec = opts.durationSec

  const text = prompt.toLowerCase()
  let matched = false
  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k.toLowerCase()))) {
      rule.apply(spec)
      matched = true
    }
  }

  // 何もマッチしない場合でも、ゆるい寄り（既定 Ken Burns）で動きを保証する。
  if (!matched) {
    spec.camera.zoomTo = 1.14
    spec.camera.panTo = [0.05, -0.03]
  }

  // ズームは 1.0 未満にしない（パン時に画像端が見えるのを防ぐ）
  spec.camera.zoomFrom = Math.max(1.0, spec.camera.zoomFrom)
  spec.camera.zoomTo = Math.max(1.0, spec.camera.zoomTo)

  return spec
}

/** プリセット：押すとお題テキストに語を挿入する */
export interface Preset {
  id: string
  label: string
  phrase: string
}

export const PRESETS: Preset[] = [
  { id: 'zoom', label: '🔍 寄る', phrase: 'ゆっくり寄っていく' },
  { id: 'pan', label: '↔️ パン', phrase: '横に流れるようにパン' },
  { id: 'rain', label: '🌧️ 雨', phrase: '雨が降る' },
  { id: 'snow', label: '❄️ 雪', phrase: '雪が舞う' },
  { id: 'light', label: '🌤️ 光', phrase: '木漏れ日の光線' },
  { id: 'sparkle', label: '✨ キラキラ', phrase: 'キラキラ輝く' },
  { id: 'dusk', label: '🌇 夕暮れ', phrase: '夕暮れの中をゆっくり寄っていく' },
  { id: 'dramatic', label: '🎬 ドラマチック', phrase: 'シネマティックにドラマチックに寄る' },
  { id: 'dreamy', label: '🪄 幻想的', phrase: '幻想的な雰囲気でキラキラと' },
  { id: 'wind', label: '🍃 そよ風', phrase: 'そよ風で揺れる' },
]
