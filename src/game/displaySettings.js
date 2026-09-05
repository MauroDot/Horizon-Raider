// Accessibility settings that live on the document rather than in the 3D
// scene: text size and colourblind palette are pure presentation, so they
// are applied as data attributes on <html> and CSS does the rest (see
// index.css). Kept out of controlConfig.js itself so that file stays a
// plain settings store with no DOM knowledge.

export const TEXT_SIZES = [
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Large' },
  { id: 'larger', label: 'Larger' },
]

// Only the colours that actually carry meaning need remapping - hostile,
// friendly/safe, and objective. Each mode keeps those three mutually
// distinguishable for that form of colour blindness (the default green/red
// pair is the classic problem case for the two red-green types).
export const COLORBLIND_MODES = [
  { id: 'off', label: 'Off' },
  { id: 'deuteranopia', label: 'Deuteranopia (red-green)' },
  { id: 'protanopia', label: 'Protanopia (red-green)' },
  { id: 'tritanopia', label: 'Tritanopia (blue-yellow)' },
]

// The canvas-drawn minimap can't read CSS custom properties, so the same
// palettes are mirrored here for Hud.jsx to pass into drawMinimap.
export const MINIMAP_PALETTES = {
  off: { heli: '#ff6a5a', vehicle: '#ff9a3a', objective: '#ffce54', player: '#7fe9c0' },
  deuteranopia: { heli: '#ff8c1a', vehicle: '#d94fd9', objective: '#4fc3ff', player: '#ffffff' },
  protanopia: { heli: '#ffa61a', vehicle: '#c46bff', objective: '#3fb9ff', player: '#ffffff' },
  tritanopia: { heli: '#ff4d6d', vehicle: '#ff9ec4', objective: '#00c2a8', player: '#ffffff' },
}

export function minimapPalette(mode) {
  return MINIMAP_PALETTES[mode] ?? MINIMAP_PALETTES.off
}

// Applied on boot and on every settings change (App.jsx subscribes).
export function applyDisplaySettings(settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.textSize = settings.textSize ?? 'normal'
  root.dataset.colorblind = settings.colorblindMode ?? 'off'
  root.dataset.reducedMotion = settings.reducedMotion ? 'on' : 'off'
}
