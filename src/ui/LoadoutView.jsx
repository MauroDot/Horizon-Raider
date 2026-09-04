import { useState } from 'react'
import { usePersistentStore, UNLOCKABLE_COLORS, BOSS_TROPHY_COLORS } from '../state/persistentStore.js'
import { HELICOPTERS } from '../game/helicopters.js'
import { LOADOUTS } from '../game/loadouts.js'
import { BOOSTERS } from '../game/boosters.js'
import { PilotSummary } from './PilotSummary.jsx'

const PAINT_OPTIONS = [
  { name: 'Crimson Red', color: '#b3312c' },
  { name: 'Ocean Blue', color: '#2d5f8a' },
  { name: 'Matte Black', color: '#1c1c1e' },
  { name: 'Desert Tan', color: '#8a7048' },
  { name: 'Jungle Camo', color: '#3d5a3a' },
  { name: 'Gunmetal', color: '#3a3d42' },
]

// Signed-percent stat delta, e.g. 1.25 -> "+25%", 1 -> "—". Used for both
// helicopter variants and loadout presets so their stat readouts read the
// same way.
function formatMult(multiplier) {
  const pct = Math.round((multiplier - 1) * 100)
  if (pct === 0) return '—'
  return pct > 0 ? `+${pct}%` : `${pct}%`
}

