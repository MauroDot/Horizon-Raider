import * as THREE from 'three'
import { mulberry32, WORLD_SEED } from './rng.js'

// A large inverted sphere shaded with a vertical gradient, standing in for a
// sky dome. Cheap (one draw call, no textures) and gives us a horizon line
// where the gradient meets the terrain. Colors are mutated live by
// dayNightCycle.js each frame.
const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
    float mixAmount = max(pow(max(h, 0.0), exponent), 0.0);
    gl_FragColor = vec4(mix(bottomColor, topColor, mixAmount), 1.0);
  }
`

export const SKY_TOP_COLOR = 0x1f5fa8
export const SKY_BOTTOM_COLOR = 0xcfe8ff
export const SKY_DOME_RADIUS = 4000

function createStars() {
  const STAR_COUNT = 1200
  const radius = SKY_DOME_RADIUS * 0.95
  const positions = new Float32Array(STAR_COUNT * 3)
  const random = mulberry32(WORLD_SEED ^ 0x57a2c9)
  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform distribution over the sphere (terrain naturally occludes the
    // lower half when it would be behind the ground).
    const u = random() * 2 - 1
    const theta = random() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    positions[i * 3] = r * Math.cos(theta) * radius
    positions[i * 3 + 1] = u * radius
    positions[i * 3 + 2] = r * Math.sin(theta) * radius
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  })
  const points = new THREE.Points(geometry, material)
  points.name = 'stars'
  points.renderOrder = -2
  return points
}

function createCelestialBody() {
  const geometry = new THREE.SphereGeometry(1, 16, 16)
  const material = new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, depthWrite: false })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'celestialBody'
  mesh.renderOrder = -1
  return mesh
}

export function createSky() {
  const uniforms = {
    topColor: { value: new THREE.Color(SKY_TOP_COLOR) },
    bottomColor: { value: new THREE.Color(SKY_BOTTOM_COLOR) },
    offset: { value: 20 },
    exponent: { value: 0.6 },
  }

  const geometry = new THREE.SphereGeometry(SKY_DOME_RADIUS, 32, 16)
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'sky'
  mesh.renderOrder = -3

  return { mesh, uniforms, stars: createStars(), celestial: createCelestialBody() }
}
