import * as THREE from 'three'

// Angular military attack-helicopter silhouette (Apache/Viper style):
// tapered wedge nose, stepped tandem "greenhouse" cockpit, chin sensor
// turret, stub wings carrying visible missile pods on pylons, hexagonal
// (angular, not round) tail boom with a swept fin, and tricycle wheeled
// gear instead of civilian-style skids. Primitives only, no model file.
//
// Kept within roughly the same bounding envelope as the previous rounded
// design (nose ~z=2.6, tail fin ~z=-4.5, mast at y~1.1-1.4) so the gun/
// missile muzzle offsets and chase/cockpit camera tuning elsewhere don't
// need retuning - this is a reskin of the silhouette, not a rescale.
//
// Returns a THREE.Group with the spinning parts exposed via userData so the
// game loop can animate them without re-querying the scene graph.
//
// `colors` lets callers reskin the same geometry - enemies.js uses this
// pattern too, and createScene.js drives `bodyColor` from the player's
// customization choice, so this is also the "dynamic material" hook: pick
// a different paint and every airframe panel below picks it up.
//
// `scale`/`plating`/`stealth` are the unlockable-helicopter hook
// (helicopters.js): a uniform scale reads as "heavier" or "nimbler" at a
// glance, `plating` bolts a couple of extra armor slabs onto the hull for
// the heavier variants, and `stealth` swaps the canopy glass for a matte
// dark finish and drops the glossy highlight - distinguishing variants by
// silhouette/finish on the one parametrized airframe rather than five
// separate hand-modeled aircraft.
export function createHelicopter({
  bodyColor = 0x3b5b7a,
  accentColor = 0xd94f3d,
  glassColor = 0x9fd8ff,
  darkColor = 0x1c1c1e,
  scale = 1,
  plating = false,
  stealth = false,
} = {}) {
  const group = new THREE.Group()
  group.name = 'helicopter'

  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.45, roughness: 0.4 })
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.3, roughness: 0.5 })
  // Stealth finish: low-visibility dark glass instead of a glossy canopy -
  // reads as "hidden cockpit" rather than a bright reflective bubble.
  const glassMat = new THREE.MeshStandardMaterial(
    stealth
      ? { color: 0x14171a, transparent: true, opacity: 0.85, roughness: 0.6, metalness: 0.2 }
      : { color: glassColor, transparent: true, opacity: 0.6, roughness: 0.08, metalness: 0.1 },
  )
  const darkMat = new THREE.MeshStandardMaterial({ color: darkColor, metalness: 0.6, roughness: 0.35 })

  // --- Fuselage: a slab hull with a faceted wedge nose bolted on. ---
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.85, 2.7), bodyMat)
  hull.position.set(0, -0.05, -0.5)
  group.add(hull)

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.62, 1.6, 4), bodyMat)
  nose.rotation.x = Math.PI / 2
  nose.rotation.y = Math.PI / 4 // square the 4-gon cross-section to the hull's box
  nose.scale.set(1, 0.75, 1)
  nose.position.set(0, -0.05, 1.6)
  group.add(nose)

  // Raised engine deck, stepped up toward the rear - where the mast rises from.
  const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 1.7), bodyMat)
  engineDeck.position.set(0, 0.55, -0.85)
  group.add(engineDeck)

  // Chin-mounted sensor/gun turret ball.
  const chinTurret = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), darkMat)
  chinTurret.position.set(0, -0.42, 1.95)
  group.add(chinTurret)

  // --- Tandem "greenhouse" cockpit: gunner low/forward, pilot high/aft. ---
  const gunnerCanopy = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.85), glassMat)
  gunnerCanopy.position.set(0, 0.32, 1.35)
  group.add(gunnerCanopy)

  const pilotCanopy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.9), glassMat)
  pilotCanopy.position.set(0, 0.62, 0.55)
  group.add(pilotCanopy)

  const canopyFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.58, 1.75), darkMat)
  canopyFrame.position.set(0, 0.42, 0.9)
  group.add(canopyFrame)

  // --- Stub wings with weapon pylons + visible missile pods. ---
  const wingGeo = new THREE.BoxGeometry(1.7, 0.14, 0.62)
  ;[-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(wingGeo, bodyMat)
    wing.position.set(side * 0.98, 0.05, -0.35)
    wing.rotation.z = -side * 0.06 // slight dihedral
    group.add(wing)

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.14), accentMat)
    stripe.position.set(side * 0.98, 0.13, -0.35)
    group.add(stripe)

    for (const podZ of [-0.75, 0.05]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.22), darkMat)
      pylon.position.set(side * 1.55, -0.24, podZ)
      group.add(pylon)

      const pod = new THREE.Group()
      pod.position.set(side * 1.55, -0.42, podZ)
      const podBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.05, 6), darkMat)
      podBody.rotation.x = Math.PI / 2
      pod.add(podBody)
      const podNose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 6), darkMat)
      podNose.rotation.x = Math.PI / 2
      podNose.position.z = 0.66
      pod.add(podNose)
      group.add(pod)
    }
  })

  // --- Tail boom: hexagonal (faceted, not round), tapering aft. ---
  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.13, 3.3, 6), bodyMat)
  tailBoom.rotation.x = Math.PI / 2
  tailBoom.position.set(0, 0.05, -2.75)
  group.add(tailBoom)

  // Swept vertical fin (a tilted slab reads as "swept" without needing a custom taper).
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.62), accentMat)
  tailFin.position.set(0, 0.55, -4.45)
  tailFin.rotation.x = -0.32
  group.add(tailFin)

  // Horizontal stabilizer, split in two with a slight dihedral each side.
  ;[-1, 1].forEach((side) => {
    const stab = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 0.32), darkMat)
    stab.position.set(side * 0.42, 0.18, -4.1)
    stab.rotation.z = -side * 0.18
    group.add(stab)
  })

  // --- Main rotor mast + blades. ---
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8), darkMat)
  mast.position.set(0, 1.05, -0.6)
  group.add(mast)

  const mainRotor = new THREE.Group()
  mainRotor.position.set(0, 1.35, -0.6)
  const mainHub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 8), darkMat)
  mainRotor.add(mainHub)
  const mainBladeGeo = new THREE.BoxGeometry(5.2, 0.05, 0.24)
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(mainBladeGeo, darkMat)
    blade.rotation.y = (Math.PI / 2) * i
    mainRotor.add(blade)
  }
  group.add(mainRotor)

  // --- Tail rotor. ---
  const tailRotor = new THREE.Group()
  tailRotor.position.set(0.22, 0.55, -4.55)
  const tailHub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), darkMat)
  tailHub.rotation.z = Math.PI / 2
  tailRotor.add(tailHub)
  const tailBladeGeo = new THREE.BoxGeometry(0.05, 0.9, 0.13)
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(tailBladeGeo, darkMat)
    blade.rotation.x = Math.PI * i
    tailRotor.add(blade)
  }
  group.add(tailRotor)

  // --- Tricycle wheeled landing gear (not skids - reads more military). ---
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10)
  const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 6), darkMat)
  noseStrut.position.set(0, -0.68, 1.55)
  group.add(noseStrut)
  const noseWheel = new THREE.Mesh(wheelGeo, darkMat)
  noseWheel.rotation.x = Math.PI / 2
  noseWheel.position.set(0, -0.92, 1.55)
  group.add(noseWheel)

  ;[-1, 1].forEach((side) => {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.7, 6), darkMat)
    strut.rotation.z = side * 0.25
    strut.position.set(side * 0.75, -0.72, -0.55)
    group.add(strut)

    const wheel = new THREE.Mesh(wheelGeo, darkMat)
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(side * 0.95, -1.02, -0.55)
    group.add(wheel)
  })

  // Extra armor slabs bolted along the hull flanks - the heavier variants'
  // (Reaper, Warlord) visual tell, on top of their larger overall scale.
  if (plating) {
    ;[-1, 1].forEach((side) => {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 1.6), darkMat)
      plate.position.set(side * 0.68, -0.05, -0.4)
      group.add(plate)
    })
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), darkMat)
    chestPlate.position.set(0, -0.35, 1.1)
    group.add(chestPlate)
  }

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true
      obj.receiveShadow = false
    }
  })

  group.scale.setScalar(scale)

  group.userData.mainRotor = mainRotor
  group.userData.tailRotor = tailRotor
  return group
}
