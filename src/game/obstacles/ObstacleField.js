import * as THREE from 'three'
import { mulberry32, WORLD_SEED } from '../rng.js'
import { getTerrainHeight } from '../terrainHeight.js'
import { AIRSPACE } from '../flightModel/airspace.js'
import {
  createBuilding,
  createRadioTower,
  createRockFormation,
  createRadarStation,
  createBunker,
  createAATurret,
  createObjectiveMarker,
} from './models.js'

const CLUSTER_COUNT = 8
const CLUSTER_MIN_RADIUS = 150
const CLUSTER_MAX_RADIUS = AIRSPACE.halfExtent - 150
const CLUSTER_MIN_SEPARATION = 220
const CLUSTER_FOOTPRINT = 45 // radius buildings are scattered within, around each cluster center

const ROCK_COUNT = 26
const ROCK_MIN_RADIUS = 130

const RADAR_COUNT = 6
const BUNKER_COUNT = 8
const AA_TURRET_COUNT = 10
const INSTALLATION_MIN_RADIUS = 90

// AA turrets only bother cosmetically tracking the player within this
// range - purely visual "alertness", no actual shot (see models.js).
const AA_TRACK_RANGE = 260
const AA_YAW_RATE = 1.4
const AA_PITCH_RESPONSE = 2

const OBJECTIVE_COUNT = 3
const OBJECTIVE_NAMES = ['Objective Alpha', 'Objective Bravo', 'Objective Charlie', 'Objective Delta']

const PLAYER_COLLISION_RADIUS = 2.2

// Distance-based level of detail. Three.js frustum-culls what's off-screen
// on its own, but everything in front of the player still gets drawn no
// matter how far away it is, and this map is large enough that a straight
// view can hold every cluster at once. Beyond LOD_HIDE_DISTANCE an obstacle
// is hidden outright - it's smaller than a pixel or two and lost in fog at
// that range anyway (the fog far plane is a Graphics setting, and its
// maximum is below this). Between the two thresholds the moving parts stop
// animating, which is the expensive half.
const LOD_ANIMATE_DISTANCE = 320
const LOD_HIDE_DISTANCE = 1500

function place(scene, mesh, x, z, colliders) {
  mesh.position.set(x, getTerrainHeight(x, z), z)
  scene.add(mesh)
  colliders.push({ x, z, radius: mesh.userData.footprintRadius, height: mesh.userData.height })
}

// Scatters settlements (clusters of buildings + an occasional radio tower),
// standalone rock formations, and a handful of objective beacons across
// the map. Layout is seeded (mulberry32) so it's identical every load -
// "procedural", not re-rolled and disorienting on every refresh. Also owns
// the (player-only, for now) obstacle collision check.
export class ObstacleField {
  constructor(scene) {
    this.scene = scene
    this.meshes = []
    this.colliders = []
    this.objectives = []

    const random = mulberry32(WORLD_SEED ^ 0x51e2c3a1)
    const clusterCenters = this._placeClusters(random)

    this._scatterObstacles(random, clusterCenters, {
      count: ROCK_COUNT,
      minRadius: ROCK_MIN_RADIUS,
      avoidRadius: CLUSTER_FOOTPRINT + 20,
      build: (rnd) => {
        const scale = 0.8 + rnd() * 2.2
        const rock = createRockFormation()
        rock.scale.setScalar(scale)
        rock.userData.footprintRadius *= scale
        rock.userData.height *= scale
        return rock
      },
    })
    this._scatterObstacles(random, clusterCenters, {
      count: RADAR_COUNT,
      minRadius: INSTALLATION_MIN_RADIUS,
      avoidRadius: CLUSTER_FOOTPRINT + 25,
      build: () => createRadarStation(),
    })
    this._scatterObstacles(random, clusterCenters, {
      count: BUNKER_COUNT,
      minRadius: INSTALLATION_MIN_RADIUS,
      avoidRadius: CLUSTER_FOOTPRINT + 25,
      build: () => createBunker(),
    })
    this._scatterObstacles(random, clusterCenters, {
      count: AA_TURRET_COUNT,
      minRadius: INSTALLATION_MIN_RADIUS,
      avoidRadius: CLUSTER_FOOTPRINT + 20,
      build: () => createAATurret(),
    })

    this._pickObjectives(random, clusterCenters)
  }

