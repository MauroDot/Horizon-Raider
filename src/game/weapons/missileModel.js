import * as THREE from 'three'

// Shared geometry (cheap to reuse); each missile gets its own material
// instance so WeaponSystem can dispose it independently on impact.
const bodyGeometry = new THREE.CylinderGeometry(0.09, 0.09, 1.4, 8)
const noseGeometry = new THREE.ConeGeometry(0.09, 0.3, 8)

export function createMissileMesh() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xd8d8d8,
    metalness: 0.5,
    roughness: 0.4,
    emissive: 0x220000,
  })

  const group = new THREE.Group()
  group.material = material // convenience handle for WeaponSystem's dispose

  const body = new THREE.Mesh(bodyGeometry, material)
  body.rotation.x = Math.PI / 2
  group.add(body)

  const nose = new THREE.Mesh(noseGeometry, material)
  nose.rotation.x = Math.PI / 2
  nose.position.z = 0.85
  group.add(nose)

  group.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true
  })

  return group
}
