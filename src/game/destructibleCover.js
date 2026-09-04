import * as THREE from 'three'
import { getTerrainHeight } from './terrainHeight.js'

const CRATE_HEALTH = 40
const EXPLOSION_DAMAGE = 25
const EXPLOSION_DAMAGE_RADIUS = 10
const COVER_RADIUS = 14 // proximity for the damage-reduction aura
const COVER_DAMAGE_REDUCTION = 0.5

function createCrateMesh() {
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.9, metalness: 0.05 })
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.8 })

  const group = new THREE.Group()
  group.name = 'cover-crate'

  const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 3.2), crateMat)
  base.position.y = 1.1
  group.add(base)

  const strapA = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.3), strapMat)
  strapA.position.set(0, 1.6, 0)
  group.add(strapA)
  const strapB = strapA.clone()
  strapB.rotation.y = Math.PI / 2
  group.add(strapB)

  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true
  })
  return group
}

// Destructible cover crates scattered around a boss arena - "destructible
// obstacles for cover/advantage". Rather than precise hitscan raycasting
// against every crate (which would mean threading a whole extra collision
// pass through WeaponSystem/BossController), a crate is damaged by ANY
// explosion within range - the player's own missiles, the boss's barrage,
// hazard strikes - via `notifyExplosion()`, which createScene.js calls from
// every explosion-producing system's callback. While intact, being near one
// reduces incoming boss-attack damage (`damageReductionAt`) - an abstracted
// stand-in for using it as physical cover, not literal projectile blocking.
export class DestructibleCover {
  constructor(scene, points) {
    this.scene = scene
    this.items = points.map((p) => {
      const mesh = createCrateMesh()
      mesh.position.set(p.x, getTerrainHeight(p.x, p.z), p.z)
      scene.add(mesh)
      return { mesh, health: CRATE_HEALTH, maxHealth: CRATE_HEALTH, alive: true }
    })
  }

  notifyExplosion(position) {
    for (const item of this.items) {
      if (!item.alive) continue
      if (item.mesh.position.distanceTo(position) > EXPLOSION_DAMAGE_RADIUS) continue
      item.health -= EXPLOSION_DAMAGE
      if (item.health <= 0) this._destroy(item)
    }
  }

  damageReductionAt(position) {
    for (const item of this.items) {
      if (item.alive && item.mesh.position.distanceTo(position) <= COVER_RADIUS) return COVER_DAMAGE_REDUCTION
    }
    return 0
  }

  _destroy(item) {
    item.alive = false
    item.mesh.visible = false
  }

  dispose() {
    for (const item of this.items) {
      this.scene.remove(item.mesh)
      item.mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((m) => m.dispose())
        }
      })
    }
    this.items.length = 0
  }
}