  _placeClusters(random) {
    const centers = []
    let attempts = 0
    while (centers.length < CLUSTER_COUNT && attempts < CLUSTER_COUNT * 40) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = CLUSTER_MIN_RADIUS + random() * (CLUSTER_MAX_RADIUS - CLUSTER_MIN_RADIUS)
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      if (centers.some((c) => Math.hypot(c.x - x, c.z - z) < CLUSTER_MIN_SEPARATION)) continue
      centers.push({ x, z })
      this._buildCluster(random, x, z)
    }
    return centers
  }

  _buildCluster(random, cx, cz) {
    const buildingCount = 5 + Math.floor(random() * 4)
    const placed = []
    let attempts = 0
    while (placed.length < buildingCount && attempts < buildingCount * 30) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = 8 + random() * CLUSTER_FOOTPRINT
      const x = cx + Math.sin(angle) * radius
      const z = cz + Math.cos(angle) * radius
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 15)) continue
      placed.push({ x, z })

      const width = 6 + random() * 5
      const depth = 6 + random() * 5
      const height = 8 + random() * 18
      const tint = new THREE.Color().setHSL(0.58, 0.08, 0.4 + random() * 0.25).getHex()

      const building = createBuilding({ width, depth, height, tint })
      building.rotation.y = random() * Math.PI * 2
      place(this.scene, building, x, z, this.colliders)
      this.meshes.push(building)
    }

    if (random() < 0.6) {
      const angle = random() * Math.PI * 2
      const radius = CLUSTER_FOOTPRINT + 10
      const x = cx + Math.sin(angle) * radius
      const z = cz + Math.cos(angle) * radius
      const tower = createRadioTower({ height: 24 + random() * 16 })
      place(this.scene, tower, x, z, this.colliders)
      this.meshes.push(tower)
    }
  }

  // Generic "scatter N of this thing across the map, avoiding settlement
  // clusters" pass - used for rocks, radar stations, bunkers, and AA
  // turrets alike, all with the same avoid-overlap logic and just a
  // different builder/count/radius.
  _scatterObstacles(random, clusterCenters, { count, minRadius, avoidRadius, build }) {
    const maxRadius = AIRSPACE.halfExtent - 40
    let placedCount = 0
    let attempts = 0
    while (placedCount < count && attempts < count * 20) {
      attempts++
      const angle = random() * Math.PI * 2
      const radius = minRadius + random() * (maxRadius - minRadius)
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      if (clusterCenters.some((c) => Math.hypot(c.x - x, c.z - z) < avoidRadius)) continue

      const mesh = build(random)
      mesh.rotation.y = random() * Math.PI * 2
      place(this.scene, mesh, x, z, this.colliders)
      this.meshes.push(mesh)
      placedCount++
    }
  }

  _pickObjectives(random, clusterCenters) {
    const shuffled = [...clusterCenters]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const chosen = shuffled.slice(0, Math.min(OBJECTIVE_COUNT, shuffled.length))
    chosen.forEach(({ x, z }, i) => {
      const marker = createObjectiveMarker()
      place(this.scene, marker, x, z, this.colliders)
      this.meshes.push(marker)
      this.objectives.push({ x, z, name: OBJECTIVE_NAMES[i] ?? `Objective ${i + 1}` })
    })
  }

  getObjectives() {
    return this.objectives
  }

  // Soft-wall collision against the player only (enemies currently ignore
  // obstacles - a known simplification, not a physics bug). Same technique
  // as FlightModel's airspace walls: push out of the overlap and cancel the
  // inward velocity component, generalized from an axis-aligned box to an
  // arbitrary circular footprint. Returns the hardest inward impact speed
  // seen this call (0 if no collision) so the caller can tell a graze from
  // a real crash.
  resolvePlayerCollision(flightModel) {
    const { position, velocity } = flightModel
    let impactSpeed = 0
    for (const collider of this.colliders) {
      const dx = position.x - collider.x
      const dz = position.z - collider.z
      const distSq = dx * dx + dz * dz
      const minDist = collider.radius + PLAYER_COLLISION_RADIUS
      if (distSq >= minDist * minDist) continue

      const groundLevel = getTerrainHeight(collider.x, collider.z)
      if (position.y > groundLevel + collider.height + 0.5) continue // clear overhead

      const dist = Math.sqrt(distSq) || 0.0001
      const pushX = dx / dist
      const pushZ = dz / dist
      const overlap = minDist - dist
      position.x += pushX * overlap
      position.z += pushZ * overlap

      const along = velocity.x * pushX + velocity.z * pushZ
      if (along < 0) {
        impactSpeed = Math.max(impactSpeed, -along)
        velocity.x -= pushX * along
        velocity.z -= pushZ * along
      }
    }
    return impactSpeed
  }

  update(delta, playerPosition) {
    for (const mesh of this.meshes) {
      if (playerPosition) {
        const dx = mesh.position.x - playerPosition.x
        const dz = mesh.position.z - playerPosition.z
        const distanceSq = dx * dx + dz * dz
        mesh.visible = distanceSq <= LOD_HIDE_DISTANCE * LOD_HIDE_DISTANCE
        // Far-but-visible props keep their geometry and drop their
        // animation - a dish rotating 800m away is invisible motion that
        // still costs a matrix update every frame.
        if (!mesh.visible || distanceSq > LOD_ANIMATE_DISTANCE * LOD_ANIMATE_DISTANCE) continue
      }

      const ring = mesh.userData.ring
      if (ring) ring.rotation.z += delta * 0.6

      const dish = mesh.userData.dish
      if (dish) dish.rotation.y += delta * 0.4

      const turretPivot = mesh.userData.turretPivot
      if (turretPivot && playerPosition) this._trackPlayer(mesh, turretPivot, delta, playerPosition)
    }
  }

  // Cosmetic-only: eases the turret's yaw/pitch toward the player when in
  // range, purely for "alertness" - see models.js, it never actually
  // fires. `mesh.rotation.y` (the turret's own fixed placement rotation)
  // has to be subtracted out since turretPivot's rotation is local to it.
  _trackPlayer(mesh, turretPivot, delta, playerPosition) {
    const dx = playerPosition.x - mesh.position.x
    const dz = playerPosition.z - mesh.position.z
    const distance = Math.hypot(dx, dz)
    if (distance > AA_TRACK_RANGE || distance < 0.001) return

    const targetYaw = Math.atan2(dx, dz) - mesh.rotation.y
    const yawDiff = Math.atan2(Math.sin(targetYaw - turretPivot.rotation.y), Math.cos(targetYaw - turretPivot.rotation.y))
    turretPivot.rotation.y += THREE.MathUtils.clamp(yawDiff, -AA_YAW_RATE * delta, AA_YAW_RATE * delta)

    const barrelPivot = mesh.userData.barrelPivot
    if (!barrelPivot) return
    const dy = playerPosition.y - (mesh.position.y + 0.9)
    const targetPitch = -THREE.MathUtils.clamp(Math.atan2(dy, distance), 0, Math.PI / 2.4)
    const ease = 1 - Math.exp(-AA_PITCH_RESPONSE * delta)
    barrelPivot.rotation.x += (targetPitch - barrelPivot.rotation.x) * ease
  }

  dispose() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh)
      mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((m) => m.dispose())
        }
      })
    }
    this.meshes.length = 0
    this.colliders.length = 0
    this.objectives.length = 0
  }
}
