import { useEffect, useRef, useState } from 'react'
import { Presets } from './components/Presets'
import { PromptInput } from './components/PromptInput'
import { Player } from './components/Player'
import { Uploader } from './components/Uploader'
import { interpretPrompt } from './interpret/rules'
import { estimateDepth, isDepthLikelySupported } from './depth/estimateDepth'
import { isRecordingSupported, recordCanvas } from './render/recorder'
import { MotionRenderer } from './render/renderer'
import type { AspectRatio } from './types'

type DepthStatus = 'idle' | 'loading' | 'ready' | 'error'

const ASPECTS: AspectRatio[] = ['16:9', '9:16', '1:1']

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<MotionRenderer | null>(null)
  const imageElRef = useRef<HTMLImageElement | null>(null)

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [aspect, setAspect] = useState<AspectRatio>('16:9')
  const [duration, setDuration] = useState(6)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [parallaxOn, setParallaxOn] = useState(false)
  const [depthStatus, setDepthStatus] = useState<DepthStatus>('idle')

  // 最新値を effect 内から参照するための ref
  const promptRef = useRef(prompt)
  const previewingRef = useRef(isPreviewing)
  const parallaxOnRef = useRef(parallaxOn)
  promptRef.current = prompt
  previewingRef.current = isPreviewing
  parallaxOnRef.current = parallaxOn

  // レンダラ初期化
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      try {
        rendererRef.current = new MotionRenderer(canvasRef.current)
      } catch (err) {
        setError(err instanceof Error ? err.message : '初期化に失敗しました')
      }
    }
    return () => rendererRef.current?.stop()
  }, [])

  // 後片付け（URL 解放）
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 現在の状態から演出仕様を作って適用し、再生 or 静止描画する */
  function applyAndRender(play: boolean) {
    const r = rendererRef.current
    const img = imageElRef.current
    if (!r || !img) return
    const spec = interpretPrompt(promptRef.current, {
      aspectRatio: aspect,
      durationSec: duration,
    })
    // パララックスは「トグルON かつ デプス分離済み」のときだけ有効化
    spec.parallax.enabled = parallaxOnRef.current && r.hasDepth
    spec.parallax.strength = 0.5
    r.setSpec(spec)
    if (play) {
      r.play({ loop: true })
      setIsPreviewing(true)
    } else {
      r.stop()
      r.renderStill()
      setIsPreviewing(false)
    }
  }

  /** デプス推定を実行して前景レイヤーを用意する（未計算なら計算） */
  async function ensureDepth(): Promise<boolean> {
    const r = rendererRef.current
    if (!r || !imageElRef.current || !imageUrl) return false
    if (r.hasDepth) return true
    setDepthStatus('loading')
    setError(null)
    try {
      const dm = await estimateDepth(imageUrl)
      r.setDepth(dm)
      setDepthStatus('ready')
      return true
    } catch (err) {
      console.error(err)
      setDepthStatus('error')
      setError('奥行き推定に失敗しました（この環境では未対応の可能性）。パララックスをオフにします。')
      return false
    }
  }

  async function handleParallaxToggle(on: boolean) {
    setParallaxOn(on)
    parallaxOnRef.current = on
    if (on) {
      const ok = await ensureDepth()
      if (!ok) {
        setParallaxOn(false)
        parallaxOnRef.current = false
      }
    }
    applyAndRender(previewingRef.current)
  }

  // アスペクト比・長さ変更時は再適用（プレビュー中なら再生継続、それ以外は静止）
  useEffect(() => {
    if (!imageElRef.current) return
    applyAndRender(previewingRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, duration])

  function handleImage(img: HTMLImageElement, url: string, _name: string) {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
      setVideoUrl(null)
    }
    imageElRef.current = img
    rendererRef.current?.setImage(img) // 画像確定（前景レイヤーはリセットされる）
    setImageUrl(url)
    setDepthStatus('idle')
    setError(null)
    // 読み込んだら静止プレビューを表示。パララックスONなら新画像でデプス再計算
    requestAnimationFrame(async () => {
      if (parallaxOnRef.current) {
        const ok = await ensureDepth()
        if (!ok) {
          setParallaxOn(false)
          parallaxOnRef.current = false
        }
      }
      applyAndRender(previewingRef.current)
    })
  }

  function handlePreview() {
    if (!imageElRef.current) {
      setError('先に写真をアップロードしてください。')
      return
    }
    setError(null)
    applyAndRender(true)
  }

  async function handleSave() {
    const r = rendererRef.current
    const canvas = canvasRef.current
    if (!r || !canvas || !imageElRef.current) {
      setError('先に写真をアップロードしてください。')
      return
    }
    if (!isRecordingSupported()) {
      setError('このブラウザは録画に対応していません。Chrome を推奨します。')
      return
    }
    // 録画用に最新の仕様を適用（再生はまだしない）。setImage は呼ばない（デプスを保持）
    const spec = interpretPrompt(promptRef.current, {
      aspectRatio: aspect,
      durationSec: duration,
    })
    spec.parallax.enabled = parallaxOnRef.current && r.hasDepth
    spec.parallax.strength = 0.5
    r.setSpec(spec)

    setError(null)
    setIsRecording(true)
    setIsPreviewing(false)
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
      setVideoUrl(null)
    }
    try {
      const { blob } = await recordCanvas(canvas, r, 30)
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '動画の保存に失敗しました')
    } finally {
      setIsRecording(false)
      // 録画後はプレビュー再生に戻す
      applyAndRender(true)
    }
  }

  const hasImage = !!imageUrl

  return (
    <div className="app">
      <header className="app-header">
        <h1>写真モーション</h1>
        <p className="tagline">写真をお題どおりに動かして動画にする・完全無料・APIキー不要</p>
      </header>

      <p className="method-note">
        ※ 本アプリは写真の被写体を生成AIで動かすものではありません。1枚の写真に
        <strong>カメラワーク・エフェクト・色変化</strong>を重ねて“動いて見える”演出をつけ、すべて
        <strong>ブラウザ内・無料</strong>で処理します。
      </p>

      <div className="layout">
        {/* 左：操作パネル */}
        <section className="panel">
          <Uploader onImage={handleImage} onError={setError} currentUrl={imageUrl} />

          <PromptInput value={prompt} onChange={setPrompt} disabled={isRecording} />
          <Presets onPick={(ph) => setPrompt((v) => (v ? `${v} ${ph}` : ph))} disabled={isRecording} />

          <div className="field">
            <label>アスペクト比</label>
            <div className="seg">
              {ASPECTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`seg-btn ${aspect === a ? 'active' : ''}`}
                  disabled={isRecording}
                  onClick={() => setAspect(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="dur">長さ：{duration} 秒</label>
            <input
              id="dur"
              type="range"
              min={4}
              max={8}
              step={1}
              value={duration}
              disabled={isRecording}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="check">
              <input
                type="checkbox"
                checked={parallaxOn}
                disabled={isRecording || depthStatus === 'loading' || !hasImage}
                onChange={(e) => handleParallaxToggle(e.target.checked)}
              />
              奥行きパララックス（人物を立体的に動かす・試験的）
            </label>
            {depthStatus === 'loading' && (
              <small>🧠 AIモデルを読み込み中…（初回のみ数十MB・無料・キー不要）</small>
            )}
            {depthStatus === 'ready' && parallaxOn && (
              <small>✓ 人物と背景を分離しました。プレビューで動きを確認できます</small>
            )}
            {!isDepthLikelySupported() && (
              <small>※ この環境では利用できない可能性があります</small>
            )}
          </div>

          {error && <div className="error">⚠️ {error}</div>}

          <div className="actions">
            <button
              type="button"
              className="btn primary"
              disabled={!hasImage || isRecording}
              onClick={handlePreview}
            >
              ▶ プレビュー生成
            </button>
            <button
              type="button"
              className="btn"
              disabled={!hasImage || isRecording}
              onClick={handleSave}
            >
              💾 動画として保存（webm）
            </button>
          </div>
        </section>

        {/* 右：プレビュー＆結果 */}
        <section className="stage">
          <Player
            canvasRef={canvasRef}
            aspectRatio={aspect}
            hasImage={hasImage}
            busy={isRecording || depthStatus === 'loading'}
            busyLabel={
              isRecording ? '録画中…（数秒お待ちください）' : 'AIで奥行きを解析中…'
            }
          />

          {videoUrl && (
            <div className="result">
              <h3>できあがり 🎉</h3>
              <video src={videoUrl} controls loop className="result-video" />
              <div className="result-actions">
                <a className="btn primary" href={videoUrl} download="photo-motion.webm">
                  ⬇ ダウンロード
                </a>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    URL.revokeObjectURL(videoUrl)
                    setVideoUrl(null)
                  }}
                >
                  もう一度作る
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="app-footer">
        ランニングコスト 0円 / 課金・APIキーなし ・ 対応ブラウザ：Chrome 推奨（録画は webm）
      </footer>
    </div>
  )
}
