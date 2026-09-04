import * as THREE from 'three'

const DAY_LENGTH_SECONDS = 480 // 8 minutes for a full day/night cycle
const START_TIME = 0.3 // start mid-morning

// Keyframes across a 0..1 day fraction (0 = midnight). Two near-identical
// "day" stops (0.32/0.68) hold a long bright plateau between dawn and dusk
// rather than the sky peaking for a single instant at noon.
const STOPS = [
  {
    t: 0.0,
    sky: [0x03060f, 0x0b1220],
    fog: 0x0b1220,
    sunColor: 0x6f83ff,
    sunIntensity: 0.12,
    hemiSky: 0x16213b,
    hemiGround: 0x05070c,
    hemiIntensity: 0.22,
    stars: 1,
  },
  {
    t: 0.22,
    sky: [0x2c4a7a, 0xffb27a],
    fog: 0xffb27a,
    sunColor: 0xffb37a,
    sunIntensity: 0.9,
    hemiSky: 0x8fa9d9,
    hemiGround: 0x4a3a2a,
    hemiIntensity: 0.6,
    stars: 0.15,
  },
  {
    t: 0.32,
    sky: [0x1f5fa8, 0xcfe8ff],
    fog: 0xcfe8ff,
    sunColor: 0xfff2d6,
    sunIntensity: 1.4,
    hemiSky: 0xbfd9ff,
    hemiGround: 0x3a2f1e,
    hemiIntensity: 0.9,
    stars: 0,
  },
  {
    t: 0.68,
    sky: [0x1f5fa8, 0xcfe8ff],
    fog: 0xcfe8ff,
    sunColor: 0xfff2d6,
    sunIntensity: 1.4,
    hemiSky: 0xbfd9ff,
    hemiGround: 0x3a2f1e,
    hemiIntensity: 0.9,
    stars: 0,
  },
  {
    t: 0.78,
    sky: [0x3a4a7a, 0xff9a5a],
    fog: 0xff9a5a,
    sunColor: 0xff9a5a,
    sunIntensity: 0.85,
    hemiSky: 0xd98a6a,
    hemiGround: 0x3a2a2a,
    hemiIntensity: 0.5,
    stars: 0.15,
  },
  {
    t: 1.0,
    sky: [0x03060f, 0x0b1220],
    fog: 0x0b1220,
    sunColor: 0x6f83ff,
    sunIntensity: 0.12,
    hemiSky: 0x16213b,
    hemiGround: 0x05070c,
    hemiIntensity: 0.22,
    stars: 1,
  },
]

// Drives sky/fog/light colors from a looping clock. Pure data/math (no
// THREE scene objects owned here) - createScene applies the computed
// values to the sky dome, fog, and lights each frame.
export class DayNightCycle {
  constructor({ startTime = START_TIME, dayLengthSeconds = DAY_LENGTH_SECONDS } = {}) {
    this.time = startTime
    this.dayLengthSeconds = dayLengthSeconds

    this.skyTop = new THREE.Color()
    this.skyBottom = new THREE.Color()
    this.fogColor = new THREE.Color()
    this.sunColor = new THREE.Color()
    this.hemiSky = new THREE.Color()
    this.hemiGround = new THREE.Color()
    this.sunIntensity = 1
    this.hemiIntensity = 1
    this.starsOpacity = 0
    this.sunDirection = new THREE.Vector3(0, 1, 0)
    this.isNight = false

    this._stops = STOPS.map((s) => ({
      t: s.t,
      skyTop: new THREE.Color(s.sky[0]),
      skyBottom: new THREE.Color(s.sky[1]),
      fog: new THREE.Color(s.fog),
      sunColor: new THREE.Color(s.sunColor),
      sunIntensity: s.sunIntensity,
      hemiSky: new THREE.Color(s.hemiSky),
      hemiGround: new THREE.Color(s.hemiGround),
      hemiIntensity: s.hemiIntensity,
      stars: s.stars,
    }))

    this._apply(this.time)
  }

  update(delta) {
    this.time = (this.time + delta / this.dayLengthSeconds) % 1
    this._apply(this.time)
  }

  _apply(t) {
    let a = this._stops[0]
    let b = this._stops[this._stops.length - 1]
    let localT = 0
    for (let i = 0; i < this._stops.length - 1; i++) {
      if (t >= this._stops[i].t && t <= this._stops[i + 1].t) {
        a = this._stops[i]
        b = this._stops[i + 1]
        localT = (t - a.t) / (b.t - a.t || 1)
        break
      }
    }

    this.skyTop.copy(a.skyTop).lerp(b.skyTop, localT)
    this.skyBottom.copy(a.skyBottom).lerp(b.skyBottom, localT)
    this.fogColor.copy(a.fog).lerp(b.fog, localT)
    this.sunColor.copy(a.sunColor).lerp(b.sunColor, localT)
    this.sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, localT)
    this.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, localT)
    this.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, localT)
    this.hemiIntensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, localT)
    this.starsOpacity = THREE.MathUtils.lerp(a.stars, b.stars, localT)

    // Sun arcs from horizon (dawn, t=0.25) to zenith (noon, t=0.5) to the
    // opposite horizon (dusk, t=0.75) and on below the world at night.
    const angle = (t - 0.25) * Math.PI * 2
    this.sunDirection.set(Math.cos(angle) * 0.8, Math.sin(angle), 0.35).normalize()
    this.isNight = this.sunDirection.y < 0
  }

  get clockLabel() {
    const totalMinutes = Math.floor(this.time * 24 * 60)
    const hours = Math.floor(totalMinutes / 60) % 24
    const minutes = totalMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
}
