import { MUSIC_MANIFEST, SFX_MANIFEST } from './audioManifest.js'

const MAX_CONCURRENT_PER_KEY = 4 // e.g. a machine gun firing faster than its own SFX decays
const DEFAULT_CROSSFADE_SECONDS = 1.5
const INTENSITY_RAMP_SECONDS = 0.6

// Central audio system: one shared AudioContext with a master bus split
// into music/sfx sub-buses (so the three volume sliders in Settings each
// control a real, separate gain node), file loading that fails silently
// (no manifest entry has a real file yet - see audioManifest.js's own
// docs), crossfading music playback, and a voice-limited SFX "queue" that
// drops excess overlapping triggers of the same sound rather than queueing
// them to play late (correct for something like rapid gunfire - a
// stacked-up backlog of gunshot sounds playing after the gun already
// stopped would sound wrong, not just delayed).
//
// engineSound.js/bossMusic.js (the existing *procedural*, no-file-needed
// audio from earlier turns) plug into this same graph via
// getMusicBus()/getSfxBus() rather than owning a private AudioContext each
// - so the Settings sliders/mute affect them too, not just file-based
// sound.
export class AudioManager {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.musicGain = null
    this.sfxGain = null

    this._masterVolume = 0.8
    this._musicVolume = 0.7
    this._sfxVolume = 0.8
    this._muted = false

    this._bufferCache = new Map() // path -> AudioBuffer | null (null = tried, unavailable)
    this._warnedKeys = new Set() // avoid re-logging the same missing file every call

    this._music = null // { key, source, layerSource, gain, layerGain }
    this._musicRequestId = 0
    this._activeVoices = new Map() // sfxKey -> Set<AudioBufferSourceNode>

