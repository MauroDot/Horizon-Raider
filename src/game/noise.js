import { mulberry32, WORLD_SEED } from './rng.js'

// Classic (Ken Perlin) 2D gradient noise, seeded so the permutation table -
// and therefore the whole terrain shape - is identical every load. No
// dependency; this is the standard ~40-line reference implementation.
const PERM_SIZE = 256
const perm = new Uint8Array(PERM_SIZE * 2)
{
  const table = new Uint8Array(PERM_SIZE)
  for (let i = 0; i < PERM_SIZE; i++) table[i] = i
  const random = mulberry32(WORLD_SEED)
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[table[i], table[j]] = [table[j], table[i]]
  }
  for (let i = 0; i < PERM_SIZE * 2; i++) perm[i] = table[i % PERM_SIZE]
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(t, a, b) {
  return a + t * (b - a)
}

function grad(hash, x, y) {
  // 8 possible gradient directions is plenty for terrain-scale noise.
  switch (hash & 7) {
    case 0:
      return x + y
    case 1:
      return x - y
    case 2:
      return -x + y
    case 3:
      return -x - y
    case 4:
      return x
    case 5:
      return -x
    case 6:
      return y
    default:
      return -y
  }
}

export function perlin2D(x, y) {
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = fade(xf)
  const v = fade(yf)

  const aa = perm[perm[xi] + yi]
  const ab = perm[perm[xi] + yi + 1]
  const ba = perm[perm[xi + 1] + yi]
  const bb = perm[perm[xi + 1] + yi + 1]

  return lerp(
    v,
    lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf)),
    lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1)),
  )
}

// Fractal Brownian motion: several octaves of noise summed at increasing
// frequency and decreasing amplitude - the standard way to turn smooth
// gradient noise into natural-looking, multi-scale terrain.
export function fbm2D(x, y, { octaves = 4, frequency = 1, amplitude = 1, lacunarity = 2, persistence = 0.5 } = {}) {
  let sum = 0
  let amp = amplitude
  let freq = frequency
  let max = 0
  for (let i = 0; i < octaves; i++) {
    sum += perlin2D(x * freq, y * freq) * amp
    max += amp
    amp *= persistence
    freq *= lacunarity
  }
  return sum / max
}
