import { PRESETS } from '../interpret/rules'

interface Props {
  onPick: (phrase: string) => void
  disabled?: boolean
}

export function Presets({ onPick, disabled }: Props) {
  return (
    <div className="field">
      <label>プリセット（押すとお題に追加）</label>
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="preset-btn"
            disabled={disabled}
            onClick={() => onPick(p.phrase)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
