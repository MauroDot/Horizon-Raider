import * as THREE from 'three'

// Trauma-based screen shake. Callers add "trauma" (0..1) on an impact; the
// actual offset uses trauma squared so small knocks stay subtle while big
// hits really kick, and trauma decays linearly so the shake always settles.
// Offsets are applied to the camera AFTER ChaseCamera has positioned it, so
// this never fights the follow logic - it just perturbs the final pose.
const DECAY_PER_SECOND = 1.6
const MAX_OFFSET = 0.9 // metres
const MAX_ROLL = THREE.MathUtils.degToRad(2.2)
const FREQUENCY = 26

export class ScreenShake {
  constructor() {
    this.trauma = 0
    this._time = 0
    this._seed = Math.random() * 100
  }

  // `amount` is additive and clamped - several hits at once stack toward
  // the ceiling rather than each overwriting the last.
  add(amount) {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  update(delta) {
    this._time += delta
    this.trauma = Math.max(0, this.trauma - DECAY_PER_SECOND * delta)
  }

  get active() {
    return this.trauma > 0.001
  }

  // Perturbs the camera in its own local axes, so the shake reads the same
  // regardless of which way the aircraft is facing.
  apply(camera) {
    if (!this.active) return
    const shake = this.trauma * this.trauma
    // Cheap deterministic noise - three offset sine pairs, no allocation.
    const t = this._time * FREQUENCY + this._seed
    const nx = Math.sin(t) * Math.sin(t * 0.37)
    const ny = Math.sin(t * 1.31 + 1.7) * Math.sin(t * 0.53)
    const nr = Math.sin(t * 0.79 + 3.1)

    camera.translateX(nx * shake * MAX_OFFSET)
    camera.translateY(ny * shake * MAX_OFFSET)
    camera.rotateZ(nr * shake * MAX_ROLL)
  }
}
