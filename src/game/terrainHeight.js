import { fbm2D } from './noise.js'

// Shared ground-height function. Used by terrain.js to build the mesh, by
// flightModel/EnemyManager/weapons for altitude & collision, and by the
// minimap - every consumer needs the exact same formula or they'd drift
// apart. Multi-octave noise gives rolling hills and the occasional larger
// ridge; a smoothstep falloff keeps the area around spawn flat enough to
// take off from.
const MAX_HEIGHT = 55
const BASE_FREQUENCY = 0.0022
const SPAWN_SAFE_RADIUS = 90
const SPAWN_FALLOFF_RADIUS = 260

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

export function getTerrainHeight(x, z) {
  const raw = fbm2D(x * BASE_FREQUENCY, z * BASE_FREQUENCY, {
    octaves: 5,
    lacunarity: 2.15,
    persistence: 0.5,
  })
  let height = raw * MAX_HEIGHT

  const distFromSpawn = Math.hypot(x, z)
  if (distFromSpawn < SPAWN_FALLOFF_RADIUS) {
    const t = smoothstep(
      clamp01((distFromSpawn - SPAWN_SAFE_RADIUS) / (SPAWN_FALLOFF_RADIUS - SPAWN_SAFE_RADIUS)),
    )
    height *= t
  }

  return height
}
