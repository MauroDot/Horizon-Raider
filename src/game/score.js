const KILL_POINTS = { gun: 100, missile: 150 }
const VEHICLE_BONUS = 25

// Tracks kills and shot accuracy per weapon. Read via `snapshot()` from the
// HUD; the game loop drives it through recordShot/recordHit/addKill.
export class ScoreTracker {
  constructor() {
    this.kills = 0
    this.score = 0
    this.shotsFired = { gun: 0, missile: 0 }
    this.shotsHit = { gun: 0, missile: 0 }
  }

  recordShot(weapon) {
    this.shotsFired[weapon]++
  }

  recordHit(weapon) {
    this.shotsHit[weapon]++
  }

  addKill(weapon, enemyType) {
    this.kills++
    this.score += KILL_POINTS[weapon] ?? 100
    if (enemyType === 'vehicle') this.score += VEHICLE_BONUS
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
    }
  }
}
