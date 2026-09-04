import * as THREE from 'three'

// Three visually distinct enemy helicopter silhouettes - deliberately NOT
// reskins of the player's Apache-style model, each built from its own
// primitives so scout/gunship/transport read differently at a glance, not
// just by color. Sizes vary too (scout smallest, transport largest) to
// back up "light scout vs heavy transport" visually, not just in stats.

// --- Scout: small, bubble canopy, skids, unarmed, fast/fragile. ---
export function createScoutHelicopter() {
  const group = new THREE.Group()
  group.name = 'enemyScout'

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a7a4a, metalness: 0.3, roughness: 0.55 })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2a2410,
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
  })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1712, metalness: 0.5, roughness: 0.4 })

  // Compact egg-shaped fuselage with a large bubble canopy up front - the
  // MD500/Kiowa "goldfish bowl" silhouette, unmistakably not the player's boxy hull.
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), bodyMat)
  body.scale.set(1, 0.85, 1.3)
  body.position.set(0, 0, -0.1)
  group.add(body)

  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), glassMat)
  bubble.scale.set(0.95, 0.9, 1)
  bubble.position.set(0, 0.05, 0.55)
  group.add(bubble)

  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.04, 2.1, 6), bodyMat)
  tailBoom.rotation.x = Math.PI / 2
  tailBoom.position.set(0, 0.05, -1.65)
  group.add(tailBoom)

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.34), darkMat)
  fin.position.set(0, 0.28, -2.6)
  fin.rotation.x = -0.35
  group.add(fin)

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6), darkMat)
  mast.position.set(0, 0.5, -0.1)
  group.add(mast)

  const mainRotor = new THREE.Group()
  mainRotor.position.set(0, 0.68, -0.1)
  mainRotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8), darkMat))
  const bladeGeo = new THREE.BoxGeometry(3.4, 0.035, 0.16)
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(bladeGeo, darkMat)
    blade.rotation.y = (Math.PI / 2) * i
    mainRotor.add(blade)
  }
  group.add(mainRotor)

  const tailRotor = new THREE.Group()
  tailRotor.position.set(0.1, 0.25, -2.62)
  const tailBladeGeo = new THREE.BoxGeometry(0.03, 0.5, 0.09)
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(tailBladeGeo, darkMat)
    blade.rotation.x = Math.PI * i
    tailRotor.add(blade)
  }
  group.add(tailRotor)

  const skidGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6)
  ;[-0.5, 0.5].forEach((x) => {
    const skid = new THREE.Mesh(skidGeo, darkMat)
    skid.rotation.z = Math.PI / 2
    skid.position.set(x, -0.55, -0.1)
    group.add(skid)
  })
  const strutGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6)
  for (const [x, z] of [
    [-0.5, 0.4],
    [-0.5, -0.6],
    [0.5, 0.4],
    [0.5, -0.6],
  ]) {
    const strut = new THREE.Mesh(strutGeo, darkMat)
    strut.position.set(x, -0.3, z)
    group.add(strut)
  }

  group.traverse((obj) => obj.isMesh && (obj.castShadow = true))
  group.userData.mainRotor = mainRotor
  group.userData.tailRotor = tailRotor
  group.userData.hitRadius = 1.6
  return group
}

