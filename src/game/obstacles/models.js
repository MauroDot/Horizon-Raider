import * as THREE from 'three'
import { createFacadeTexture } from '../textures.js'

const facadeTexture = createFacadeTexture()
facadeTexture.repeat.set(2, 3)

export function createBuilding({ width = 8, depth = 8, height = 14, tint = 0x8a8f96 } = {}) {
  const group = new THREE.Group()
  group.name = 'building'

  const wallMat = new THREE.MeshStandardMaterial({
    map: facadeTexture,
    color: tint,
    roughness: 0.85,
    metalness: 0.1,
  })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.9 })

  const hull = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat)
  hull.position.y = height / 2
  hull.castShadow = true
  hull.receiveShadow = true
  group.add(hull)

  const roofHeight = height * 0.05
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 1.04, roofHeight, depth * 1.04), roofMat)
  roof.position.y = height + roofHeight / 2
  roof.castShadow = true
  group.add(roof)

  group.userData.footprintRadius = Math.hypot(width, depth) / 2
  group.userData.height = height + roofHeight
  return group
}

export function createRadioTower({ height = 32 } = {}) {
  const group = new THREE.Group()
  group.name = 'radioTower'

  const towerMat = new THREE.MeshStandardMaterial({ color: 0xb0392f, roughness: 0.6, metalness: 0.4 })
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, height, 6), towerMat)
  mast.position.y = height / 2
  mast.castShadow = true
  group.add(mast)

  const braceGeo = new THREE.BoxGeometry(2.6, 0.15, 0.15)
  const braceCount = 5
  for (let i = 0; i < braceCount; i++) {
    const y = (height / braceCount) * (i + 0.5)
    const scale = 1 - (y / height) * 0.65
    const braceA = new THREE.Mesh(braceGeo, towerMat)
    braceA.position.y = y
    braceA.scale.x = scale
    group.add(braceA)
    const braceB = new THREE.Mesh(braceGeo, towerMat)
    braceB.position.y = y
    braceB.scale.x = scale
    braceB.rotation.y = Math.PI / 2
    group.add(braceB)
  }

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff3b30,
    emissive: 0xff3b30,
    emissiveIntensity: 1.4,
  })
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), beaconMat)
  beacon.position.y = height + 0.6
  group.add(beacon)

  group.userData.footprintRadius = 2.5
  group.userData.height = height + 1.2
  group.userData.beacon = beacon
  return group
}

const ROCK_SPECS = [
  { pos: [0, 0.9, 0], scale: 1.6, rot: 0.3 },
  { pos: [1.3, 0.5, 0.6], scale: 1.0, rot: 1.1 },
  { pos: [-1.1, 0.4, -0.8], scale: 1.1, rot: 2.0 },
  { pos: [0.4, 0.35, -1.4], scale: 0.8, rot: 2.7 },
]

export function createRockFormation() {
  const group = new THREE.Group()
  group.name = 'rockFormation'
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b6459, roughness: 1, flatShading: true })

  for (const { pos, scale, rot } of ROCK_SPECS) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat)
    rock.position.set(...pos)
    rock.scale.setScalar(scale)
    rock.rotation.set(rot * 0.6, rot, rot * 0.3)
    rock.castShadow = true
    rock.receiveShadow = true
    group.add(rock)
  }

  group.userData.footprintRadius = 2.6
  group.userData.height = 2.2
  return group
}

// Small installation building with a rotating dish - `userData.dish` spins
// continuously (ObstacleField.update), independent of the player.
export function createRadarStation() {
  const group = new THREE.Group()
  group.name = 'radarStation'

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x6b7268, roughness: 0.85, metalness: 0.15 })
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xd8dcd6,
    roughness: 0.5,
    metalness: 0.25,
    side: THREE.DoubleSide,
  })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.3 })

  const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), baseMat)
  base.position.y = 1.2
  group.add(base)

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 8), darkMat)
  mast.position.y = 2.4 + 0.8
  group.add(mast)

  const dish = new THREE.Group()
  dish.position.y = 2.4 + 1.6
  group.add(dish)

  const dishFace = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 14, 1, true), dishMat)
  dishFace.rotation.z = Math.PI / 2
  dishFace.position.x = 0.28
  dish.add(dishFace)
  const dishStrut = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), darkMat)
  dishStrut.position.x = -0.1
  dish.add(dishStrut)

  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true
  })

  group.userData.footprintRadius = 2.2
  group.userData.height = 2.4 + 1.6 + 1.5
  group.userData.dish = dish
  return group
}

