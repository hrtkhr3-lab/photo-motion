import { useEffect, useRef, useState } from 'react'
import { Presets } from './components/Presets'
import { PromptInput } from './components/PromptInput'
import { Player } from './components/Player'
import { Uploader } from './components/Uploader'
import { interpretPrompt } from './interpret/rules'
import { isRecordingSupported, recordCanvas } from './render/recorder'
import { MotionRenderer } from './render/renderer'
import type { AspectRatio } from './types'

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

  // 最新値を effect 内から参照するための ref
  const promptRef = useRef(prompt)
  const previewingRef = useRef(isPreviewing)
  promptRef.current = prompt
  previewingRef.current = isPreviewing

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
    r.setImage(img)
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
    setImageUrl(url)
    setError(null)
    // 読み込んだら静止プレビューを表示
    requestAnimationFrame(() => applyAndRender(false))
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
    // 録画用に最新の仕様を適用（再生はまだしない）
    const spec = interpretPrompt(promptRef.current, {
      aspectRatio: aspect,
      durationSec: duration,
    })
    r.setImage(imageElRef.current)
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
            busy={isRecording}
            busyLabel="録画中…（数秒お待ちください）"
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