    this._ensureContext()
  }

  _ensureContext() {
    // A *closed* context is not reusable - every node built on it is inert
    // (the browser warns "not useful when context is closed"). dispose()
    // can legitimately run while the manager itself lives on (React
    // StrictMode replays mount/unmount in dev against this same app-lifetime
    // singleton), so treat "closed" as "needs rebuilding" rather than
    // trusting a non-null ctx.
    if (this.ctx && this.ctx.state !== 'closed') return true
    if (this.ctx) this._resetGraph()
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return false
      this.ctx = new Ctx()
      this.masterGain = this.ctx.createGain()
      this.musicGain = this.ctx.createGain()
      this.sfxGain = this.ctx.createGain()
      this.musicGain.connect(this.masterGain)
      this.sfxGain.connect(this.masterGain)
      this.masterGain.connect(this.ctx.destination)
      this._applyVolumes()
      return true
    } catch {
      return false
    }
  }

  // Browsers start every AudioContext suspended until a user gesture -
  // call this from the first click/keydown handler (same pattern as
  // engineSound.js's start()).
  resume() {
    this._ensureContext()
    this.ctx?.resume().catch(() => {})
  }

  // These three hand out live nodes for other synths (engineSound.js,
  // bossMusic.js) to route through the shared master/music/sfx buses, so
  // they each ensure the graph exists rather than handing back a stale
  // node from a context that has since been closed.
  getContext() {
    this._ensureContext()
    return this.ctx
  }

  getMusicBus() {
    this._ensureContext()
    return this.musicGain
  }

  getSfxBus() {
    this._ensureContext()
    return this.sfxGain
  }

  // --- Volume/mute - each independently persisted via controlConfig's
  // settings (see App.jsx's subscribe wiring) ---

  setMasterVolume(v) {
    this._masterVolume = v
    this._applyVolumes()
  }

  setMusicVolume(v) {
    this._musicVolume = v
    this._applyVolumes()
  }

  setSfxVolume(v) {
    this._sfxVolume = v
    this._applyVolumes()
  }

  setMuted(muted) {
    this._muted = muted
    this._applyVolumes()
  }

  _applyVolumes() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.masterGain.gain.setTargetAtTime(this._muted ? 0 : this._masterVolume, now, 0.05)
    this.musicGain.gain.setTargetAtTime(this._musicVolume, now, 0.05)
    this.sfxGain.gain.setTargetAtTime(this._sfxVolume, now, 0.05)
  }

  // Tries `${basePath}.mp3` then `${basePath}.wav` - "ready for .mp3 or
  // .wav files" without every manifest entry needing to commit to one
  // extension. A failed load (404, decode error, whatever) caches as
  // `null` so repeated triggers of a still-missing sound don't refetch
  // every time - see clearMissingCache() for the dev-convenience escape
  // hatch if files get added mid-session.
  async _loadBuffer(basePath) {
    if (this._bufferCache.has(basePath)) return this._bufferCache.get(basePath)
    if (!this._ensureContext()) return null

    for (const ext of ['mp3', 'wav']) {
      try {
        const res = await fetch(`/${basePath}.${ext}`)
        if (!res.ok) continue
        const arrayBuffer = await res.arrayBuffer()
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)
        this._bufferCache.set(basePath, audioBuffer)
        return audioBuffer
      } catch {
        // this extension didn't pan out - try the next, or fall through to "unavailable" below
      }
    }
    if (!this._warnedKeys.has(basePath)) {
      this._warnedKeys.add(basePath)
      console.info(`[audio] "${basePath}.mp3/.wav" not found - continuing without it.`)
    }
    this._bufferCache.set(basePath, null)
    return null
  }

  // Dev convenience: drop new files into public/audio and call this (e.g.
  // from the browser console) to pick them up without a full page reload.
  clearMissingCache() {
    for (const [path, buffer] of this._bufferCache) {
      if (buffer === null) this._bufferCache.delete(path)
    }
    this._warnedKeys.clear()
  }

  // --- Music ---

  // Crossfades to `key`'s track (see audioManifest.js's MUSIC_MANIFEST),
  // looping. If it's already the current track, this is a no-op - repeated
  // calls (e.g. every mission-start) don't restart it from the top. If the
  // file isn't available, the CURRENT track (if any) is left playing
  // untouched rather than cut to silence just because the next one is missing.
  async playMusic(key, { crossfadeSeconds = DEFAULT_CROSSFADE_SECONDS } = {}) {
    if (this._music?.key === key) return
    const manifestEntry = MUSIC_MANIFEST[key]
    if (!manifestEntry) return

    const requestId = ++this._musicRequestId
    const buffer = await this._loadBuffer(manifestEntry.base)
    if (requestId !== this._musicRequestId) return // superseded by a newer playMusic() call while this one loaded
    if (!buffer || !this._ensureContext()) return

    const now = this.ctx.currentTime
    const previous = this._music
    if (previous) {
      previous.gain.gain.setTargetAtTime(0, now, crossfadeSeconds / 3)
      previous.layerGain?.gain.setTargetAtTime(0, now, crossfadeSeconds / 3)
      const stopAt = now + crossfadeSeconds + 0.2
      previous.source.stop(stopAt)
      previous.layerSource?.stop(stopAt)
    }

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + crossfadeSeconds)
    gain.connect(this.musicGain)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    source.start(now)

    let layerSource = null
    let layerGain = null
    if (manifestEntry.layer) {
      const layerBuffer = await this._loadBuffer(manifestEntry.layer)
      if (requestId === this._musicRequestId && layerBuffer && this.ctx) {
        layerGain = this.ctx.createGain()
        layerGain.gain.setValueAtTime(0, this.ctx.currentTime) // starts silent - setMusicIntensity() brings it up
        layerGain.connect(this.musicGain)
        layerSource = this.ctx.createBufferSource()
        layerSource.buffer = layerBuffer
        layerSource.loop = true
        layerSource.connect(layerGain)
        layerSource.start(this.ctx.currentTime)
      }
    }

    this._music = { key, source, layerSource, gain, layerGain }
  }

  // Crossfades the current track's intensity-layer file (if it has one, and
  // it's loaded) toward `fraction` (0..1) - "tension builds for boss
  // fights" without needing a whole separate track per phase. A silent
  // no-op if the current track has no layer or it never loaded.
  setMusicIntensity(fraction) {
    if (!this._music?.layerGain || !this.ctx) return
    this._music.layerGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, fraction)),
      this.ctx.currentTime,
      INTENSITY_RAMP_SECONDS,
    )
  }

  stopMusic({ fadeSeconds = DEFAULT_CROSSFADE_SECONDS } = {}) {
    this._musicRequestId++ // invalidate any in-flight playMusic() load
    if (!this._music || !this.ctx) {
      this._music = null
      return
    }
    const now = this.ctx.currentTime
    this._music.gain.gain.setTargetAtTime(0, now, fadeSeconds / 3)
    this._music.layerGain?.gain.setTargetAtTime(0, now, fadeSeconds / 3)
    const stopAt = now + fadeSeconds + 0.2
    this._music.source.stop(stopAt)
    this._music.layerSource?.stop(stopAt)
    this._music = null
  }

  // --- SFX ---

  // Fire-and-forget. `rateVariance` randomizes playback rate slightly
  // (+/- that fraction) so e.g. repeated gunshots don't sound like the
  // exact same sample looping mechanically.
  async playSfx(key, { volume = 1, rateVariance = 0.06 } = {}) {
    const path = SFX_MANIFEST[key]
    if (!path) return

    let voices = this._activeVoices.get(key)
    if (!voices) {
      voices = new Set()
      this._activeVoices.set(key, voices)
    }
    if (voices.size >= MAX_CONCURRENT_PER_KEY) return // saturated - drop rather than queue-and-delay

    const buffer = await this._loadBuffer(path)
    if (!buffer || !this._ensureContext()) return

    const gain = this.ctx.createGain()
    gain.gain.value = volume
    gain.connect(this.sfxGain)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * rateVariance
    source.connect(gain)
    voices.add(source)
    source.onended = () => voices.delete(source)
    source.start()
  }

  dispose() {
    this.stopMusic({ fadeSeconds: 0 })
    for (const voices of this._activeVoices.values()) {
      for (const source of voices) {
        try {
          source.stop()
        } catch {
          // already stopped
        }
      }
    }
    this._activeVoices.clear()
    this.ctx?.close().catch(() => {})
    // Drop the graph so a later use rebuilds it instead of quietly
    // attaching new nodes to a closed context (which is silent, not an
    // error - exactly the kind of failure that looks like "audio is broken"
    // with nothing in the console).
    this._resetGraph()
  }

  // Forgets the audio graph without touching the buffer cache - decoded
  // buffers stay valid to re-bind onto a fresh context.
  _resetGraph() {
    this.ctx = null
    this.masterGain = null
    this.musicGain = null
    this.sfxGain = null
    this._music = null
    this._activeVoices.clear()
  }

  // Console-friendly health check: is the context actually running, what
  // are the real gain values, and which manifest entries have loaded /
  // failed / not been tried yet. `await window.__audioManager.diagnose()`
  diagnose() {
    const status = (basePath) =>
      !this._bufferCache.has(basePath)
        ? 'not-yet-requested'
        : this._bufferCache.get(basePath)
          ? 'loaded'
          : 'MISSING/undecodable'
    const music = Object.fromEntries(
      Object.entries(MUSIC_MANIFEST).map(([k, v]) => [k, status(v.base)]),
    )
    const sfx = Object.fromEntries(Object.entries(SFX_MANIFEST).map(([k, v]) => [k, status(v)]))
    const report = {
      contextState: this.ctx?.state ?? 'no context',
      sampleRate: this.ctx?.sampleRate ?? null,
      gains: {
        master: this.masterGain?.gain.value ?? null,
        music: this.musicGain?.gain.value ?? null,
        sfx: this.sfxGain?.gain.value ?? null,
      },
      settings: {
        masterVolume: this._masterVolume,
        musicVolume: this._musicVolume,
        sfxVolume: this._sfxVolume,
        muted: this._muted,
      },
      currentMusic: this._music?.key ?? null,
      music,
      sfx,
    }
    console.table({ ...music, ...sfx })
    console.log('[audio] diagnose:', report)
    return report
  }
}
