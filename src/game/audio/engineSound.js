const BASE_FREQUENCY = 55
const THROTTLE_FREQUENCY_RANGE = 70
const SPEED_FREQUENCY_RANGE = 55
const SPEED_REFERENCE = 40 // m/s at which speed's contribution to pitch maxes out
const IDLE_GAIN = 0.05
const BOOST_GAIN_BOOST = 0.02

// A synthesized engine hum (no audio asset) whose pitch tracks throttle and
// speed - "revs up" as you push the stick, like a real engine rather than a
// fixed loop. Browsers block audio before a user gesture, so `start()` is
// meant to be called from the first click/keydown handler, not eagerly.
//
// `audioManager`, if given, routes this into AudioManager's shared context
// and sfx bus - so the Settings SFX volume slider/mute affects the engine
// hum too, not just file-based sound. Without one (e.g. a standalone test,
// or WebAudio construction failing over in AudioManager already) this
// falls back to owning a private context exactly as before.
export class EngineSound {
  constructor(audioManager = null) {
    this.audioManager = audioManager
    this.ctx = null
    this.osc = null
    this.gain = null
    this.started = false
    this._ownsContext = false
  }

  start() {
    if (this.started) return
    try {
      const sharedCtx = this.audioManager?.getContext()
      const destination = this.audioManager?.getSfxBus()
      if (sharedCtx && destination) {
        this.ctx = sharedCtx
        this._ownsContext = false
      } else {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        this.ctx = new Ctx()
        this._ownsContext = true
      }

      this.osc = this.ctx.createOscillator()
      this.osc.type = 'sawtooth'
      this.osc.frequency.value = BASE_FREQUENCY
      this.gain = this.ctx.createGain()
      this.gain.gain.value = 0
      this.gain.gain.setTargetAtTime(IDLE_GAIN, this.ctx.currentTime, 0.3)
      this.osc.connect(this.gain).connect(destination ?? this.ctx.destination)
      this.osc.start()
      this.started = true
    } catch {
      // WebAudio unavailable in this environment - fail silently, the game
      // is fully playable without engine sound.
    }
  }

  update({ throttleFraction, speed, boosting }) {
    if (!this.started) return
    const targetFrequency =
      BASE_FREQUENCY +
      throttleFraction * THROTTLE_FREQUENCY_RANGE +
      Math.min(speed / SPEED_REFERENCE, 1) * SPEED_FREQUENCY_RANGE
    this.osc.frequency.setTargetAtTime(targetFrequency, this.ctx.currentTime, 0.08)
    this.gain.gain.setTargetAtTime(IDLE_GAIN + (boosting ? BOOST_GAIN_BOOST : 0), this.ctx.currentTime, 0.15)
  }

  setMuted(muted) {
    if (!this.gain) return
    this.gain.gain.setTargetAtTime(muted ? 0 : IDLE_GAIN, this.ctx.currentTime, 0.1)
  }

  dispose() {
    try {
      this.osc?.stop()
    } catch {
      // already stopped - nothing to clean up
    }
    // Only close the context if this instance created it - a shared
    // AudioManager context outlives any one EngineSound and is closed by
    // the manager itself. AudioContext.close() returns a Promise that
    // REJECTS (doesn't throw synchronously) if already closed, so this
    // needs .catch(), not just a try/catch around the call.
    if (this._ownsContext) this.ctx?.close().catch(() => {})
  }
}
