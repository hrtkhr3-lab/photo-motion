// 単眼デプス推定（MiDaS/Depth-Anything 系）をブラウザ内で実行する。
// モデルは HuggingFace の CDN から取得（無料・APIキー不要）。
// WebGPU があれば使用、なければ WASM(CPU) にフォールバック。
//
// 出力は「前景の近さ weight（0..255, 大きいほど手前）」のグレースケールマップ。
// レンダラ側はこれで前景(人物)と背景を分離してパララックスをかける。

export interface DepthMap {
  width: number
  height: number
  /** グレースケール（channels ごとに格納）。値が大きいほど手前 */
  data: Uint8ClampedArray | Uint8Array
  channels: number
}

// 動的 import で本体を遅延ロードし、初期バンドルを軽く保つ
let pipePromise: Promise<(src: string) => Promise<unknown>> | null = null

async function getDepthPipeline() {
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      // ローカルモデルは見に行かず、必ず HF CDN から取得
      env.allowLocalModels = false
      const device =
        typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm'
      const pipe = await pipeline(
        'depth-estimation',
        'onnx-community/depth-anything-v2-small',
        // 型定義が device を狭く取るため any 経由で渡す
        { device } as unknown as Record<string, never>,
      )
      return (src: string) => pipe(src) as Promise<unknown>
    })()
  }
  return pipePromise
}

/** この環境でデプス推定を試せそうかの簡易判定（WASM は重いが一応可） */
export function isDepthLikelySupported(): boolean {
  if (typeof navigator === 'undefined') return false
  if ('gpu' in navigator) return true
  // WebGPU が無くても WASM で動くが、重いので true にしておく（UIで注意喚起する）
  return typeof WebAssembly !== 'undefined'
}

export async function estimateDepth(imageSrc: string): Promise<DepthMap> {
  const run = await getDepthPipeline()
  const out = (await run(imageSrc)) as
    | { depth: { data: Uint8ClampedArray | Uint8Array; width: number; height: number; channels: number } }
    | Array<{ depth: { data: Uint8ClampedArray | Uint8Array; width: number; height: number; channels: number } }>

  const result = Array.isArray(out) ? out[0] : out
  const depth = result.depth
  return {
    width: depth.width,
    height: depth.height,
    data: depth.data,
    channels: depth.channels ?? 1,
  }
}
