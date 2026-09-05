// Shared settings-row primitives, used by both the in-game settings views
// in GameMenu.jsx and the newer Graphics/Accessibility/Game screens in
// SettingsViews.jsx - one definition rather than a copy per screen.

export function Slider({ label, value, min = 0, max = 1, step = 0.01, onChange, format }) {
  return (
    <div className="game-menu-slider-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="game-menu-slider-value">{format ? format(value) : Math.round(value * 100) + '%'}</span>
    </div>
  )
}

// `options` is a list of { id, label } - the same shape DIFFICULTIES,
// TEXT_SIZES and COLORBLIND_MODES already use, so those lists can be passed
// straight through without remapping.
export function SelectRow({ label, value, options, onChange }) {
  return (
    <div className="game-menu-preset-row">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="game-menu-toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}
