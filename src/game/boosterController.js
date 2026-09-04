import { BOOSTERS } from './boosters.js'

const SPEED_BOOST_MULTIPLIER = 1.6
const WEAPON_FIRE_RATE_MULTIPLIER = 2
const WEAPON_DAMAGE_MULTIPLIER = 1.5

// Tracks in-mission booster charges/timers and exposes the current effect
// multipliers each frame. createScene owns one instance per run, seeded
// with a snapshot of the player's purchased charge counts, and applies its
// multipliers to playerHealth/flightModel/weapons every tick. Charges are
// NOT refunded at run end (they're consumed on use, not on equip) - the
// snapshot is copied so a run's usage never touches persistentStore
// directly; `onUse` is how createScene tells the caller to persist the
// deduction (see GameScreen.jsx).
export class BoosterController {
  constructor(initialCharges = {}, onUse) {
    this.charges = { ...initialCharges }
    this.active = {} // id -> remaining seconds
    this.onUse = onUse
  }

  chargesFor(id) {
    return this.charges[id] ?? 0
  }

  isActive(id) {
    return (this.active[id] ?? 0) > 0
  }

  remaining(id) {
    return Math.max(0, this.active[id] ?? 0)
  }

  // Returns true if the booster actually activated (had a charge available
  // and wasn't already running - re-pressing an active booster doesn't
  // refresh/stack it, keeping the effect simple and predictable).
  activate(id) {
    const def = getBoosterDef(id)
    if (!def || this.chargesFor(id) <= 0 || this.isActive(id)) return false
    this.charges[id] -= 1
    this.active[id] = def.duration
    this.onUse?.(id)
    return true
  }

  update(delta) {
    for (const id of Object.keys(this.active)) {
      this.active[id] -= delta
      if (this.active[id] <= 0) delete this.active[id]
    }
  }

  get shieldActive() {
    return this.isActive('shield')
  }

  get speedMultiplier() {
    return this.isActive('speed') ? SPEED_BOOST_MULTIPLIER : 1
  }

  get weaponFireRateMultiplier() {
    return this.isActive('weapon') ? WEAPON_FIRE_RATE_MULTIPLIER : 1
  }

  get weaponDamageMultiplier() {
    return this.isActive('weapon') ? WEAPON_DAMAGE_MULTIPLIER : 1
  }

  // Snapshot for the HUD: one row per booster type with its charge count
  // and, if active, seconds remaining.
  snapshot() {
    return BOOSTERS.map((def) => ({
      id: def.id,
      label: def.label,
      charges: this.chargesFor(def.id),
      active: this.isActive(def.id),
      remaining: this.remaining(def.id),
    }))
  }
}

function getBoosterDef(id) {
  return BOOSTERS.find((b) => b.id === id)
}
