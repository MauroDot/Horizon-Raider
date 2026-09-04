import * as THREE from 'three'
import { getTerrainHeight } from '../terrainHeight.js'
import { createMissileMesh } from './missileModel.js'

const GUN_DAMAGE = 10
const GUN_RANGE = 260
const GUN_COOLDOWN = 0.09 // ~11 rounds/sec
const GUN_SPREAD = THREE.MathUtils.degToRad(0.8)
const GUN_MUZZLE_OFFSET = new THREE.Vector3(0, -0.05, 2.6)

const MISSILE_DAMAGE = 45
const MISSILE_SPEED = 70
const MISSILE_COOLDOWN = 1.1
const MISSILE_LIFETIME = 6
const MISSILE_TURN_RATE = THREE.MathUtils.degToRad(110)
const MISSILE_LOCK_CONE = THREE.MathUtils.degToRad(25)
const MISSILE_LOCK_RANGE = 240
const MISSILE_TRIGGER_MARGIN = 1.6
const MISSILE_TRAIL_INTERVAL = 0.05
const MISSILE_MUZZLE_OFFSET = new THREE.Vector3(0, -0.35, 0.8)
export const MISSILE_MAX_AMMO = 8 // the "standard" loadout's capacity - see loadouts.js
const MISSILE_REGEN_INTERVAL = 4 // seconds per reclaimed missile

// Player weapons: a hitscan machine gun (analytic ray-vs-sphere against
// living enemies) and homing missiles (steer toward a locked target within
// a forward cone, proximity-fuse on approach). Talks to EffectsManager for
// visuals and ScoreTracker for kills/accuracy - it doesn't own either.
export class WeaponSystem {
  // `missileCapacity` comes from the player's selected loadout, already
  // including the weapon-upgrade ammo bonus (helicopters.js). `damageMultiplier`
  // is the helicopter variant's firepower stat, applied to BOTH weapons;
  // `missileDamageMultiplier`/`reloadSpeedMultiplier` are the (missile-only,
  // additional) level-gated weapon upgrades. All default to neutral so
  // callers that don't care (tests, etc.) still get sane behavior.
  constructor({
    scene,
    helicopter,
    effects,
    enemyManager,
    score,
    audioManager,
    onImpact,
    onExplosion,
    missileCapacity = MISSILE_MAX_AMMO,
    damageMultiplier = 1,
    missileDamageMultiplier = 1,
    reloadSpeedMultiplier = 1,
  }) {
    this.scene = scene
    this.helicopter = helicopter
    this.effects = effects
    this.enemyManager = enemyManager
    this.score = score
    this.audioManager = audioManager
    this.onImpact = onImpact
    // Fired wherever a missile actually explodes (hit or not) - lets
    // createScene.js damage boss-arena destructible cover from player fire
    // without this class needing to know cover exists.
    this.onExplosion = onExplosion

    this.gunCooldown = 0
    this.missileCooldown = 0
    this.missileCapacity = missileCapacity
    this.missileAmmo = missileCapacity
    this.damageMultiplier = damageMultiplier
    this.missileDamageMultiplier = missileDamageMultiplier
    this.reloadSpeedMultiplier = reloadSpeedMultiplier
    // Temporary, in-mission Weapon Boost multipliers - mutable fields
    // createScene writes into every tick from BoosterController, left at 1
    // (no-op) whenever the boost isn't active. Kept separate from the
    // permanent multipliers above so a boost never has to touch them.
    this.boostFireRateMultiplier = 1
    this.boostDamageMultiplier = 1
    this._missileRegenTimer = MISSILE_REGEN_INTERVAL / reloadSpeedMultiplier
    this.missiles = []
  }

  update(delta, input) {
    this.gunCooldown = Math.max(0, this.gunCooldown - delta)
    this.missileCooldown = Math.max(0, this.missileCooldown - delta)

    if (this.missileAmmo < this.missileCapacity) {
      this._missileRegenTimer -= delta
      if (this._missileRegenTimer <= 0) {
        this.missileAmmo = Math.min(this.missileCapacity, this.missileAmmo + 1)
        this._missileRegenTimer = MISSILE_REGEN_INTERVAL / this.reloadSpeedMultiplier
      }
    }

    const fireRateMultiplier = this.boostFireRateMultiplier
    if (input.firingGun && this.gunCooldown <= 0) {
      this._fireGun()
      this.gunCooldown = GUN_COOLDOWN / fireRateMultiplier
    }

    if (input.firingMissile && this.missileCooldown <= 0 && this.missileAmmo > 0) {
      this._fireMissile()
      this.missileCooldown = MISSILE_COOLDOWN / fireRateMultiplier
      this.missileAmmo--
    }

    this._updateMissiles(delta)
  }