function HelicopterTab() {
  const helicopterId = usePersistentStore((s) => s.customization.helicopterId)
  const setHelicopter = usePersistentStore((s) => s.setHelicopter)
  // Fallback guards a localStorage blob saved by an older build, where this
  // field didn't exist yet - belt-and-suspenders alongside persistentStore's
  // own merge fix, since a render crash here (no error boundary below this
  // point) would blank the whole page.
  const unlockedHelicopters = usePersistentStore((s) => s.unlocks.helicopters) ?? []

  return (
    <div className="main-menu-list">
      {HELICOPTERS.map((h) => {
        const unlocked = unlockedHelicopters.includes(h.id)
        const selected = helicopterId === h.id
        return (
          <div className={`mission-row${selected ? ' selected-row' : ''}${unlocked ? '' : ' locked'}`} key={h.id}>
            <div className="mission-row-info">
              <span className="mission-row-name">{h.label}</span>
              <span className="mission-row-briefing">
                {unlocked ? h.description : `Locked - reach pilot level ${h.requiredLevel}`}
              </span>
              {unlocked && (
                <span className="stat-readout">
                  SPD {formatMult(h.speedMultiplier)} · AGL {formatMult(h.agilityMultiplier)} · ARM{' '}
                  {formatMult(h.armorMultiplier)} · FP {formatMult(h.firepowerMultiplier)}
                </span>
              )}
            </div>
            <button type="button" disabled={!unlocked || selected} onClick={() => setHelicopter(h.id)}>
              {selected ? 'Selected' : unlocked ? 'Select' : 'Locked'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function PaintTab() {
  const color = usePersistentStore((s) => s.customization.helicopterColor)
  const setColor = usePersistentStore((s) => s.setHelicopterColor)
  const unlockedPaintColors = usePersistentStore((s) => s.unlocks.paintColors) ?? []
  const unlockedTrophies = usePersistentStore((s) => s.unlocks.bossTrophies) ?? []

  return (
    <div className="paint-grid">
      {PAINT_OPTIONS.map((opt) => (
        <button
          key={opt.color}
          type="button"
          className={`paint-swatch${color === opt.color ? ' selected' : ''}`}
          style={{ background: opt.color }}
          onClick={() => setColor(opt.color)}
          title={opt.name}
        >
          {color === opt.color && '✓'}
        </button>
      ))}
      {UNLOCKABLE_COLORS.map((opt) => {
        const unlocked = unlockedPaintColors.includes(opt.id)
        return (
          <button
            key={opt.color}
            type="button"
            className={`paint-swatch${color === opt.color ? ' selected' : ''}${unlocked ? '' : ' locked'}`}
            style={{ background: opt.color }}
            disabled={!unlocked}
            onClick={() => setColor(opt.color)}
            title={unlocked ? opt.label : `${opt.label} - reach pilot level ${opt.requiredLevel} to unlock`}
          >
            {!unlocked ? '🔒' : color === opt.color ? '✓' : ''}
          </button>
        )
      })}
      {/* Boss trophy colors - "boss drops rare unlocks on defeat" - one per
          chapter boss (plus The Titan), gated on having beaten that
          specific boss rather than pilot level. */}
      {BOSS_TROPHY_COLORS.map((opt) => {
        const unlocked = unlockedTrophies.includes(opt.id)
        return (
          <button
            key={opt.color}
            type="button"
            className={`paint-swatch trophy${color === opt.color ? ' selected' : ''}${unlocked ? '' : ' locked'}`}
            style={{ background: opt.color }}
            disabled={!unlocked}
            onClick={() => setColor(opt.color)}
            title={unlocked ? `${opt.label} (boss trophy)` : `${opt.label} - defeat that boss to unlock`}
          >
            {!unlocked ? '🔒' : color === opt.color ? '✓' : '🏆'}
          </button>
        )
      })}
    </div>
  )
}

function PresetTab() {
  const loadout = usePersistentStore((s) => s.customization.loadout)
  const setLoadout = usePersistentStore((s) => s.setLoadout)

  return (
    <div className="main-menu-list">
      {LOADOUTS.map((l) => (
        <div className={`mission-row${loadout === l.id ? ' selected-row' : ''}`} key={l.id}>
          <div className="mission-row-info">
            <span className="mission-row-name">{l.label}</span>
            <span className="mission-row-briefing">{l.description}</span>
            <span className="stat-readout">
              SPD {formatMult(l.speedMultiplier)} · ARM {formatMult(l.armorMultiplier)} · MSL x{l.missileCapacity}
            </span>
          </div>
          <button type="button" disabled={loadout === l.id} onClick={() => setLoadout(l.id)}>
            {loadout === l.id ? 'Equipped' : 'Equip'}
          </button>
        </div>
      ))}
    </div>
  )
}

function BoostersTab() {
  const currency = usePersistentStore((s) => s.currency)
  const inventory = usePersistentStore((s) => s.boosterInventory)
  const purchaseBooster = usePersistentStore((s) => s.purchaseBooster)

  return (
    <div className="main-menu-list">
      {BOOSTERS.map((b) => {
        const owned = inventory[b.id] ?? 0
        const affordable = currency >= b.cost
        return (
          <div className="mission-row" key={b.id}>
            <div className="mission-row-info">
              <span className="mission-row-name">
                {b.label} <span className="booster-owned">x{owned} owned</span>
              </span>
              <span className="mission-row-briefing">
                {b.description} · {b.duration}s duration
              </span>
            </div>
            <button type="button" disabled={!affordable} onClick={() => purchaseBooster(b.id)}>
              Buy · {b.cost}cr
            </button>
          </div>
        )
      })}
      <p className="main-menu-note">
        Purchased charges carry into every flight - activate them in-mission with your booster keybinds
        (Settings → Boosters to rebind).
      </p>
    </div>
  )
}

const TABS = [
  { id: 'helicopter', label: 'Helicopter', Component: HelicopterTab },
  { id: 'paint', label: 'Paint', Component: PaintTab },
  { id: 'preset', label: 'Preset', Component: PresetTab },
  { id: 'boosters', label: 'Boosters', Component: BoostersTab },
]

// The pre-mission Loadout screen (Main Menu -> Loadout): helicopter choice,
// paint, the Standard/Heavy/Light/Scout preset, and the booster shop, all
// under one pilot-level-gated roof. Everything here writes straight to
// persistentStore.customization/boosterInventory and takes effect on the
// next flight (GameScreen.jsx reads it fresh each launch).
export function LoadoutView({ onBack }) {
  const [tab, setTab] = useState('helicopter')
  const ActiveTab = TABS.find((t) => t.id === tab)?.Component ?? HelicopterTab

  return (
    <div className="main-menu-panel loadout-panel">
      <h1>LOADOUT</h1>
      <PilotSummary />
      <div className="loadout-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`loadout-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ActiveTab />
      <div className="main-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