// Low concrete pillbox with a firing slit and an earth berm - static, no
// moving parts.
export function createBunker() {
  const group = new THREE.Group()
  group.name = 'bunker'

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8a887c, roughness: 0.95, metalness: 0.05 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.75 })
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x5a4f3a, roughness: 1, flatShading: true })

  const base = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 4), concreteMat)
  base.position.y = 0.8
  group.add(base)

  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.45, 4.6), concreteMat)
  roof.position.y = 1.8
  group.add(roof)

  const slit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 0.12), darkMat)
  slit.position.set(0, 1.0, 2.03)
  group.add(slit)

  const bermGeo = new THREE.BoxGeometry(1.6, 0.9, 1.6)
  for (const [x, z, rotY] of [
    [-3.2, -1.5, 0.3],
    [-3.2, 1.5, 1.1],
    [3.2, -1.5, 2.0],
    [3.2, 1.5, 2.7],
  ]) {
    const berm = new THREE.Mesh(bermGeo, earthMat)
    berm.position.set(x, 0.45, z)
    berm.rotation.y = rotY
    group.add(berm)
  }

  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true
  })

  group.userData.footprintRadius = 3.6
  group.userData.height = 2.05
  return group
}

// Rotating twin-barrel anti-air mount - `userData.turretPivot` (yaw) and
// `.barrelPivot` (elevation) let ObstacleField cosmetically track the
// player when in range. Static/no actual gameplay threat (see game
// design notes) - it just looks alert.
export function createAATurret() {
  const group = new THREE.Group()
  group.name = 'aaTurret'

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x4b5a32, roughness: 0.8, metalness: 0.2 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.3 })

  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.55, 0.5, 10), baseMat)
  platform.position.y = 0.25
  group.add(platform)

  const turretPivot = new THREE.Group()
  turretPivot.position.y = 0.5
  group.add(turretPivot)

  const turretBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 1.6), baseMat)
  turretBody.position.y = 0.32
  turretPivot.add(turretBody)

  const barrelPivot = new THREE.Group()
  barrelPivot.position.set(0, 0.5, 0.4)
  turretPivot.add(barrelPivot)

  const barrelGeo = new THREE.CylinderGeometry(0.07, 0.09, 2.0, 6)
  ;[-0.28, 0.28].forEach((x) => {
    const barrel = new THREE.Mesh(barrelGeo, darkMat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(x, 0, 1.0)
    barrelPivot.add(barrel)
  })

  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true
  })

  group.userData.footprintRadius = 1.8
  group.userData.height = 1.7
  group.userData.turretPivot = turretPivot
  group.userData.barrelPivot = barrelPivot
  return group
}

// Marks an "objective" location - a distinctive beacon so it reads clearly
// both in-world and as the diamond icon on the minimap.
export function createObjectiveMarker({ height = 26 } = {}) {
  const group = new THREE.Group()
  group.name = 'objectiveMarker'
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffce54,
    emissive: 0xffb020,
    emissiveIntensity: 1.6,
    roughness: 0.3,
    metalness: 0.4,
  })

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, height, 10), mat)
  pillar.position.y = height / 2
  pillar.castShadow = true
  group.add(pillar)

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 8, 20), mat)
  ring.position.y = height * 0.72
  ring.rotation.x = Math.PI / 2
  group.add(ring)

  group.userData.footprintRadius = 2.5
  group.userData.height = height + 2
  group.userData.ring = ring
  return group
}
