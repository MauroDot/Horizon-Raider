import * as THREE from 'three'
import { getTerrainHeight } from '../terrainHeight.js'
import { AIRSPACE } from '../flightModel/airspace.js'
import {
  createScoutHelicopter,
  createGunshipHelicopter,
  createTransportHelicopter,
  createEnemyVehicle,
  createAPC,
} from './models.js'

const HELI_MAX_BANK = THREE.MathUtils.degToRad(22)
const HELI_ALTITUDE_EASE = 1.4
const VEHICLE_CLEARANCE = 0.3

const SPAWN_MIN_RADIUS = 100
const SPAWN_MAX_RADIUS = Math.min(AIRSPACE.halfExtent - 40, 600)
const RESPAWN_INTERVAL = 4 // seconds between free-play replacement spawns, paced so it doesn't swarm

const PATROL_RADIUS = 20 // how far a not-yet-alerted recon enemy orbits its spawn point
const PATROL_ORBIT_RATE = 0.3

// Per-variant stats + model builder. Weighted so gunships (the "standard"
// threat) are most common, with scouts and transports as the light/heavy
// ends of the roster. Each entry's own speed/turnRate/standoff feed
// straight into the shared pursuit AI below.
const HELI_VARIANTS = [
  {
    variant: 'scout',
    build: createScoutHelicopter,
    weight: 3,
    health: 18,
    speed: 12,
    turnRate: THREE.MathUtils.degToRad(115),
    standoff: 22,
  },
  {
    variant: 'gunship',
    build: createGunshipHelicopter,
    weight: 4,
    health: 35,
    speed: 9,
    turnRate: THREE.MathUtils.degToRad(85),
    standoff: 28,
  },
  {
    variant: 'transport',
    build: createTransportHelicopter,
    weight: 2,
    health: 55,
    speed: 6,
    turnRate: THREE.MathUtils.degToRad(55),
    standoff: 34,
  },
]

const VEHICLE_VARIANTS = [
  {
    variant: 'tank',
    build: createEnemyVehicle,
    weight: 3,
    health: 50,
    speed: 5.5,
    turnRate: THREE.MathUtils.degToRad(60),
    standoff: 14,
  },
  {
    variant: 'apc',
    build: createAPC,
    weight: 2,
    health: 28,
    speed: 8,
    turnRate: THREE.MathUtils.degToRad(85),
    standoff: 16,
  },
]

function pickWeighted(list) {
  const total = list.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  for (const item of list) {
    if (roll < item.weight) return item
    roll -= item.weight
  }
  return list[list.length - 1]
}

function angleDiff(target, current) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current))
}

function randomSpawnPoint() {
  const angle = Math.random() * Math.PI * 2
  const radius = SPAWN_MIN_RADIUS + Math.random() * (SPAWN_MAX_RADIUS - SPAWN_MIN_RADIUS)
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius }
}

// A couple of small glowing orb "pods" bolted to a boss's flanks - cheap
// extra visual distinction ("more detailed") beyond scale and a material
// tint, without hand-modeling a whole separate boss airframe.
function _addBossPods(mesh, glowColor) {
  const podGeo = new THREE.SphereGeometry(0.16, 8, 8)
  const podMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: 1.6,
  })
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, podMat)
    pod.position.set(side * 1.7, 0.1, -0.4)
    mesh.add(pod)
  }
  mesh.userData.glowMaterials.push(podMat)
}

// Enemy roster + simple pursuit AI. Helicopters seek the player and orbit
// once within standoff range (banking into their turns); ground vehicles
// seek the player's horizontal position and hug the terrain. Both stay
// inside the same flyable airspace the player is bound to. Each spawn picks
// a visually- and statistically-distinct variant (see HELI_VARIANTS /
// VEHICLE_VARIANTS) rather than every enemy of a type being identical.
export class EnemyManager {
  // `respawn` is Free Play's "unlimited enemies" sandbox: destroyed
  // hostiles are quietly replaced (paced by RESPAWN_INTERVAL) so the roster
  // count holds steady instead of depleting. Off by default for missions,
  // which are a fixed roster tied to a kill-count objective.
  //
  // `healthMultiplier` is difficulty.js's enemyHealthMultiplier, applied to
  // every spawned enemy's health pool (roster *size* is instead just
  // `helicopterCount`/`vehicleCount` scaled by the caller before
  // constructing - no separate knob needed for that half of it).
  //
  // `patrolMode`: recon missions' stealth mechanic. Enemies spawn "patrol"
  // (idle/orbiting their own spawn point, ignoring the player) rather than
  // immediately pursuing - see checkDetection(). Off (normal pursuit from
  // the start) for every other mission type and Free Play.
  constructor(
    scene,
    { helicopterCount = 10, vehicleCount = 10, respawn = false, healthMultiplier = 1, patrolMode = false } = {},
  ) {
    this.scene = scene
    this.enemies = []
    this.respawn = respawn
    this.healthMultiplier = healthMultiplier
    this.patrolMode = patrolMode
    this._targetHeliCount = helicopterCount
    this._targetVehicleCount = vehicleCount
    this._respawnTimer = RESPAWN_INTERVAL

    for (let i = 0; i < helicopterCount; i++) this._spawnHelicopter()
    for (let i = 0; i < vehicleCount; i++) this._spawnVehicle()
  }