  _worldForward() {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.helicopter.quaternion)
  }

  _fireGun() {
    this.audioManager?.playSfx('gunfire', { volume: 0.5 })
    const forward = this._worldForward()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.helicopter.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.helicopter.quaternion)
    const muzzle = this.helicopter.position
      .clone()
      .add(GUN_MUZZLE_OFFSET.clone().applyQuaternion(this.helicopter.quaternion))

    const dir = forward
      .clone()
      .addScaledVector(right, (Math.random() - 0.5) * 2 * GUN_SPREAD)
      .addScaledVector(up, (Math.random() - 0.5) * 2 * GUN_SPREAD)
      .normalize()

    this.score.recordShot('gun')

    let closestT = Infinity
    let closestEnemy = null
    for (const enemy of this.enemyManager.getAliveEnemies()) {
      const toEnemy = enemy.mesh.position.clone().sub(muzzle)
      const t = toEnemy.dot(dir)
      if (t < 0 || t > GUN_RANGE) continue
      const closestPoint = muzzle.clone().addScaledVector(dir, t)
      const distSq = closestPoint.distanceToSquared(enemy.mesh.position)
      if (distSq <= enemy.hitRadius * enemy.hitRadius && t < closestT) {
        closestT = t
        closestEnemy = enemy
      }
    }

    if (closestEnemy) {
      const hitPoint = muzzle.clone().addScaledVector(dir, closestT)
      this.effects.addTracer(muzzle, hitPoint)
      this.effects.addImpactSpark(hitPoint)
      this.score.recordHit('gun')
      this.onImpact?.(0.15)
      const gunDamage = GUN_DAMAGE * this.damageMultiplier * this.boostDamageMultiplier
      if (this.enemyManager.damageEnemy(closestEnemy, gunDamage)) {
        this._onKill(closestEnemy, 'gun')
      }
    } else {
      this.effects.addTracer(muzzle, muzzle.clone().addScaledVector(dir, GUN_RANGE))
    }
  }

  _fireMissile() {
    this.audioManager?.playSfx('missileFire')
    const forward = this._worldForward()
    const muzzle = this.helicopter.position
      .clone()
      .add(MISSILE_MUZZLE_OFFSET.clone().applyQuaternion(this.helicopter.quaternion))

    let target = null
    let bestDist = Infinity
    for (const enemy of this.enemyManager.getAliveEnemies()) {
      const toEnemy = enemy.mesh.position.clone().sub(muzzle)
      const dist = toEnemy.length()
      if (dist > MISSILE_LOCK_RANGE || dist === 0) continue
      if (toEnemy.angleTo(forward) > MISSILE_LOCK_CONE) continue
      if (dist < bestDist) {
        bestDist = dist
        target = enemy
      }
    }

    const mesh = createMissileMesh()
    mesh.position.copy(muzzle)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward)
    this.scene.add(mesh)

    this.score.recordShot('missile')

    this.missiles.push({
      mesh,
      position: muzzle.clone(),
      velocity: forward.clone().multiplyScalar(MISSILE_SPEED),
      target,
      life: 0,
      trailTimer: 0,
    })
  }

  _updateMissiles(delta) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i]
      missile.life += delta

      if (missile.target && !missile.target.alive) missile.target = null
      if (missile.target) {
        const desired = missile.target.mesh.position.clone().sub(missile.position)
        if (desired.lengthSq() > 0) {
          desired.normalize()
          const current = missile.velocity.clone().normalize()
          const angle = current.angleTo(desired)
          const maxTurn = MISSILE_TURN_RATE * delta
          const steered =
            angle <= maxTurn || angle < 1e-4 ? desired : current.lerp(desired, maxTurn / angle).normalize()
          missile.velocity.copy(steered).multiplyScalar(MISSILE_SPEED)
        }
      }

      missile.position.addScaledVector(missile.velocity, delta)
      missile.mesh.position.copy(missile.position)
      missile.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        missile.velocity.clone().normalize(),
      )

      missile.trailTimer -= delta
      if (missile.trailTimer <= 0) {
        this.effects.addSmokePuff(missile.position.clone())
        missile.trailTimer = MISSILE_TRAIL_INTERVAL
      }

      let hitEnemy = null
      for (const enemy of this.enemyManager.getAliveEnemies()) {
        if (missile.position.distanceTo(enemy.mesh.position) <= enemy.hitRadius + MISSILE_TRIGGER_MARGIN) {
          hitEnemy = enemy
          break
        }
      }

      const groundLevel = getTerrainHeight(missile.position.x, missile.position.z)
      const hitGround = missile.position.y <= groundLevel + 0.3
      const expired = missile.life > MISSILE_LIFETIME

      if (hitEnemy || hitGround || expired) {
        this._explodeMissile(missile, hitEnemy)
        this.missiles.splice(i, 1)
      }
    }
  }

  _explodeMissile(missile, hitEnemy) {
    this.scene.remove(missile.mesh)
    missile.mesh.material.dispose()
    this.effects.addExplosion(missile.position.clone(), { scale: hitEnemy ? 1.4 : 1 })
    this.onExplosion?.(missile.position.clone())

    if (hitEnemy) {
      this.score.recordHit('missile')
      const missileDamage =
        MISSILE_DAMAGE * this.damageMultiplier * this.missileDamageMultiplier * this.boostDamageMultiplier
      if (this.enemyManager.damageEnemy(hitEnemy, missileDamage)) {
        this._onKill(hitEnemy, 'missile')
      }
    }
  }

  _onKill(enemy, weapon) {
    this.score.addKill(weapon, enemy.type)
    this.audioManager?.playSfx('enemyDestroyed')
    this.effects.addExplosion(enemy.mesh.position.clone(), {
      scale: enemy.isBoss ? 3 : enemy.type === 'vehicle' ? 1.3 : 1,
    })
    this.enemyManager.removeEnemy(enemy)
    this.onImpact?.(weapon === 'missile' ? 0.8 : 0.5)
  }

  dispose() {
    for (const missile of this.missiles) {
      this.scene.remove(missile.mesh)
      missile.mesh.material.dispose()
    }
    this.missiles.length = 0
  }
}
