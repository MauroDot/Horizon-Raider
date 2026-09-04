import * as THREE from 'three'

// Shared geometry for enemy tracer rounds - small glowing sphere, cheap to
// reuse across every shot fired this session.
const geometry = new THREE.SphereGeometry(0.16, 8, 8)

export function createEnemyProjectileMesh() {
  const material = new THREE.MeshBasicMaterial({ color: 0xff5533 })
  const mesh = new THREE.Mesh(geometry, material)
  return mesh
}
