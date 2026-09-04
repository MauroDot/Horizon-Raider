import { getTerrainHeight } from '../terrainHeight.js'

// Flyable airspace: a box over the terrain. Position is hard-clamped to it
// and the outward velocity component is zeroed on contact, like soft walls.
// Shared by both flight models so obstacle/enemy code only needs one
// source of truth regardless of which scheme is active.
export const AIRSPACE = {
  halfExtent: 900,
  minAltitudeAboveGround: 1.2,
  maxAltitude: 220,
}

// Mutates `position`/`velocity` (THREE.Vector3) in place. Returns the
// downward impact speed if this call is the frame the craft *first* touches
// ground (0 otherwise, and 0 every subsequent frame while still grounded) -
// callers use that to tell a firm landing from an actual crash. `state` is
// a plain `{ grounded }` object the caller owns between calls.
export function constrainToAirspace(position, velocity, state) {
  const { halfExtent, minAltitudeAboveGround, maxAltitude } = AIRSPACE

  if (position.x > halfExtent) {
    position.x = halfExtent
    velocity.x = Math.min(velocity.x, 0)
  } else if (position.x < -halfExtent) {
    position.x = -halfExtent
    velocity.x = Math.max(velocity.x, 0)
  }

  if (position.z > halfExtent) {
    position.z = halfExtent
    velocity.z = Math.min(velocity.z, 0)
  } else if (position.z < -halfExtent) {
    position.z = -halfExtent
    velocity.z = Math.max(velocity.z, 0)
  }

  let groundImpactSpeed = 0
  const groundLevel = getTerrainHeight(position.x, position.z) + minAltitudeAboveGround
  if (position.y < groundLevel) {
    if (!state.grounded) groundImpactSpeed = Math.max(0, -velocity.y)
    position.y = groundLevel
    velocity.y = Math.max(velocity.y, 0)
    state.grounded = true
  } else {
    state.grounded = false
  }

  if (position.y > maxAltitude) {
    position.y = maxAltitude
    velocity.y = Math.min(velocity.y, 0)
  }

  return groundImpactSpeed
}
