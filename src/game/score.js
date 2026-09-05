const KILL_POINTS = { gun: 100, missile: 150 }
const VEHICLE_BONUS = 25

// A kill within this long of the previous one extends the combo.
const COMBO_WINDOW_SECONDS = 4
const COMBO_STEP = 0.25 // each chained kill adds this to the multiplier
const COMBO_MAX = 4

// Flying clean is worth as much as chaining kills: the untouched streak
// climbs one step per kill taken without being hit, and any damage at all
// drops it straight back to 1x.
const CLEAN_STEP = 0.1
const CLEAN_MAX = 2

// A "critical" is a shot that passes within this fraction of an enemy's hit
// radius of its dead centre. Enemies use a single spherical hit volume, so
// there's no head to shoot - this is a precision bonus, which is the honest
// equivalent, and WeaponSystem already computes the exact miss distance it
// needs (see _fireGun's ray-vs-sphere test).
export const CRITICAL_HIT_FRACTION = 0.3
const CRITICAL_MULTIPLIER = 1.5

// Tracks kills, shot accuracy, and the Free Play scoring multipliers. Read
// via `snapshot()` from the HUD; the game loop drives it through
// recordShot/recordHit/addKill, plus update(delta) to decay the combo and
// notifyDamaged() when the player takes a hit.
export class ScoreTracker {
  constructor() {
    this.kills = 0
    this.score = 0
    this.shotsFired = { gun: 0, missile: 0 }
    this.shotsHit = { gun: 0, missile: 0 }

    this.combo = 0
    this.criticalKills = 0
    this._comboTimer = 0
    this._cleanKills = 0
  }

  recordShot(weapon) {
    this.shotsFired[weapon]++
  }

  recordHit(weapon) {
    this.shotsHit[weapon]++
  }

  // Chained-kill multiplier, decays once the window lapses.
  get comboMultiplier() {
    return Math.min(COMBO_MAX, 1 + Math.max(0, this.combo - 1) * COMBO_STEP)
  }

  // Untouched-streak multiplier, reset by any damage taken.
  get cleanMultiplier() {
    return Math.min(CLEAN_MAX, 1 + this._cleanKills * CLEAN_STEP)
  }

  get multiplier() {
    return this.comboMultiplier * this.cleanMultiplier
  }

  // Seconds left before the combo lapses (0 when there's no combo running).
  get comboRemaining() {
    return Math.max(0, this._comboTimer)
  }

  update(delta) {
    if (this.combo === 0) return
    this._comboTimer -= delta
    if (this._comboTimer <= 0) {
      this.combo = 0
      this._comboTimer = 0
    }
  }

  // Any damage to the player ends the untouched streak outright. The combo
  // is left alone - that one is about kill *timing*, not about staying
  // clean, and dropping both on one hit felt like a double penalty.
  notifyDamaged() {
    this._cleanKills = 0
  }

  addKill(weapon, enemyType, { critical = false } = {}) {
    this.kills++
    this.combo++
    this._comboTimer = COMBO_WINDOW_SECONDS
    this._cleanKills++
    if (critical) this.criticalKills++

    let points = KILL_POINTS[weapon] ?? 100
    if (enemyType === 'vehicle') points += VEHICLE_BONUS
    if (critical) points *= CRITICAL_MULTIPLIER
    this.score += Math.round(points * this.multiplier)
  }

  get accuracy() {
    const fired = this.shotsFired.gun + this.shotsFired.missile
    if (fired === 0) return 0
    const hit = this.shotsHit.gun + this.shotsHit.missile
    return (hit / fired) * 100
  }

  snapshot() {
    // Raw shotsFired/shotsHit totals (alongside the convenience `accuracy`
    // percentage) so a caller aggregating across many runs - persistentStore's
    // lifetime accuracy stat - can weight by shot count instead of averaging
    // per-run percentages, which would over-weight short runs.
    return {
      kills: this.kills,
      score: this.score,
      accuracy: this.accuracy,
      shotsFired: this.shotsFired.gun + this.shotsFired.missile,
      shotsHit: this.shotsHit.gun + this.shotsHit.missile,
      combo: this.combo,
      comboRemaining: this.comboRemaining,
      multiplier: this.multiplier,
      criticalKills: this.criticalKills,
    }
  }
}
