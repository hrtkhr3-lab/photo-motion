import type { RefObject } from 'react'
import type { AspectRatio } from '../types'

interface Props {
  canvasRef: RefObject<HTMLCanvasElement>
  aspectRatio: AspectRatio
  hasImage: boolean
  busy?: boolean
  busyLabel?: string
}

const RATIO_CLASS: Record<AspectRatio, string> = {
  '16:9': 'ratio-16-9',
  '9:16': 'ratio-9-16',
  '1:1': 'ratio-1-1',
}

export function Player({ canvasRef, aspectRatio, hasImage, busy, busyLabel }: Props) {
  return (
    <div className={`player ${RATIO_CLASS[aspectRatio]}`}>
      <canvas ref={canvasRef} className={hasImage ? '' : 'hidden'} />
      {!hasImage && (
        <div className="player-placeholder">
          写真をアップロードすると
          <br />
          ここにプレビューが表示されます
        </div>
      )}
      {busy && (
        <div className="player-overlay">
          <div className="spinner" />
          <span>{busyLabel ?? '処理中…'}</span>
        </div>
      )}
    </div>
  )
}
