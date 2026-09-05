import * as THREE from 'three'
import { getTerrainHeight } from './terrainHeight.js'
import { AIRSPACE } from './flightModel/airspace.js'
import { createMissileMesh } from './weapons/missileModel.js'

const ORBIT_RADIUS = 50
const WEAVE_AMPLITUDE = 18
const WEAVE_FREQUENCY = 0.5
const DIR_FLIP_MIN = 4
const DIR_FLIP_MAX = 8
const ALTITUDE_BOB_AMPLITUDE = 10
const ALTITUDE_BOB_FREQUENCY = 0.35
const MAX_BANK = THREE.MathUtils.degToRad(35)
const TURN_RATE = THREE.MathUtils.degToRad(70)

const TELEGRAPH_DURATION = 1.2
const BARRAGE_COUNT = 6
const BARRAGE_SPREAD = THREE.MathUtils.degToRad(14)
const BARRAGE_SPEED = 40
const BARRAGE_DAMAGE = 6
const MISSILE_LIFETIME = 5

const CHARGE_SPEED = 34
const CHARGE_DURATION = 1.6
const CHARGE_HIT_RADIUS = 6
const CHARGE_DAMAGE = 22

const ATTACK_COOLDOWN_BASE = 5
const ENRAGE_HEALTH_FRACTION = 0.4 // regular (non-final) bosses go aggressive below this

// Drives a boss enemy's movement and attack patterns - everything a normal
// EnemyManager-driven enemy does NOT do. EnemyManager still owns the boss's
// mesh/health/hitRadius record (see spawnBoss()) and skips its usual
// pursuit AI for any enemy this controller is attached to (`enemy.controlled`);
// EnemyWeaponSystem also skips its generic per-enemy gunfire for bosses
// (`enemy.isBoss`) so this is the *sole* source of a boss's offense -
// telegraphed missile barrages and ramming charges, not the same weak
// potshots every other enemy takes.
//
// `finalBoss: true` additionally drives a 3rd movement phase (see update())
// that deploys defensive ground reinforcements once - The Titan's "turret
// deployment" phase, implemented as summoned ground vehicles rather than
// literal fixed gun emplacements (reusing EnemyManager's existing vehicle
// AI/weapons rather than building a whole separate static-turret system).
export class BossController {
  constructor(enemy, { scene, effects, enemyManager, onTelegraph, onExplosion, onPhaseChange, finalBoss = false }) {
    this.enemy = enemy
    this.scene = scene
    this.effects = effects
    this.enemyManager = enemyManager
    this.onTelegraph = onTelegraph
    this.onExplosion = onExplosion
    this.onPhaseChange = onPhaseChange
    this.finalBoss = finalBoss

    this.orbitDir = Math.random() < 0.5 ? 1 : -1
    this.dirFlipTimer = DIR_FLIP_MIN + Math.random() * (DIR_FLIP_MAX - DIR_FLIP_MIN)
    this.time = 0
    this.heading = enemy.heading

    this.attackCooldown = 2 // a short grace period before the first attack
    this.state = 'roam' // 'roam' | 'telegraph' | 'charge'
    this.stateTimer = 0
    this.pendingAttack = null
    this.chargeTarget = null

    this.phase = 0
    this.turretsDeployed = false
    this.missiles = []
  }

  get healthFraction() {
    return Math.max(0, this.enemy.health / this.enemy.maxHealth)
  }

  snapshot() {
    return {
      phase: this.phase,
      telegraphing: this.state === 'telegraph',
      attack: this.pendingAttack,
    }
  }

  _updatePhase() {
    if (!this.finalBoss) {
      const next = this.healthFraction <= ENRAGE_HEALTH_FRACTION ? 1 : 0
      if (next !== this.phase) {
        this.phase = next
        this.onPhaseChange?.(this.phase)
      }
      return
    }
    // The Titan: 0 mobile combat (100-66%) -> 1 turret deployment (66-33%,
    // one-shot spawn on entry) -> 2 final stand (<33%, all weapons, fastest).
    const frac = this.healthFraction
    const next = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2
    if (next !== this.phase) {
      this.phase = next
      this.onPhaseChange?.(this.phase)
      if (next === 1 && !this.turretsDeployed) {
        this.turretsDeployed = true
        this.enemyManager.spawnGroundAdds(this.enemy.mesh.position, 3)
      }
    }
  }

