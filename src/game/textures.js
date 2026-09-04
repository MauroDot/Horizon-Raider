import * as THREE from 'three'
import { mulberry32, WORLD_SEED } from './rng.js'

// Small procedural canvas textures, tiled across the terrain via
// RepeatWrapping - no image assets, no network fetch, deterministic output
// (same seed every load) so it matches the rest of the "procedural world".
export function createGroundTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const random = mulberry32(WORLD_SEED ^ 0x9e3779b9)

  ctx.fillStyle = '#4f7a3d'
  ctx.fillRect(0, 0, size, size)

  // Mottled speckle: lots of small low-contrast dabs read as grass texture
  // at a distance without needing a real photo/noise texture.
  const speckleCount = 900
  for (let i = 0; i < speckleCount; i++) {
    const shade = 0.75 + random() * 0.5
    const r = Math.round(60 * shade)
    const g = Math.round(110 * shade)
    const b = Math.round(50 * shade)
    ctx.fillStyle = `rgba(${r},${g},${b},0.5)`
    const x = random() * size
    const y = random() * size
    const w = 1 + random() * 2.5
    ctx.fillRect(x, y, w, w)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Simple window-grid facade texture for buildings - a handful of lit/unlit
// rectangles on a dark wall base.
export function createFacadeTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const random = mulberry32(WORLD_SEED ^ 0x1234abcd)

  ctx.fillStyle = '#33363b'
  ctx.fillRect(0, 0, size, size)

  const cols = 4
  const rows = 6
  const cellW = size / cols
  const cellH = size / rows
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lit = random() < 0.35
      ctx.fillStyle = lit ? 'rgba(255, 214, 130, 0.9)' : 'rgba(15, 18, 22, 0.85)'
      const pad = cellW * 0.22
      ctx.fillRect(col * cellW + pad, row * cellH + pad, cellW - pad * 2, cellH - pad * 2)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
