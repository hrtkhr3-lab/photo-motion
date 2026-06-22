import { useCallback, useRef, useState } from 'react'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 15 * 1024 * 1024 // 15MB

interface Props {
  onImage: (img: HTMLImageElement, url: string, name: string) => void
  onError: (msg: string) => void
  currentUrl: string | null
}

export function Uploader({ onImage, onError, currentUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED.includes(file.type)) {
        onError('対応形式は JPG / PNG / WebP です。')
        return
      }
      if (file.size > MAX_BYTES) {
        onError('ファイルサイズが大きすぎます（上限 15MB）。')
        return
      }
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => onImage(img, url, file.name)
      img.onerror = () => {
        URL.revokeObjectURL(url)
        onError('画像を読み込めませんでした。')
      }
      img.src = url
    },
    [onImage, onError],
  )

  return (
    <div
      className={`uploader ${dragOver ? 'dragover' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFile(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
      {currentUrl ? (
        <div className="uploader-preview">
          <img src={currentUrl} alt="アップロードした写真" />
          <span className="uploader-hint">クリック / ドロップで差し替え</span>
        </div>
      ) : (
        <div className="uploader-empty">
          <div className="uploader-icon">🖼️</div>
          <p>
            <strong>写真をドラッグ＆ドロップ</strong>
            <br />
            またはクリックして選択
          </p>
          <small>JPG / PNG / WebP・最大 15MB</small>
        </div>
      )}
    </div>
  )
}
