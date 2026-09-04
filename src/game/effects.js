import * as THREE from 'three'
import { explosionSfxKeyForScale } from './audio/audioManifest.js'

// Small transient VFX: tracers, impact sparks, smoke puffs, explosions.
// Every effect is a plain { tick(dt): keepAlive, dispose() } entry pushed
// onto `active`; update() drives them all and reaps the expired ones. A
// few geometries are shared module-level (cheap to reuse, no per-shot
// allocation); each active effect still gets its own material instance
// since it fades opacity independently.

const UP = new THREE.Vector3(0, 1, 0)

const tracerGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1, 6)
const sparkGeometry = new THREE.SphereGeometry(0.18, 6, 6)
const debrisGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3)
const smokeGeometry = new THREE.SphereGeometry(0.5, 8, 8)
const explosionCoreGeometry = new THREE.SphereGeometry(1, 12, 10)
const flareGeometry = new THREE.SphereGeometry(0.22, 8, 8)

export class EffectsManager {
  // `audioManager`, if given, is where "Explosions (varies by size)" is
  // wired up - every explosion in the game already funnels through
  // addExplosion() below (crashes, missile impacts, boss barrages/hazards,
  // kills), so this one constructor param covers all of them rather than
  // each caller needing to know which SFX tier to ask for.
  constructor(scene, audioManager = null) {
    this.scene = scene
    this.audioManager = audioManager
    this.active = []
  }

  addTracer(from, to) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xfff2b0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(tracerGeometry, material)
    const segment = new THREE.Vector3().subVectors(to, from)
    const length = Math.max(segment.length(), 0.001)
    mesh.position.copy(from).addScaledVector(segment, 0.5)
    mesh.scale.set(1, length, 1)
    mesh.quaternion.setFromUnitVectors(UP, segment.normalize())
    this.scene.add(mesh)

    const duration = 0.08
    this._push({
      duration,
      tick: (t) => {
        material.opacity = 0.95 * (1 - t)
      },
      dispose: () => {
        this.scene.remove(mesh)
        material.dispose()
      },
    })
  }

  addImpactSpark(position) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffe08a,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(sparkGeometry, material)
    mesh.position.copy(position)
    this.scene.add(mesh)

    const duration = 0.15
    this._push({
      duration,
      tick: (t) => {
        const scale = 1 + t * 2.5
        mesh.scale.setScalar(scale)
        material.opacity = 1 - t
      },
      dispose: () => {
        this.scene.remove(mesh)
        material.dispose()
      },
    })
  }

  addSmokePuff(position) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x9a9a9a,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(smokeGeometry, material)
    mesh.position.copy(position)
    mesh.scale.setScalar(0.3)
    this.scene.add(mesh)

    const duration = 0.6
    const rise = Math.random() * 0.6 + 0.3
    this._push({
      duration,
      tick: (t, dt) => {
        mesh.scale.setScalar(0.3 + t * 1.1)
        mesh.position.y += rise * dt
        material.opacity = 0.35 * (1 - t)
      },
      dispose: () => {
        this.scene.remove(mesh)
        material.dispose()
      },
    })
  }

  // A handful of bright decoy flares ejected behind the helicopter,
  // falling and fading - visual read for the flares/chaff countermeasure.
  addFlareBurst(position, backward) {
    const count = 6
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffb347 : 0xfff2b0,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(flareGeometry, material)
      mesh.position.copy(position)
      this.scene.add(mesh)

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 2,
        (Math.random() - 0.5) * 6,
      )
      const velocity = backward.clone().multiplyScalar(8 + Math.random() * 4).add(spread)

      const duration = 0.7 + Math.random() * 0.3
      this._push({
        duration,
        tick: (t, dt) => {
          velocity.y -= 9.8 * dt
          mesh.position.addScaledVector(velocity, dt)
          material.opacity = 1 - t
        },
        dispose: () => {
          this.scene.remove(mesh)
          material.dispose()
        },
      })
    }
  }

  addExplosion(position, { scale = 1 } = {}) {
    this.audioManager?.playSfx(explosionSfxKeyForScale(scale))

    const light = new THREE.PointLight(0xffaa44, 12 * scale, 40 * scale, 2)
    light.position.copy(position)
    this.scene.add(light)

    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    const core = new THREE.Mesh(explosionCoreGeometry, coreMaterial)
    core.position.copy(position)
    core.scale.setScalar(0.01)
    this.scene.add(core)

    const coreDuration = 0.35
    this._push({
      duration: coreDuration,
      tick: (t) => {
        core.scale.setScalar(THREE.MathUtils.lerp(0.4, 3.2, t) * scale)
        coreMaterial.opacity = 1 - t
        light.intensity = 12 * scale * (1 - t)
      },
      dispose: () => {
        this.scene.remove(core, light)
        coreMaterial.dispose()
      },
    })

    const debrisCount = Math.round(6 + Math.random() * 4)
    for (let i = 0; i < debrisCount; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: 0x2b2b2b,
        emissive: 0x662200,
        roughness: 0.8,
        transparent: true,
      })
      const chunk = new THREE.Mesh(debrisGeometry, material)
      chunk.position.copy(position)
      chunk.scale.setScalar(0.4 + Math.random() * 0.6)
      this.scene.add(chunk)

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.6 + 0.6,
        (Math.random() - 0.5) * 2,
      )
        .normalize()
        .multiplyScalar((6 + Math.random() * 6) * scale)
      const spin = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(10)

      const duration = 0.6 + Math.random() * 0.4
      this._push({
        duration,
        tick: (t, dt) => {
          velocity.y -= 9.8 * dt
          chunk.position.addScaledVector(velocity, dt)
          chunk.rotation.x += spin.x * dt
          chunk.rotation.y += spin.y * dt
          material.opacity = 1 - t
        },
        dispose: () => {
          this.scene.remove(chunk)
          material.dispose()
        },
      })
    }

    this.addSmokePuff(position)
  }

  _push(entry) {
    entry.elapsed = 0
    this.active.push(entry)
  }

  update(delta) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i]
      entry.elapsed += delta
      const t = Math.min(entry.elapsed / entry.duration, 1)
      entry.tick(t, delta)
      if (entry.elapsed >= entry.duration) {
        entry.dispose()
        this.active.splice(i, 1)
      }
    }
  }

  dispose() {
    for (const entry of this.active) entry.dispose()
    this.active.length = 0
  }
}