// --- Gunship: boxy stepped "greenhouse" canopy, heavily podded stub
// wings - a Hind-flavored silhouette, deliberately blockier than the
// player's wedge-nosed Apache style. Medium size, the most heavily armed
// of the three.
export function createGunshipHelicopter() {
  const group = new THREE.Group()
  group.name = 'enemyGunship'

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4a2e, metalness: 0.4, roughness: 0.45 })
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xb02020, metalness: 0.3, roughness: 0.5 })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x3a4a2a,
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
  })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x181812, metalness: 0.55, roughness: 0.4 })

  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 3.0), bodyMat)
  hull.position.set(0, 0, -0.4)
  group.add(hull)

  // Big stepped "bug-eye" canopy - two large angled glass panels.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.7), glassMat)
  canopy.position.set(0, 0.55, 1.15)
  group.add(canopy)
  const canopyFrame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 1.75), darkMat)
  canopyFrame.position.set(0, 0.55, 1.15)
  group.add(canopyFrame)

  const engineHump = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 1.4), bodyMat)
  engineHump.position.set(0, 0.75, -0.9)
  group.add(engineHump)

  // Wide, heavily podded stub wings - two pods per side, bigger than the player's.
  const wingGeo = new THREE.BoxGeometry(2.1, 0.16, 0.75)
  ;[-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(wingGeo, bodyMat)
    wing.position.set(side * 1.15, 0.1, -0.5)
    wing.rotation.z = -side * 0.12
    group.add(wing)

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 0.16), accentMat)
    stripe.position.set(side * 1.15, 0.2, -0.5)
    group.add(stripe)

    for (const podZ of [-0.95, -0.15, 0.65]) {
      const pod = new THREE.Group()
      pod.position.set(side * 1.8, -0.18, podZ)
      const podBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.0, 6), darkMat)
      podBody.rotation.x = Math.PI / 2
      pod.add(podBody)
      const podNose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 6), darkMat)
      podNose.rotation.x = Math.PI / 2
      podNose.position.z = 0.63
      pod.add(podNose)
      group.add(pod)
    }
  })

  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.14, 3.0, 6), bodyMat)
  tailBoom.rotation.x = Math.PI / 2
  tailBoom.position.set(0, -0.05, -3.1)
  group.add(tailBoom)

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.55), accentMat)
  fin.position.set(0, 0.4, -4.6)
  fin.rotation.x = -0.28
  group.add(fin)

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.4, 8), darkMat)
  mast.position.set(0, 0.9, -0.5)
  group.add(mast)

  const mainRotor = new THREE.Group()
  mainRotor.position.set(0, 1.15, -0.5)
  mainRotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.22, 10), darkMat))
  const bladeGeo = new THREE.BoxGeometry(5.4, 0.055, 0.26)
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(bladeGeo, darkMat)
    blade.rotation.y = ((Math.PI * 2) / 5) * i
    mainRotor.add(blade)
  }
  group.add(mainRotor)

  const tailRotor = new THREE.Group()
  tailRotor.position.set(0.2, 0.42, -4.65)
  const tailBladeGeo = new THREE.BoxGeometry(0.05, 0.85, 0.13)
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(tailBladeGeo, darkMat)
    blade.rotation.x = Math.PI * i
    tailRotor.add(blade)
  }
  group.add(tailRotor)

  const skidGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6)
  ;[-0.85, 0.85].forEach((x) => {
    const skid = new THREE.Mesh(skidGeo, darkMat)
    skid.rotation.z = Math.PI / 2
    skid.position.set(x, -0.65, -0.4)
    group.add(skid)
  })

  group.traverse((obj) => obj.isMesh && (obj.castShadow = true))
  group.userData.mainRotor = mainRotor
  group.userData.tailRotor = tailRotor
  group.userData.hitRadius = 2.7
  return group
}

// --- Transport: large slab-sided cargo fuselage, tandem twin rotors (fore
// + aft, Chinook-style) instead of a tail rotor at all, no weapon pods -
// the largest and slowest of the three, unmistakably a hauler, not a
// gunship. `userData.secondaryRotor` is the aft rotor; EnemyManager spins
// it independently alongside `mainRotor`.
export function createTransportHelicopter() {
  const group = new THREE.Group()
  group.name = 'enemyTransport'

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5a5f5a, metalness: 0.35, roughness: 0.55 })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    transparent: true,
    opacity: 0.5,
    roughness: 0.15,
  })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.5, roughness: 0.4 })

  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 5.6), bodyMat)
  hull.position.set(0, 0.1, 0)
  group.add(hull)

  const cockpitGlass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 0.9), glassMat)
  cockpitGlass.position.set(0, 0.5, 2.7)
  group.add(cockpitGlass)

  const rearRamp = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.2, 0.4), darkMat)
  rearRamp.position.set(0, 0.05, -2.75)
  rearRamp.rotation.x = 0.25
  group.add(rearRamp)

  // Twin masts, fore and aft.
  const frontMast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8), darkMat)
  frontMast.position.set(0, 1.15, 1.8)
  group.add(frontMast)
  const rearMast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 8), darkMat)
  rearMast.position.set(0, 1.35, -1.9)
  group.add(rearMast)

  function buildRotor(z, height) {
    const rotor = new THREE.Group()
    rotor.position.set(0, height, z)
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.24, 10), darkMat))
    const bladeGeo = new THREE.BoxGeometry(6.0, 0.06, 0.3)
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeo, darkMat)
      blade.rotation.y = ((Math.PI * 2) / 3) * i
      rotor.add(blade)
    }
    group.add(rotor)
    return rotor
  }
  const frontRotor = buildRotor(1.8, 1.45)
  const rearRotor = buildRotor(-1.9, 1.85)

  const skidGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.2, 6)
  ;[-1.1, 1.1].forEach((x) => {
    const skid = new THREE.Mesh(skidGeo, darkMat)
    skid.rotation.z = Math.PI / 2
    skid.position.set(x, -0.85, 0)
    group.add(skid)
  })
  const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6)
  for (const [x, z] of [
    [-1.1, 1.6],
    [-1.1, -1.6],
    [1.1, 1.6],
    [1.1, -1.6],
  ]) {
    const strut = new THREE.Mesh(strutGeo, darkMat)
    strut.position.set(x, -0.5, z)
    group.add(strut)
  }

  group.traverse((obj) => obj.isMesh && (obj.castShadow = true))
  // Both rotors are "the main rotor" for animation purposes - EnemyManager
  // spins mainRotor and (if present) secondaryRotor at the same rate.
  group.userData.mainRotor = frontRotor
  group.userData.secondaryRotor = rearRotor
  group.userData.hitRadius = 3.4
  return group
}

