import type { MotionRenderer } from './renderer'

export interface RecordResult {
  blob: Blob
  mimeType: string
  ext: string
}

/** 環境で使える webm の mimeType を選ぶ */
function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c
    }
  }
  return 'video/webm'
}

export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  )
}

/**
 * キャンバスを1ループぶん録画して webm Blob を返す。
 * 録画開始 → renderer を loop:false で再生 → onComplete で停止。
 */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  renderer: MotionRenderer,
  fps = 30,
): Promise<RecordResult> {
  return new Promise((resolve, reject) => {
    if (!isRecordingSupported()) {
      reject(new Error('このブラウザは録画(MediaRecorder)に対応していません。Chrome を推奨します。'))
      return
    }
    const mimeType = pickMimeType()
    let stream: MediaStream
    let recorder: MediaRecorder
    try {
      stream = canvas.captureStream(fps)
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }

    const chunks: BlobPart[] = []
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data)
    }
    recorder.onerror = () => {
      renderer.stop()
      reject(new Error('録画中にエラーが発生しました'))
    }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      resolve({ blob, mimeType, ext: 'webm' })
    }

    recorder.start()
    renderer.play({
      loop: false,
      onComplete: () => {
        // 最終フレームを確実に取り込むため少し待ってから停止
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop()
        }, 120)
      },
    })
  })
}
