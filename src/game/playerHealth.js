// Player health/damage state. Plain data + mutation, no THREE dependency -
// createScene decides what happens visually when it hits zero. `max` comes
// from the resolved helicopter x loadout armor multiplier (createScene.js).
export class PlayerHealth {
  constructor(max = 100) {
    this.max = max
    this.health = max
    this.alive = true
    // Live flag createScene sets every tick from BoosterController's Shield
    // Boost - a single choke point here means every damage source (crash,
    // enemy fire) is nullified the same way, with no per-caller checks.
    this.invulnerable = false
  }

  takeDamage(amount) {
    if (!this.alive || amount <= 0 || this.invulnerable) return
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) this.alive = false
  }

  get fraction() {
    return this.health / this.max
  }
}
