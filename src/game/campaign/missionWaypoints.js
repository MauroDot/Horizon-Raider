import { mulberry32 } from '../rng.js'
import { AIRSPACE } from '../flightModel/airspace.js'

// FNV-1a-ish string hash -> a stable per-mission seed, so a route is
// generated from the mission's own id rather than a literal hand-placed
// coordinate list. Deterministic (same mission -> same route every replay,
// like ObstacleField's terrain layout), unlike enemy spawns which use
// Math.random() precisely so encounters vary between attempts - a route is
// closer to "level layout" than "which enemy shows up", so it gets the
// same seeded treatment as the terrain/obstacles.
function hashString(str) {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// Generates `count` waypoints roughly spread around a loose loop, used as
// both an escort NPC's autopilot path and a recon mission's checkpoint
// list. `salt` lets a mission request a second, different route from the
// same id (not currently needed, but keeps the door open without a
// signature change).
export function generateWaypointRoute(missionId, count, { minRadius = 150, maxRadius, salt = '' } = {}) {
  const random = mulberry32(hashString(missionId + salt))
  const radiusCap = maxRadius ?? AIRSPACE.halfExtent - 100
  const points = []
  let angle = random() * Math.PI * 2
  for (let i = 0; i < count; i++) {
    angle += ((Math.PI * 2) / count) * (0.6 + random() * 0.8)
    const radius = minRadius + random() * (radiusCap - minRadius)
    points.push({ x: Math.sin(angle) * radius, z: Math.cos(angle) * radius })
  }
  return points
}
