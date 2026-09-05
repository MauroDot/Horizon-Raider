// Free Play's wave director: a fresh group of hostiles every
// WAVE_INTERVAL_SECONDS, getting bigger and more varied as the session
// runs on. This sits alongside EnemyManager's steady `respawn` trickle
// (which just keeps the ambient roster topped up) - the waves are what
// actually escalate the session.
export const WAVE_INTERVAL_SECONDS = 30

// Which enemy types each wave can draw from. Early waves are light scouts
// and tanks; gunships, APCs and finally transports join as the session
// goes on, so variety grows with the wave count rather than everything
// being in the mix from the first minute.
const VARIETY_UNLOCKS = [
  { fromWave: 1, heli: ['scout'], vehicle: ['tank'] },
  { fromWave: 3, heli: ['scout', 'gunship'], vehicle: ['tank', 'apc'] },
  { fromWave: 6, heli: ['scout', 'gunship', 'transport'], vehicle: ['tank', 'apc'] },
]

export function variantsForWave(wave) {
  let entry = VARIETY_UNLOCKS[0]
  for (const candidate of VARIETY_UNLOCKS) {
    if (wave >= candidate.fromWave) entry = candidate
  }
  return { heli: entry.heli, vehicle: entry.vehicle }
}

// Wave size ramps roughly linearly but is capped so a long session gets
// harder without turning into an unrenderable swarm.
const BASE_HELI = 2
const BASE_VEHICLE = 1
const MAX_PER_WAVE = 14

export function waveComposition(wave, countMultiplier = 1) {
  const growth = (wave - 1) * 0.5
  let helicopters = Math.round((BASE_HELI + growth) * countMultiplier)
  let vehicles = Math.round((BASE_VEHICLE + growth * 0.6) * countMultiplier)
  const total = helicopters + vehicles
  if (total > MAX_PER_WAVE) {
    const scale = MAX_PER_WAVE / total
    helicopters = Math.max(1, Math.floor(helicopters * scale))
    vehicles = Math.max(0, Math.floor(vehicles * scale))
  }
  return { helicopters: Math.max(1, helicopters), vehicles: Math.max(0, vehicles) }
}

// Drives the wave clock. The first wave lands immediately at session start
// so there's something to fight without waiting out the full interval.
export class WaveDirector {
  constructor(enemyManager, { countMultiplier = 1, onWave } = {}) {
    this.enemyManager = enemyManager
    this.countMultiplier = countMultiplier
    this.onWave = onWave
    this.wave = 0
    this.timer = 0
    this.elapsed = 0
    this.lastWaveSize = 0
  }

  get secondsToNextWave() {
    return Math.max(0, WAVE_INTERVAL_SECONDS - this.timer)
  }

  update(delta) {
    this.elapsed += delta
    if (this.wave === 0) {
      this._spawn()
      return
    }
    this.timer += delta
    if (this.timer >= WAVE_INTERVAL_SECONDS) {
      this.timer -= WAVE_INTERVAL_SECONDS
      this._spawn()
    }
  }

  _spawn() {
    this.wave++
    this.timer = 0
    const variants = variantsForWave(this.wave)
    const { helicopters, vehicles } = waveComposition(this.wave, this.countMultiplier)
    this.lastWaveSize = this.enemyManager.spawnWave({
      helicopters,
      vehicles,
      heliVariants: variants.heli,
      vehicleVariants: variants.vehicle,
    })
    this.onWave?.(this.wave, this.lastWaveSize)
  }

  snapshot() {
    return {
      wave: this.wave,
      secondsToNextWave: this.secondsToNextWave,
      lastWaveSize: this.lastWaveSize,
    }
  }
}
