import { TEXT_SIZES, COLORBLIND_MODES } from '../game/displaySettings.js'
import { DIFFICULTIES } from '../game/campaign/difficulty.js'
import { Slider, SelectRow, ToggleRow } from './SettingsControls.jsx'

// The Graphics / Accessibility / Game / Credits settings screens. Every
// control writes straight through controlConfig.updateSetting(), which
// persists to localStorage and notifies subscribers - so each change is
// saved and applied immediately, with no separate "apply" step:
//   - graphics    -> createScene.js's applySceneSettings() subscription
//   - accessibility -> App.jsx's applyDisplaySettings() subscription
//   - game        -> read at the point of use (GameScreen, MainMenu, briefing)

const SHADOW_OPTIONS = [
  { id: 'off', label: 'Off' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

export function GraphicsSettingsView({ controlConfig, onBack }) {
  const s = controlConfig.settings
  const set = (key, value) => controlConfig.updateSetting(key, value)
  return (
    <>
      <h1>GRAPHICS</h1>
      <p className="game-menu-note">Applied immediately, including mid-flight.</p>
      <div className="game-menu-slider-list">
        <Slider label="Draw Distance" value={s.drawDistance} onChange={(v) => set('drawDistance', v)} />
        <SelectRow
          label="Shadow Quality"
          value={s.shadowQuality}
          options={SHADOW_OPTIONS}
          onChange={(v) => set('shadowQuality', v)}
        />
        <Slider
          label="Particle Effects"
          value={s.particleIntensity}
          onChange={(v) => set('particleIntensity', v)}
        />
      </div>
      <p className="game-menu-note">
        Draw distance and shadow quality are the two biggest wins if the frame rate is struggling. Particle effects
        only thin out debris, smoke and flares - hit sparks and explosion flashes always play, so combat feedback
        never disappears.
      </p>
      <div className="game-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

export function AccessibilitySettingsView({ controlConfig, onBack }) {
  const s = controlConfig.settings
  const set = (key, value) => controlConfig.updateSetting(key, value)
  return (
    <>
      <h1>ACCESSIBILITY</h1>
      <div className="game-menu-slider-list">
        <SelectRow label="Text Size" value={s.textSize} options={TEXT_SIZES} onChange={(v) => set('textSize', v)} />
        <SelectRow
          label="Colourblind Mode"
          value={s.colorblindMode}
          options={COLORBLIND_MODES}
          onChange={(v) => set('colorblindMode', v)}
        />
        <ToggleRow label="Motion Sickness Mode" checked={s.reducedMotion} onChange={(v) => set('reducedMotion', v)} />
      </div>
      <p className="game-menu-note">
        Colourblind modes recolour the cues that actually carry meaning - hostiles, friendlies and objectives - across
        the HUD and the tactical map. Motion sickness mode removes the speed FOV surge, damps the chase camera, and
        stops the HUD pulsing and flashing.
      </p>
      <div className="game-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

export function GameSettingsView({ controlConfig, onBack }) {
  const s = controlConfig.settings
  const set = (key, value) => controlConfig.updateSetting(key, value)
  return (
    <>
      <h1>GAME</h1>
      <div className="game-menu-slider-list">
        <SelectRow
          label="Default Difficulty"
          value={s.defaultDifficulty}
          options={DIFFICULTIES}
          onChange={(v) => set('defaultDifficulty', v)}
        />
        <ToggleRow label="Auto-Save" checked={s.autoSave} onChange={(v) => set('autoSave', v)} />
        <ToggleRow
          label="Objective Markers"
          checked={s.showObjectiveMarkers}
          onChange={(v) => set('showObjectiveMarkers', v)}
        />
      </div>
      <p className="game-menu-note">
        Default difficulty pre-selects Free Play and mission briefings - a mission can still be launched at any
        difficulty it has unlocked. With auto-save off, progress is only written when a run actually ends, not at
        mission start.
      </p>
      <div className="game-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

export function CreditsView({ onBack }) {
  return (
    <>
      <h1>CREDITS</h1>
      <div className="game-menu-credits">
        <p className="credits-title">HORIZON RAIDER</p>
        <p className="credits-line">A helicopter combat sandbox</p>

        <p className="credits-heading">Built with</p>
        <p className="credits-line">React · Vite · Three.js · Zustand</p>

        <p className="credits-heading">Art</p>
        <p className="credits-line">
          Every model, texture and effect is generated procedurally from primitives at runtime - no external art
          assets.
        </p>

        <p className="credits-heading">Audio</p>
        <p className="credits-line">
          Engine and boss-encounter audio are synthesised live with the Web Audio API. Music and sound-effect slots
          load from /public/audio - see that folder&apos;s README for what goes where.
        </p>

        <p className="credits-heading">World</p>
        <p className="credits-line">
          Terrain and obstacle layout use seeded procedural generation (mulberry32), so the landscape is identical on
          every load rather than re-rolled each time.
        </p>
      </div>
      <div className="game-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}