// --- Tank: tracked, angled glacis plate, low turret. ---
export function createEnemyVehicle() {
  const group = new THREE.Group()
  group.name = 'enemyTank'

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x4b5a32, roughness: 0.8, metalness: 0.2 })
  const turretMat = new THREE.MeshStandardMaterial({ color: 0x3d4a28, roughness: 0.75, metalness: 0.25 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.3 })

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.75, 4.0), hullMat)
  hull.position.y = 0.55
  group.add(hull)

  // Sloped glacis plate at the front - the "angled armor" read a flat box hull lacks.
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.0), hullMat)
  glacis.position.set(0, 0.55, 1.85)
  glacis.rotation.x = 0.55
  group.add(glacis)

  const turret = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.9), turretMat)
  turret.position.set(0, 1.2, -0.1)
  group.add(turret)
  const turretFront = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.5), turretMat)
  turretFront.position.set(0, 1.2, 0.9)
  turretFront.rotation.x = 0.35
  group.add(turretFront)
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 8), darkMat)
  hatch.position.set(-0.3, 1.5, -0.4)
  group.add(hatch)

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), darkMat)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0, 1.18, 1.9)
  group.add(barrel)

  // Tracks: a flattened box running the hull length, road wheels half-sunk into it.
  const trackGeo = new THREE.BoxGeometry(0.5, 0.5, 4.2)
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.42, 10)
  ;[-1.35, 1.35].forEach((x) => {
    const track = new THREE.Mesh(trackGeo, darkMat)
    track.position.set(x, 0.28, 0)
    group.add(track)
    for (const z of [-1.7, -0.85, 0, 0.85, 1.7]) {
      const wheel = new THREE.Mesh(wheelGeo, darkMat)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.28, z)
      group.add(wheel)
    }
  })

  group.traverse((obj) => obj.isMesh && (obj.castShadow = true))
  group.userData.hitRadius = 2.6
  return group
}

// --- APC: lighter, wheeled, faster - a second ground-unit silhouette so
// "vehicle" spawns aren't all the same tank.
export function createAPC() {
  const group = new THREE.Group()
  group.name = 'enemyAPC'

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x5a5e42, roughness: 0.75, metalness: 0.2 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.3 })

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 3.4), hullMat)
  hull.position.y = 0.75
  group.add(hull)

  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.9), hullMat)
  nose.position.set(0, 0.75, 1.9)
  nose.rotation.x = 0.5
  group.add(nose)

  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.4, 8), darkMat)
  turret.position.set(0, 1.5, -0.1)
  group.add(turret)

  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), darkMat)
  gun.rotation.x = Math.PI / 2
  gun.position.set(0, 1.5, 0.7)
  group.add(gun)

  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 12)
  for (const z of [-1.2, -0.3, 0.6, 1.4]) {
    for (const x of [-1.05, 1.05]) {
      const wheel = new THREE.Mesh(wheelGeo, darkMat)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.42, z)
      group.add(wheel)
    }
  }

  group.traverse((obj) => obj.isMesh && (obj.castShadow = true))
  group.userData.hitRadius = 2.1
  return group
}
