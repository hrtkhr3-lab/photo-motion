interface Props {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export function PromptInput({ value, onChange, disabled }: Props) {
  return (
    <div className="field">
      <label htmlFor="prompt">お題（どう動かしたいか）</label>
      <textarea
        id="prompt"
        value={value}
        disabled={disabled}
        placeholder="例：夕暮れの中をゆっくり寄っていく / 雨が降る幻想的な雰囲気"
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