  update(delta, target) {
    if (!this.enemy.alive) return
    this.time += delta
    this._updatePhase()

    const enraged = this.finalBoss ? this.phase >= 2 : this.phase >= 1
    const speedMultiplier = enraged ? 1.35 : 1
    const cooldownMultiplier = enraged ? 0.55 : 1
    // Phase 1 (turret deployment) - the Titan hangs back and lets its
    // ground adds do the work rather than aggressively closing distance.
    const passive = this.finalBoss && this.phase === 1

    this._updateMissiles(delta, target)

    if (this.state === 'telegraph') {
      this._updateTelegraph(delta, target)
      return
    }
    if (this.state === 'charge') {
      this._updateCharge(delta, target)
      return
    }

    this._roam(delta, target, speedMultiplier, passive)

    this.attackCooldown -= delta
    if (this.attackCooldown <= 0 && !passive) {
      this.attackCooldown = ATTACK_COOLDOWN_BASE * cooldownMultiplier * (0.8 + Math.random() * 0.4)
      this._beginAttack(target)
    } else if (this.attackCooldown <= 0) {
      // Passive phase still occasionally lobs a barrage so it isn't inert.
      this.attackCooldown = ATTACK_COOLDOWN_BASE * 1.4
      this._beginAttack(target)
    }
  }