  _spawnHelicopter() {
    const def = pickWeighted(HELI_VARIANTS)
    const mesh = def.build()
    const { x, z } = randomSpawnPoint()
    const y = getTerrainHeight(x, z) + 20 + Math.random() * 45
    mesh.position.set(x, Math.min(y, AIRSPACE.maxAltitude - 10), z)
    this.scene.add(mesh)

    const health = def.health * this.healthMultiplier
    this.enemies.push({
      type: 'heli',
      variant: def.variant,
      mesh,
      health,
      maxHealth: health,
      hitRadius: mesh.userData.hitRadius,
      speed: def.speed,
      turnRate: def.turnRate,
      standoff: def.standoff,
      alive: true,
      heading: Math.random() * Math.PI * 2,
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      altitudeOffset: Math.random() * 12 - 6,
      mode: this.patrolMode ? 'patrol' : 'aware',
      homeX: x,
      homeZ: z,
      homeAltitude: mesh.position.y,
    })
  }

  _spawnVehicle() {
    const def = pickWeighted(VEHICLE_VARIANTS)
    const mesh = def.build()
    const { x, z } = randomSpawnPoint()
    const y = getTerrainHeight(x, z) + VEHICLE_CLEARANCE
    mesh.position.set(x, y, z)
    this.scene.add(mesh)

    const health = def.health * this.healthMultiplier
    this.enemies.push({
      type: 'vehicle',
      variant: def.variant,
      mesh,
      health,
      maxHealth: health,
      hitRadius: mesh.userData.hitRadius,
      speed: def.speed,
      turnRate: def.turnRate,
      standoff: def.standoff,
      alive: true,
      heading: Math.random() * Math.PI * 2,
      mode: this.patrolMode ? 'patrol' : 'aware',
      homeX: x,
      homeZ: z,
    })
  }

  // A single named, heavily-buffed unique enemy for a boss mission -
  // bypasses the normal roster/respawn bookkeeping entirely (it's not part
  // of `_targetHeliCount` and never gets replaced if killed). Returns the
  // enemy record so the caller can track its `.alive` directly rather than
  // hunting for it. `variant` picks the base airframe/stats from
  // HELI_VARIANTS; `healthMultiplier` (on top of the manager's own
  // difficulty-scaled one) is the mission's bossHealthMultiplier.
  //
  // `enemy.controlled = true` tells this manager's own update() to skip its
  // usual pursuit AI for this enemy entirely - createScene.js attaches a
  // BossController to drive its movement/attacks instead (see
  // bossController.js). `enemy.mesh.userData.glowMaterials` collects every
  // material tinted with the boss's glow color, for BossController's
  // telegraph pulse to brighten.
  spawnBoss({ variant = 'gunship', healthMultiplier = 5, position, glowColor = 0xff5522 } = {}) {
    const def = HELI_VARIANTS.find((v) => v.variant === variant) ?? HELI_VARIANTS[1]
    const mesh = def.build()
    mesh.scale.setScalar(1.6) // reads as "bigger, tougher" at a glance, distinct from the regular roster
    const { x, z } = position ?? randomSpawnPoint()
    const y = getTerrainHeight(x, z) + 40
    mesh.position.set(x, Math.min(y, AIRSPACE.maxAltitude - 15), z)
    this.scene.add(mesh)

    // Glow every material on the boss - "visual distinction... glowing
    // effects" - and remember them so the boss controller can pulse the
    // intensity brighter during an attack telegraph.
    const glowMaterials = []
    mesh.traverse((obj) => {
      if (obj.isMesh && obj.material?.isMeshStandardMaterial) {
        obj.material.emissive = new THREE.Color(glowColor)
        obj.material.emissiveIntensity = 0.6
        glowMaterials.push(obj.material)
      }
    })
    mesh.userData.glowMaterials = glowMaterials
    _addBossPods(mesh, glowColor)

    const health = def.health * this.healthMultiplier * healthMultiplier
    const enemy = {
      type: 'heli',
      variant: def.variant,
      mesh,
      health,
      maxHealth: health,
      hitRadius: mesh.userData.hitRadius * 1.5,
      speed: def.speed * 1.15,
      turnRate: def.turnRate * 1.1,
      standoff: def.standoff * 1.3,
      alive: true,
      heading: Math.random() * Math.PI * 2,
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      altitudeOffset: 0,
      mode: 'aware',
      homeX: x,
      homeZ: z,
      isBoss: true,
      controlled: true,
    }
    this.enemies.push(enemy)
    return enemy
  }

