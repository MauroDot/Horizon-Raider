import { usePersistentStore } from '../state/persistentStore.js'
import { xpProgress, MAX_LEVEL } from '../game/progression.js'

// Small "level / XP bar / currency" readout, shown on the Main Menu root
// and atop the Loadout screen. Reads `progression.totalXp` (the store's
// only stored progression field) directly and derives level/XP-bar state
// from it via xpProgress() in the render body - selecting a store METHOD
// like `s.getProgress` instead would return a referentially-stable function
// every render, so the component would never re-render when totalXp
// actually changes; selecting the primitive and computing here avoids that.
export function PilotSummary({ compact = false }) {
  const totalXp = usePersistentStore((s) => s.progression.totalXp)
  const currency = usePersistentStore((s) => s.currency)
  const { level, current, needed, fraction } = xpProgress(totalXp)
  const maxed = level >= MAX_LEVEL

  return (
    <div className={`pilot-summary${compact ? ' compact' : ''}`}>
      <span className="pilot-summary-level">LVL {level}</span>
      <div className="pilot-summary-xp-track">
        <div className="pilot-summary-xp-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
      <span className="pilot-summary-xp-label">{maxed ? 'MAX LEVEL' : `${current}/${needed} XP`}</span>
      <span className="pilot-summary-currency">{currency}cr</span>
    </div>
  )
}