  _roam(delta, target, speedMultiplier, passive) {
    const { mesh } = this.enemy
    const toTarget = new THREE.Vector2(target.mesh.position.x - mesh.position.x, target.mesh.position.z - mesh.position.z)

    this.dirFlipTimer -= delta
    if (this.dirFlipTimer <= 0) {
      this.dirFlipTimer = DIR_FLIP_MIN + Math.random() * (DIR_FLIP_MAX - DIR_FLIP_MIN)
      this.orbitDir *= -1
    }

    const distance = toTarget.length() || 1
    const inward = toTarget.clone().divideScalar(distance)
    const tangent = new THREE.Vector2(-inward.y, inward.x).multiplyScalar(this.orbitDir)
    const weave = Math.sin(this.time * WEAVE_FREQUENCY * Math.PI * 2) * WEAVE_AMPLITUDE
    const radiusError = distance - ORBIT_RADIUS

    // Blend "close the gap / back off to the orbit ring" with lateral
    // weaving - reads as evasive strafing rather than a straight pursuit.
    const moveDir = inward
      .clone()
      .multiplyScalar(THREE.MathUtils.clamp(radiusError / ORBIT_RADIUS, -1, 1))
      .add(tangent.clone().multiplyScalar(1 + weave / WEAVE_AMPLITUDE))
      .normalize()

    const targetHeading = Math.atan2(moveDir.x, moveDir.y)
    const turn = THREE.MathUtils.clamp(_angleDiff(targetHeading, this.heading), -TURN_RATE * delta, TURN_RATE * delta)
    this.heading += turn
    const bank = THREE.MathUtils.clamp(-turn / (TURN_RATE * delta || 1), -1, 1) * MAX_BANK

    const speed = (passive ? 6 : 16) * speedMultiplier
    mesh.position.x += Math.sin(this.heading) * speed * delta
    mesh.position.z += Math.cos(this.heading) * speed * delta

    const groundLevel = getTerrainHeight(mesh.position.x, mesh.position.z)
    const bob = Math.sin(this.time * ALTITUDE_BOB_FREQUENCY * Math.PI * 2) * ALTITUDE_BOB_AMPLITUDE
    const desiredAltitude = THREE.MathUtils.clamp(
      target.mesh.position.y + 8 + bob,
      groundLevel + AIRSPACE.minAltitudeAboveGround + 6,
      AIRSPACE.maxAltitude - 8,
    )
    mesh.position.y += (desiredAltitude - mesh.position.y) * (1 - Math.exp(-1.1 * delta))

    const half = AIRSPACE.halfExtent
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -half, half)
    mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -half, half)

    mesh.quaternion.setFromEuler(new THREE.Euler(0, this.heading, bank, 'YXZ'))
    this.enemy.heading = this.heading
  }

  _beginAttack(target) {
    const canCharge = this.phase !== 1 || !this.finalBoss // Titan skips charging while passive/turret phase
    this.pendingAttack = canCharge && Math.random() < 0.4 ? 'charge' : 'barrage'
    this.state = 'telegraph'
    this.stateTimer = TELEGRAPH_DURATION
    this.chargeTarget = target.mesh.position.clone()
    this.onTelegraph?.(this.pendingAttack)
  }

  _updateTelegraph(delta, target) {
    // Pulse the boss's glow while winding up - the visual half of the
    // telegraph, alongside the HUD warning fired once in _beginAttack().
    const glow = this.enemy.mesh.userData.glowMaterials
    if (glow) {
      const pulse = 1.5 + Math.sin(this.time * 18) * 1.5
      for (const mat of glow) mat.emissiveIntensity = pulse
    }

    this.stateTimer -= delta
    if (this.stateTimer > 0) return

    if (this.pendingAttack === 'barrage') this._fireBarrage(target)
    else this._startCharge(target)
  }

  _fireBarrage(target) {
    const { mesh } = this.enemy
    const forward = target.mesh.position.clone().sub(mesh.position).normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    for (let i = 0; i < BARRAGE_COUNT; i++) {
      const spread = (i / (BARRAGE_COUNT - 1) - 0.5) * 2
      const dir = forward
        .clone()
        .addScaledVector(right, Math.tan(BARRAGE_SPREAD * spread))
        .normalize()

      const mesh2 = createMissileMesh()
      mesh2.material.color.set(0xff3b1a)
      mesh2.material.emissive.set(0xff5522)
      mesh2.material.emissiveIntensity = 1.4
      mesh2.position.copy(mesh.position)
      mesh2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
      this.scene.add(mesh2)

      this.missiles.push({
        mesh: mesh2,
        position: mesh.position.clone(),
        velocity: dir.multiplyScalar(BARRAGE_SPEED),
        life: 0,
      })
    }
    this.state = 'roam'
    this.pendingAttack = null
  }

  _startCharge(target) {
    this.state = 'charge'
    this.stateTimer = CHARGE_DURATION
    this.chargeTarget = target.mesh.position.clone()
    const { mesh } = this.enemy
    const dir = this.chargeTarget.clone().sub(mesh.position).normalize()
    this.chargeDir = dir
    this.heading = Math.atan2(dir.x, dir.z)
  }

  _updateCharge(delta, target) {
    const { mesh } = this.enemy
    mesh.position.addScaledVector(this.chargeDir, CHARGE_SPEED * delta)
    mesh.quaternion.setFromEuler(new THREE.Euler(0, this.heading, 0, 'YXZ'))
    this.enemy.heading = this.heading

    const half = AIRSPACE.halfExtent
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -half, half)
    mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -half, half)
    const groundLevel = getTerrainHeight(mesh.position.x, mesh.position.z)
    mesh.position.y = Math.max(mesh.position.y, groundLevel + AIRSPACE.minAltitudeAboveGround)

    if (target.health.alive && mesh.position.distanceTo(target.mesh.position) <= CHARGE_HIT_RADIUS) {
      const reduction = target.damageReduction?.() ?? 0
      const damage = CHARGE_DAMAGE * (1 - reduction)
      target.health.takeDamage(damage)
      target.onHit?.(damage)
      this.effects.addExplosion(target.mesh.position.clone(), { scale: 0.8 })
      this.onExplosion?.(target.mesh.position.clone())
      this.state = 'roam'
      this.pendingAttack = null
      return
    }

    this.stateTimer -= delta
    if (this.stateTimer <= 0) {
      this.state = 'roam'
      this.pendingAttack = null
    }
  }

  _updateMissiles(delta, target) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i]
      m.life += delta
      m.position.addScaledVector(m.velocity, delta)
      m.mesh.position.copy(m.position)

      const groundLevel = getTerrainHeight(m.position.x, m.position.z)
      const hitGround = m.position.y <= groundLevel
      const hitPlayer = target.health.alive && m.position.distanceTo(target.mesh.position) <= (target.hitRadius ?? 2)
      const expired = m.life > MISSILE_LIFETIME

      if (hitPlayer || hitGround || expired) {
        this.scene.remove(m.mesh)
        m.mesh.material.dispose()
        this.missiles.splice(i, 1)
        if (hitPlayer) {
          const reduction = target.damageReduction?.() ?? 0
          const damage = BARRAGE_DAMAGE * (1 - reduction)
          target.health.takeDamage(damage)
          target.onHit?.(damage)
        }
        if (hitGround) this.effects.addGroundDust(m.position.clone(), { scale: 1.2 })
        if (hitPlayer || hitGround) {
          this.effects.addExplosion(m.position.clone(), { scale: 0.6 })
          this.onExplosion?.(m.position.clone())
        }
      }
    }
  }

  dispose() {
    for (const m of this.missiles) {
      this.scene.remove(m.mesh)
      m.mesh.material.dispose()
    }
    this.missiles.length = 0
  }
}

function _angleDiff(target, current) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current))
}
