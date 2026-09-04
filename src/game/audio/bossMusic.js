// A synthesized "boss appears" musical stinger + an ongoing tense drone -
// no audio asset needed (see engineSound.js's docs for the same pattern).
// This predates AudioManager's file-based boss music tracks (`boss`/
// `boss-final` in audioManifest.js) and still runs alongside them as a
// procedural layer; today that's moot since no boss music files exist yet,
// so this is simply what "boss music" sounds like right now. Once real
// boss tracks are dropped in, this drone plays underneath them - worth
// revisiting (muting this layer, or just leaving it as texture) once
// there's an actual track to judge it against.
//
// `audioManager`, if given, routes into its shared context and music bus -
// so the Settings music volume slider/mute affects this too, not just
// file-based tracks. Without one, this falls back to a private context.
export class BossMusic {
  constructor(audioManager = null) {
    this.audioManager = audioManager
    this.ctx = null
    this.destination = null
    this._ownsContext = false
    this.droneOscA = null
    this.droneOscB = null
    this.droneGain = null
    this.pulseInterval = null
    this.active = false
  }

  _ensureContext() {
    if (this.ctx) return true
    const sharedCtx = this.audioManager?.getContext()
    const sharedBus = this.audioManager?.getMusicBus()
    if (sharedCtx && sharedBus) {
      this.ctx = sharedCtx
      this.destination = sharedBus
      this._ownsContext = false
      return true
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return false
      this.ctx = new Ctx()
      this.destination = this.ctx.destination
      this._ownsContext = true
      return true
    } catch {
      return false
    }
  }

  // A short, sharp rising stinger - two detuned saws sweeping up in pitch
  // over ~0.9s, the "dramatic shift" sting when a boss appears.
  playStinger() {
    if (!this._ensureContext()) return
    const now = this.ctx.currentTime
    for (const detune of [-6, 0, 7]) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(80, now)
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.9)
      osc.detune.value = detune * 10

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.09, now + 0.15)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)

      osc.connect(gain).connect(this.destination)
      osc.start(now)
      osc.stop(now + 1.2)
    }
  }

  // A low, ominous two-note drone with a slow pulsing gain (like a heartbeat
  // under tension) that keeps running for the duration of a boss fight.
  startDrone() {
    if (this.active || !this._ensureContext()) return
    this.active = true
    const now = this.ctx.currentTime

    this.droneGain = this.ctx.createGain()
    this.droneGain.gain.value = 0
    this.droneGain.gain.setTargetAtTime(0.035, now, 0.6)
    this.droneGain.connect(this.destination)

    this.droneOscA = this.ctx.createOscillator()
    this.droneOscA.type = 'sine'
    this.droneOscA.frequency.value = 46
    this.droneOscA.connect(this.droneGain)
    this.droneOscA.start()

    this.droneOscB = this.ctx.createOscillator()
    this.droneOscB.type = 'sine'
    this.droneOscB.frequency.value = 46 * 1.5 // a fifth above - tense, not melodic
    this.droneOscB.connect(this.droneGain)
    this.droneOscB.start()

    let pulseUp = true
    this.pulseInterval = setInterval(() => {
      if (!this.droneGain) return
      const target = pulseUp ? 0.06 : 0.02
      this.droneGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4)
      pulseUp = !pulseUp
    }, 1400)
  }

  stopDrone() {
    if (!this.active) return
    this.active = false
    clearInterval(this.pulseInterval)
    this.pulseInterval = null
    try {
      const now = this.ctx.currentTime
      this.droneGain?.gain.setTargetAtTime(0, now, 0.5)
      this.droneOscA?.stop(now + 1.5)
      this.droneOscB?.stop(now + 1.5)
    } catch {
      // context already closing - nothing to clean up
    }
    this.droneOscA = null
    this.droneOscB = null
    this.droneGain = null
  }

  dispose() {
    this.stopDrone()
    // Only close the context if this instance created it - a shared
    // AudioManager context outlives any one BossMusic and is closed by the
    // manager itself. AudioContext.close() returns a Promise that REJECTS
    // (doesn't throw synchronously) if already closed, hence .catch().
    if (this._ownsContext) this.ctx?.close().catch(() => {})
  }
}
