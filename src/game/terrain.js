import * as THREE from 'three'
import { getTerrainHeight } from './terrainHeight.js'
import { createGroundTexture } from './textures.js'

export const TERRAIN_SIZE = 2000

// Height-based biome tint: lowlands trend toward dirt/sand, midground is
// grass, high ground goes rocky, and the tallest ridges cap with snow. This
// gets multiplied against the tiled ground texture via vertex colors, so
// the terrain reads as "textured" rather than a flat single color.
const STOPS = [
  { height: -18, color: new THREE.Color(0x6b5a3a) },
  { height: 2, color: new THREE.Color(0x4f7a3d) },
  { height: 22, color: new THREE.Color(0x5f7a4a) },
  { height: 38, color: new THREE.Color(0x8a8478) },
  { height: 52, color: new THREE.Color(0xe8ecef) },
]

function colorForHeight(height, target) {
  if (height <= STOPS[0].height) return target.copy(STOPS[0].color)
  for (let i = 1; i < STOPS.length; i++) {
    if (height <= STOPS[i].height) {
      const prev = STOPS[i - 1]
      const next = STOPS[i]
      const t = (height - prev.height) / (next.height - prev.height)
      return target.copy(prev.color).lerp(next.color, t)
    }
  }
  return target.copy(STOPS[STOPS.length - 1].color)
}

// Large rolling ground plane, displaced by the shared noise-based height
// function and tinted per-vertex by elevation.
export function createTerrain({ size = TERRAIN_SIZE, segments = 200 } = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const tmpColor = new THREE.Color()
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const height = getTerrainHeight(x, z)
    position.setY(i, height)
    colorForHeight(height, tmpColor)
    colors[i * 3] = tmpColor.r
    colors[i * 3 + 1] = tmpColor.g
    colors[i * 3 + 2] = tmpColor.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const texture = createGroundTexture()
  const repeats = size / 40
  texture.repeat.set(repeats, repeats)

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'terrain'
  mesh.receiveShadow = true
  return mesh
}