  // "Defensive turret deployment" for The Titan's phase 2 - reuses the
  // existing ground-vehicle roster/AI/weapons (tank/APC) as defensive
  // reinforcements around a position, rather than a separate static-gun-
  // emplacement system. Bypasses roster/respawn bookkeeping like spawnBoss.
  spawnGroundAdds(position, count = 3) {
    const spawned = []
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
      const radius = 22 + Math.random() * 12
      const x = position.x + Math.sin(angle) * radius
      const z = position.z + Math.cos(angle) * radius
      const def = pickWeighted(VEHICLE_VARIANTS)
      const mesh = def.build()
      const y = getTerrainHeight(x, z) + VEHICLE_CLEARANCE
      mesh.position.set(x, y, z)
      this.scene.add(mesh)

      const health = def.health * this.healthMultiplier
      const enemy = {
        type: 'vehicle',
        variant: def.variant,
        mesh,
        health,
        maxHealth: health,
        hitRadius: mesh.userData.hitRadius,
        speed: def.speed,
        turnRate: def.turnRate,
        standoff: def.standoff,
        alive: true,
        heading: Math.random() * Math.PI * 2,
        mode: 'aware',
        homeX: x,
        homeZ: z,
        isBossAdd: true,
      }
      this.enemies.push(enemy)
      spawned.push(enemy)
    }
    return spawned
  }

  getAliveEnemies() {
    return this.enemies.filter((e) => e.alive)
  }

  // Recon's stealth check: any 'patrol' enemy within `radius` of
  // `playerPosition` flips to 'aware' (permanently - no de-alerting) and
  // this returns true for "the player was just detected this call".
  // Non-patrol managers (every mission type except recon) never have any
  // 'patrol' enemies, so this is always false for them - safe to call
  // unconditionally.
  checkDetection(playerPosition, radius) {
    let detected = false
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.mode !== 'patrol') continue
      const dx = enemy.mesh.position.x - playerPosition.x
      const dz = enemy.mesh.position.z - playerPosition.z
      if (Math.hypot(dx, dz) <= radius) {
        enemy.mode = 'aware'
        detected = true
      }
    }
    return detected
  }

  // Returns true if this hit killed the enemy.
  damageEnemy(enemy, amount) {
    if (!enemy.alive) return false
    enemy.health -= amount
    if (enemy.health <= 0) {
      enemy.alive = false
      return true
    }
    return false
  }

  removeEnemy(enemy) {
    this.scene.remove(enemy.mesh)
    enemy.mesh.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach((m) => m.dispose())
      }
    })
    const index = this.enemies.indexOf(enemy)
    if (index !== -1) this.enemies.splice(index, 1)
  }

  update(delta, playerPosition) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      // `controlled` enemies (bosses) are driven externally by a
      // BossController - this loop still spins their rotors below, just
      // skips the generic pursuit/patrol movement.
      if (enemy.controlled) {
        // no-op
      } else if (enemy.mode === 'patrol') {
        this._updatePatrol(enemy, delta)
      } else if (enemy.type === 'heli') {
        this._updateHelicopter(enemy, delta, playerPosition)
      } else {
        this._updateVehicle(enemy, delta, playerPosition)
      }

      const rotor = enemy.mesh.userData.mainRotor
      const secondaryRotor = enemy.mesh.userData.secondaryRotor // transport's aft rotor, if present
      const tailRotor = enemy.mesh.userData.tailRotor
      if (rotor) rotor.rotation.y += delta * 16
      if (secondaryRotor) secondaryRotor.rotation.y -= delta * 16 // counter-rotating, like a real tandem-rotor aircraft
      if (tailRotor) tailRotor.rotation.x += delta * 24
    }

    if (this.respawn) this._updateRespawn(delta)
  }

  // Not-yet-alerted recon enemies: helicopters slowly orbit their spawn
  // point, ground vehicles just idle in place - both read as "on guard,
  // not hunting", distinct from the normal pursuit AI they switch to the
  // instant checkDetection() catches the player nearby.
  _updatePatrol(enemy, delta) {
    if (enemy.type !== 'heli') {
      enemy.mesh.quaternion.setFromEuler(new THREE.Euler(0, enemy.heading, 0, 'YXZ'))
      return
    }
    enemy.heading += PATROL_ORBIT_RATE * delta
    enemy.mesh.position.x = enemy.homeX + Math.sin(enemy.heading) * PATROL_RADIUS
    enemy.mesh.position.z = enemy.homeZ + Math.cos(enemy.heading) * PATROL_RADIUS
    enemy.mesh.position.y = enemy.homeAltitude
    const bank = 0.15
    enemy.mesh.quaternion.setFromEuler(new THREE.Euler(0, enemy.heading + Math.PI / 2, bank, 'YXZ'))
  }

  _updateRespawn(delta) {
    this._respawnTimer -= delta
    if (this._respawnTimer > 0) return
    this._respawnTimer = RESPAWN_INTERVAL

    const aliveHeli = this.enemies.filter((e) => e.type === 'heli').length
    const aliveVehicle = this.enemies.filter((e) => e.type === 'vehicle').length
    if (aliveHeli < this._targetHeliCount) this._spawnHelicopter()
    else if (aliveVehicle < this._targetVehicleCount) this._spawnVehicle()
  }

  _updateHelicopter(enemy, delta, playerPosition) {
    const { mesh } = enemy
    const toPlayer = new THREE.Vector2(
      playerPosition.x - mesh.position.x,
      playerPosition.z - mesh.position.z,
    )
    const distance = toPlayer.length()

    let moveDir
    if (distance > enemy.standoff) {
      moveDir = toPlayer.clone().normalize()
    } else {
      // Close enough - orbit rather than collide.
      const inward = toPlayer.clone().normalize()
      moveDir = new THREE.Vector2(-inward.y, inward.x).multiplyScalar(enemy.orbitDir)
    }

    const targetHeading = Math.atan2(moveDir.x, moveDir.y)
    const turn = THREE.MathUtils.clamp(
      angleDiff(targetHeading, enemy.heading),
      -enemy.turnRate * delta,
      enemy.turnRate * delta,
    )
    enemy.heading += turn
    const bank = THREE.MathUtils.clamp(-turn / (enemy.turnRate * delta || 1), -1, 1) * HELI_MAX_BANK

    mesh.position.x += Math.sin(enemy.heading) * enemy.speed * delta
    mesh.position.z += Math.cos(enemy.heading) * enemy.speed * delta

    const groundLevel = getTerrainHeight(mesh.position.x, mesh.position.z)
    const desiredAltitude = THREE.MathUtils.clamp(
      playerPosition.y + enemy.altitudeOffset,
      groundLevel + AIRSPACE.minAltitudeAboveGround + 4,
      AIRSPACE.maxAltitude - 5,
    )
    const ease = 1 - Math.exp(-HELI_ALTITUDE_EASE * delta)
    mesh.position.y += (desiredAltitude - mesh.position.y) * ease

    const halfExtent = AIRSPACE.halfExtent
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -halfExtent, halfExtent)
    mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -halfExtent, halfExtent)

    mesh.quaternion.setFromEuler(new THREE.Euler(0, enemy.heading, bank, 'YXZ'))
  }

  _updateVehicle(enemy, delta, playerPosition) {
    const { mesh } = enemy
    const toPlayer = new THREE.Vector2(
      playerPosition.x - mesh.position.x,
      playerPosition.z - mesh.position.z,
    )
    const distance = toPlayer.length()

    if (distance > enemy.standoff) {
      const moveDir = toPlayer.clone().normalize()
      const targetHeading = Math.atan2(moveDir.x, moveDir.y)
      const turn = THREE.MathUtils.clamp(
        angleDiff(targetHeading, enemy.heading),
        -enemy.turnRate * delta,
        enemy.turnRate * delta,
      )
      enemy.heading += turn

      // Only drive forward once roughly facing the target - avoids sliding sideways.
      const facingError = Math.abs(angleDiff(targetHeading, enemy.heading))
      const speedFactor = facingError < Math.PI / 3 ? 1 : 0.15
      mesh.position.x += Math.sin(enemy.heading) * enemy.speed * speedFactor * delta
      mesh.position.z += Math.cos(enemy.heading) * enemy.speed * speedFactor * delta
    }

    const halfExtent = AIRSPACE.halfExtent
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -halfExtent, halfExtent)
    mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -halfExtent, halfExtent)
    mesh.position.y = getTerrainHeight(mesh.position.x, mesh.position.z) + VEHICLE_CLEARANCE

    mesh.quaternion.setFromEuler(new THREE.Euler(0, enemy.heading, 0, 'YXZ'))
  }

  dispose() {
    for (const enemy of [...this.enemies]) this.removeEnemy(enemy)
  }
}
