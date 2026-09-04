import * as THREE from 'three'
import { getTerrainHeight } from './terrainHeight.js'

const STRIKE_INTERVAL = 9
const TELEGRAPH_DURATION = 1.8
const BLAST_RADIUS = 14
const DAMAGE = 26

// Periodic environmental hazard during boss fights: an artillery-style
// strike telegraphed by a growing warning ring on the ground, then an
// explosion that damages the player if still inside the blast radius when
// it lands - gives the player a reason to keep moving during a boss fight,
// independent of whatever the boss itself is doing.
export class BossHazards {
  constructor(scene, effects, { onExplosion } = {}) {
    this.scene = scene
    this.effects = effects
    this.onExplosion = onExplosion
    this.timer = STRIKE_INTERVAL * 0.55 // first strike comes a bit sooner than the steady interval
    this.pending = null // { position, timer, ringMesh, material }
  }

  update(delta, target) {
    if (this.pending) {
      this.pending.timer -= delta
      const t = THREE.MathUtils.clamp(1 - this.pending.timer / TELEGRAPH_DURATION, 0, 1)
      this.pending.ringMesh.scale.setScalar(THREE.MathUtils.lerp(0.3, 1, t))
      this.pending.material.opacity = 0.75 * (1 - t * 0.4)
      if (this.pending.timer <= 0) this._detonate(target)
      return
    }
    this.timer -= delta
    if (this.timer <= 0) {
      this.timer = STRIKE_INTERVAL
      this._telegraph(target)
    }
  }

  _telegraph(target) {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * 22
    const position = target.mesh.position.clone()
    position.x += Math.sin(angle) * radius
    position.z += Math.cos(angle) * radius
    position.y = getTerrainHeight(position.x, position.z) + 0.3

    const material = new THREE.MeshBasicMaterial({
      color: 0xff4020,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(BLAST_RADIUS * 0.88, BLAST_RADIUS, 28), material)
    ring.rotation.x = -Math.PI / 2
    ring.position.copy(position)
    ring.scale.setScalar(0.3)
    this.scene.add(ring)

    this.pending = { position, timer: TELEGRAPH_DURATION, ringMesh: ring, material }
  }

  _detonate(target) {
    const { position, ringMesh, material } = this.pending
    this.scene.remove(ringMesh)
    material.dispose()
    this.pending = null

    this.effects.addExplosion(position, { scale: 1.3 })
    this.onExplosion?.(position.clone())

    if (target.health.alive && position.distanceTo(target.mesh.position) <= BLAST_RADIUS) {
      const reduction = target.damageReduction?.() ?? 0
      const damage = DAMAGE * (1 - reduction)
      target.health.takeDamage(damage)
      target.onHit?.(damage)
    }
  }

  dispose() {
    if (this.pending) {
      this.scene.remove(this.pending.ringMesh)
      this.pending.material.dispose()
      this.pending = null
    }
  }
}
