import * as THREE from 'three'
import { createHelicopter } from './helicopter.js'
import { getTerrainHeight } from './terrainHeight.js'
import { PlayerHealth } from './playerHealth.js'

const ARRIVAL_RADIUS = 15
const CRUISE_ALTITUDE_ABOVE_GROUND = 24
const ALTITUDE_EASE = 1.2
const SPAWN_SETBACK = 90 // spawn this far short of waypoint 0, so "WP 0/N" is accurate at mission start instead of instantly reading 1/N

// Distinct paint from any player customization option or enemy model, so
// "which one do I protect" is never ambiguous at a glance.
const NPC_COLORS = { bodyColor: 0x4fd67f, accentColor: 0xffffff, glassColor: 0xcfe8ff, darkColor: 0x1c1c1e }

// The escort mission type's AI-flown protectee: autopilots a fixed
// waypoint route (no player input, no combat AI - it doesn't fight back)
// while EnemyWeaponSystem can target it like any other target (see its
// `targets` array). Reuses the player's own helicopter model (recolored)
// and PlayerHealth (already a generic health/damage/alive class with no
// THREE dependency) rather than introducing parallel types for either.
export class EscortNPC {
  constructor(scene, { waypoints, health = 60, speed = 9 }) {
    this.scene = scene
    this.mesh = createHelicopter(NPC_COLORS)
    this.waypoints = waypoints
    this.currentIndex = 0
    this.speed = speed
    this.health = new PlayerHealth(health)

    // Spawn set back from waypoint 0 along the line toward waypoint 1 (or a
    // fixed direction if there's only one point) rather than exactly on it -
    // otherwise the arrival check trips on the very first tick and the
    // mission starts already reading "WP 1/N".
    const [first, second] = waypoints
    let dx = 0
    let dz = 1
    if (second) {
      const len = Math.hypot(second.x - first.x, second.z - first.z) || 1
      dx = (first.x - second.x) / len
      dz = (first.z - second.z) / len
    }
    const spawnX = first.x + dx * SPAWN_SETBACK
    const spawnZ = first.z + dz * SPAWN_SETBACK
    this.mesh.position.set(spawnX, getTerrainHeight(spawnX, spawnZ) + CRUISE_ALTITUDE_ABOVE_GROUND, spawnZ)
    scene.add(this.mesh)
  }

  get position() {
    return this.mesh.position
  }

  get hitRadius() {
    return 2.4
  }

  // True once the final waypoint has been reached - the escort mission's
  // win condition.
  get arrived() {
    return this.currentIndex >= this.waypoints.length
  }

  update(delta) {
    if (!this.health.alive || this.arrived) return

    const target = this.waypoints[this.currentIndex]
    const dx = target.x - this.mesh.position.x
    const dz = target.z - this.mesh.position.z
    const distance = Math.hypot(dx, dz)
    if (distance <= ARRIVAL_RADIUS) {
      this.currentIndex++
      return
    }

    const heading = Math.atan2(dx, dz)
    this.mesh.position.x += Math.sin(heading) * this.speed * delta
    this.mesh.position.z += Math.cos(heading) * this.speed * delta

    const desiredAltitude = getTerrainHeight(this.mesh.position.x, this.mesh.position.z) + CRUISE_ALTITUDE_ABOVE_GROUND
    const ease = 1 - Math.exp(-ALTITUDE_EASE * delta)
    this.mesh.position.y += (desiredAltitude - this.mesh.position.y) * ease

    this.mesh.quaternion.setFromEuler(new THREE.Euler(0, heading, 0, 'YXZ'))

    const rotor = this.mesh.userData.mainRotor
    const tailRotor = this.mesh.userData.tailRotor
    if (rotor) rotor.rotation.y += delta * 16
    if (tailRotor) tailRotor.rotation.x += delta * 24
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach((m) => m.dispose())
      }
    })
  }
}
