import * as THREE from 'three'
import { getTerrainHeight } from '../terrainHeight.js'
import { createEnemyProjectileMesh } from './enemyProjectileModel.js'

const STATS = {
  heli: {
    range: 140,
    cone: THREE.MathUtils.degToRad(40),
    cooldown: 0.8,
    damage: 5,
    speed: 55,
    muzzleOffset: new THREE.Vector3(0, -0.1, 1.8),
  },
  vehicle: {
    range: 110,
    cone: THREE.MathUtils.degToRad(35),
    cooldown: 1.8,
    damage: 12,
    speed: 45,
    muzzleOffset: new THREE.Vector3(0, 1.25, 2.6),
  },
}

const PROJECTILE_LIFETIME = 4
const DEFAULT_HIT_RADIUS = 2

// Enemy return fire: each alive enemy gets its own cooldown (tracked in a
// WeakMap so EnemyManager doesn't need to know weapons exist at all). When
// an enemy is within range and roughly facing a target it fires a plain
// (non-homing) tracer round toward that target's position at that instant -
// slow enough, and aimed only at the moment of firing, that a target which
// keeps moving can out-fly it.
//
// `targets` is a list of everything enemies can shoot at - just the player
// on a normal mission, plus an escort NPC on an escort mission (see
// createScene.js). Each entry is `{ mesh, health, hitRadius, onHit,
// flareStateRef? }` where `health` is anything with `.alive`/`.takeDamage()`
// (PlayerHealth satisfies this for both the player and an EscortNPC).
// Every firing enemy independently picks whichever alive target is closest
// and in its cone - there's no "assigned" target.
const FLARE_MISS_CHANCE = 0.6

export class EnemyWeaponSystem {
  // `accuracy` (0..1, from difficulty.js's enemyAccuracy) is the chance an
  // enemy actually takes a shot once it has one lined up - the cooldown
  // still resets on a "held fire" roll, so it reads as enemies being more
  // or less trigger-happy rather than obviously whiffing.
  constructor({ scene, effects, enemyManager, targets, accuracy = 0.7 }) {
    this.scene = scene
    this.effects = effects
    this.enemyManager = enemyManager
    this.targets = targets
    this.accuracy = accuracy

    this._cooldowns = new WeakMap()
    this.projectiles = []
  }

  update(delta) {
    if (this.targets.some((t) => t.health.alive)) {
      for (const enemy of this.enemyManager.getAliveEnemies()) {
        // Bosses have their own BossController driving unique attack
        // patterns (telegraphed barrages/charges) - the generic weak
        // per-enemy potshot here would just be redundant chip damage on
        // top of that, not "coordinated" so much as noisy.
        if (enemy.isBoss) continue
        this._maybeFire(enemy, delta)
      }
    }
    this._updateProjectiles(delta)
  }

  _maybeFire(enemy, delta) {
    const stats = STATS[enemy.type]
    let state = this._cooldowns.get(enemy)
    if (!state) {
      state = { cooldown: Math.random() * stats.cooldown }
      this._cooldowns.set(enemy, state)
    }
    state.cooldown -= delta
    if (state.cooldown > 0) return

    const picked = this._pickTarget(enemy, stats)
    if (!picked) return

    state.cooldown = stats.cooldown * (0.8 + Math.random() * 0.4)

    if (Math.random() > this.accuracy) return // held fire this cycle

    // Flares/chaff: the enemy still "fires" (cooldown resets normally) but
    // the shot is spoofed away more often than not while active.
    if (picked.target.flareStateRef?.active && Math.random() < FLARE_MISS_CHANCE) return

    this._fire(enemy, stats, picked)
  }

  // Nearest alive, in-range, in-cone target - independently per enemy, so
  // a mixed crowd of enemies near both the player and an escort NPC splits
  // its fire naturally rather than every enemy fixating on one.
  _pickTarget(enemy, stats) {
    let best = null
    let bestDistance = Infinity
    for (const target of this.targets) {
      if (!target.health.alive) continue
      const toTarget = target.mesh.position.clone().sub(enemy.mesh.position)
      const distance = toTarget.length()
      if (distance === 0 || distance > stats.range) continue
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion)
      if (toTarget.angleTo(forward) > stats.cone) continue
      if (distance < bestDistance) {
        bestDistance = distance
        best = { target, direction: toTarget.normalize() }
      }
    }
    return best
  }

  _fire(enemy, stats, picked) {
    const muzzle = enemy.mesh.position
      .clone()
      .add(stats.muzzleOffset.clone().applyQuaternion(enemy.mesh.quaternion))

    const mesh = createEnemyProjectileMesh()
    mesh.position.copy(muzzle)
    this.scene.add(mesh)

    this.projectiles.push({
      mesh,
      position: muzzle.clone(),
      velocity: picked.direction.clone().multiplyScalar(stats.speed),
      damage: stats.damage,
      life: 0,
    })
  }

  _updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i]
      projectile.life += delta
      projectile.position.addScaledVector(projectile.velocity, delta)
      projectile.mesh.position.copy(projectile.position)

      let hitTarget = null
      for (const target of this.targets) {
        if (!target.health.alive) continue
        const dist = projectile.position.distanceTo(target.mesh.position)
        if (dist <= (target.hitRadius ?? DEFAULT_HIT_RADIUS)) {
          hitTarget = target
          break
        }
      }

      const groundLevel = getTerrainHeight(projectile.position.x, projectile.position.z)
      const hitGround = projectile.position.y <= groundLevel
      const expired = projectile.life > PROJECTILE_LIFETIME

      if (hitTarget || hitGround || expired) {
        this._removeProjectile(i)
        if (hitTarget) {
          this.effects.addImpactSpark(projectile.position.clone())
          hitTarget.health.takeDamage(projectile.damage)
          hitTarget.onHit?.(projectile.damage)
        } else if (hitGround) {
          this.effects.addImpactSpark(projectile.position.clone())
          this.effects.addGroundDust(projectile.position.clone(), { scale: 0.7 })
        }
      }
    }
  }

  _removeProjectile(index) {
    const [projectile] = this.projectiles.splice(index, 1)
    this.scene.remove(projectile.mesh)
    projectile.mesh.material.dispose()
  }

  dispose() {
    for (const projectile of this.projectiles) {
      this.scene.remove(projectile.mesh)
      projectile.mesh.material.dispose()
    }
    this.projectiles.length = 0
  }
}
