// Central control configuration: two full schemes (Realistic Simulation /
// Arcade FPS-style), each with its own keyboard+mouse bindings AND its own
// gamepad button bindings (so keyboard and controller can be used
// interchangeably without fighting over one binding slot), plus shared
// sensitivity/deadzone/vibration settings and named custom presets.
//
// Binding shape is one of:
//   { device: 'keyboard', code: <KeyboardEvent.code> }
//   { device: 'mouse', code: 'Left' | 'Right' | 'Middle' | 'WheelUp' | 'WheelDown' | 'AxisXNeg' | 'AxisXPos' }
//   { device: 'gamepad', code: <key of gamepadManager.BUTTON, e.g. 'A', 'LB'> }
//
// Analog stick axes and the triggers are NOT individually remappable (see
// gamepadManager.js / the flight models) - only the digital face
// buttons/bumpers/dpad go through this generic binding system, matching
// the spec's own fixed "Default Controller Mapping" for the sticks.

export const SCHEMES = ['sim', 'arcade']

const key = (code) => ({ device: 'keyboard', code })
const mouse = (code) => ({ device: 'mouse', code })
const pad = (code) => ({ device: 'gamepad', code })

export const ACTIONS_BY_SCHEME = {
  sim: [
    { id: 'pitchDown', label: 'Pitch Down (Dive)', category: 'Flight' },
    { id: 'pitchUp', label: 'Pitch Up (Climb)', category: 'Flight' },
    { id: 'yawLeft', label: 'Yaw Left', category: 'Flight' },
    { id: 'yawRight', label: 'Yaw Right', category: 'Flight' },
    { id: 'rollLeft', label: 'Roll Left', category: 'Flight' },
    { id: 'rollRight', label: 'Roll Right', category: 'Flight' },
    { id: 'throttleUp', label: 'Increase Collective', category: 'Flight' },
    { id: 'throttleDown', label: 'Decrease Collective', category: 'Flight' },
    { id: 'firePrimary', label: 'Fire Primary Weapon', category: 'Weapons' },
    { id: 'fireSecondary', label: 'Fire Secondary Weapon', category: 'Weapons' },
    { id: 'cycleWeapon', label: 'Cycle Weapon Type', category: 'Weapons' },
    { id: 'reload', label: 'Reload / Countermeasures', category: 'Weapons' },
    { id: 'cameraToggle', label: 'Toggle Camera View', category: 'Utility' },
    { id: 'flares', label: 'Deploy Flares / Chaff', category: 'Utility' },
    { id: 'radarToggle', label: 'Toggle Tactical Map', category: 'Utility' },
    { id: 'pause', label: 'Pause Game', category: 'Utility' },
    { id: 'boosterSlot1', label: 'Use Shield Boost', category: 'Boosters' },
    { id: 'boosterSlot2', label: 'Use Speed Burst', category: 'Boosters' },
    { id: 'boosterSlot3', label: 'Use Weapon Boost', category: 'Boosters' },
  ],
  arcade: [
    { id: 'moveForward', label: 'Move Forward', category: 'Flight' },
    { id: 'moveBackward', label: 'Move Backward', category: 'Flight' },
    { id: 'strafeLeft', label: 'Strafe Left', category: 'Flight' },
    { id: 'strafeRight', label: 'Strafe Right', category: 'Flight' },
    { id: 'altitudeUp', label: 'Move Up', category: 'Flight' },
    { id: 'altitudeDown', label: 'Move Down', category: 'Flight' },
    { id: 'firePrimary', label: 'Fire Machine Gun', category: 'Weapons' },
    { id: 'fireSecondary', label: 'Fire Missiles', category: 'Weapons' },
    { id: 'reload', label: 'Reload', category: 'Weapons' },
    { id: 'cameraToggle', label: 'Toggle Camera View', category: 'Utility' },
    { id: 'flares', label: 'Deploy Flares', category: 'Utility' },
    { id: 'radarToggle', label: 'Toggle Tactical Map', category: 'Utility' },
    { id: 'pause', label: 'Pause Game', category: 'Utility' },
    { id: 'boosterSlot1', label: 'Use Shield Boost', category: 'Boosters' },
    { id: 'boosterSlot2', label: 'Use Speed Burst', category: 'Boosters' },
    { id: 'boosterSlot3', label: 'Use Weapon Boost', category: 'Boosters' },
  ],
}

export const DEFAULT_BINDINGS = {
  sim: {
    pitchDown: key('KeyW'),
    pitchUp: key('KeyS'),
    yawLeft: key('KeyA'),
    yawRight: key('KeyD'),
    rollLeft: key('KeyQ'),
    rollRight: key('KeyE'),
    throttleUp: key('ShiftLeft'),
    throttleDown: key('ControlLeft'),
    firePrimary: key('Space'),
    fireSecondary: key('KeyF'),
    cycleWeapon: mouse('WheelUp'),
    reload: key('KeyR'),
    cameraToggle: key('KeyC'),
    flares: key('KeyX'),
    radarToggle: key('Tab'),
    pause: key('Escape'),
    boosterSlot1: key('Digit1'),
    boosterSlot2: key('Digit2'),
    boosterSlot3: key('Digit3'),
  },
  arcade: {
    moveForward: key('KeyW'),
    moveBackward: key('KeyS'),
    strafeLeft: key('KeyA'),
    strafeRight: key('KeyD'),
    altitudeUp: key('ShiftLeft'),
    altitudeDown: key('ControlLeft'),
    firePrimary: mouse('Left'),
    fireSecondary: mouse('Right'),
    reload: key('KeyR'),
    cameraToggle: key('KeyC'),
    flares: key('Space'),
    radarToggle: key('Tab'),
    pause: key('Escape'),
    boosterSlot1: key('Digit1'),
    boosterSlot2: key('Digit2'),
    boosterSlot3: key('Digit3'),
  },
}

export const DEFAULT_GAMEPAD_BINDINGS = {
  sim: {
    firePrimary: pad('A'),
    fireSecondary: pad('RB'),
    cycleWeapon: pad('B'),
    reload: pad('X'),
    cameraToggle: pad('Y'),
    flares: pad('LB'),
    radarToggle: pad('BACK'),
    pause: pad('START'),
    boosterSlot1: pad('DPAD_UP'),
    boosterSlot2: pad('DPAD_LEFT'),
    boosterSlot3: pad('DPAD_RIGHT'),
  },
  arcade: {
    firePrimary: pad('A'),
    fireSecondary: pad('RB'),
    reload: pad('X'),
    cameraToggle: pad('Y'),
    flares: pad('LB'),
    radarToggle: pad('BACK'),
    pause: pad('START'),
    boosterSlot1: pad('DPAD_UP'),
    boosterSlot2: pad('DPAD_LEFT'),
    boosterSlot3: pad('DPAD_RIGHT'),
  },
}

export const DEFAULT_SETTINGS = {
  mouseSensitivity: 0.5,
  invertY: false,
  mouseAcceleration: false,
  cameraSmoothing: 0.5,
  gamepadEnabled: true,
  gamepadDeadzone: 0.15,
  gamepadSensitivity: 0.5,
  triggerCurve: 'linear',
  vibration: 1,
  showHints: true,
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  audioMuted: false,

  // --- Graphics (applied live by createScene.js's settings subscription) ---
  drawDistance: 0.5, // 0..1 -> fog/camera far plane
  shadowQuality: 'medium', // 'off' | 'low' | 'medium' | 'high'
  particleIntensity: 1, // 0..1, scales EffectsManager's debris/flare counts

  // --- Accessibility (applied to <html> by applyDisplaySettings) ---
  textSize: 'normal', // 'normal' | 'large' | 'larger'
  colorblindMode: 'off', // 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia'
  reducedMotion: false, // motion-sickness mode: no FOV kick, damped camera, no flash

  // --- Game ---
  defaultDifficulty: 'normal', // pre-selected for Free Play and mission briefings
  autoSave: true,
  showObjectiveMarkers: true,
}

const STORAGE_KEY = 'horizon-raider:controls'

const KEY_LABELS = {
  Space: 'Space',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  Escape: 'Esc',
  Tab: 'Tab',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
}

const MOUSE_LABELS = {
  Left: 'LMB',
  Right: 'RMB',
  Middle: 'MMB',
  AxisXNeg: 'Mouse Left',
  AxisXPos: 'Mouse Right',
  WheelUp: 'Wheel Up',
  WheelDown: 'Wheel Down',
}

const GAMEPAD_LABELS = {
  A: 'A',
  B: 'B',
  X: 'X',
  Y: 'Y',
  LB: 'LB',
  RB: 'RB',
  LT: 'LT',
  RT: 'RT',
  BACK: 'Select', // "Back/Select" button - labeled to avoid reading like the menu's own Back button
  START: 'Start',
  LS: 'L-Stick',
  RS: 'R-Stick',
  DPAD_UP: 'D-Up',
  DPAD_DOWN: 'D-Down',
  DPAD_LEFT: 'D-Left',
  DPAD_RIGHT: 'D-Right',
}

export function describeBinding(binding) {
  if (!binding) return 'Unbound'
  if (binding.device === 'keyboard') {
    if (binding.code.startsWith('Key')) return binding.code.slice(3)
    if (binding.code.startsWith('Digit')) return binding.code.slice(5)
    if (binding.code.startsWith('Numpad')) return `Num ${binding.code.slice(6)}`
    return KEY_LABELS[binding.code] ?? binding.code
  }
  if (binding.device === 'mouse') return MOUSE_LABELS[binding.code] ?? binding.code
  return GAMEPAD_LABELS[binding.code] ?? binding.code
}

export function bindingsEqual(a, b) {
  return !!a && !!b && a.device === b.device && a.code === b.code
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Owns everything under Settings/Customization: active scheme, both
// schemes' keyboard+mouse and gamepad bindings, general/controller
// settings, and named custom presets. InputManager reads through this
// live every frame, so any change here takes effect immediately.
export class ControlConfig {
  constructor() {
    const stored = loadStored()
    this.scheme = stored?.scheme && SCHEMES.includes(stored.scheme) ? stored.scheme : 'sim'
    this.bindings = { sim: { ...DEFAULT_BINDINGS.sim }, arcade: { ...DEFAULT_BINDINGS.arcade } }
    this.gamepadBindings = {
      sim: { ...DEFAULT_GAMEPAD_BINDINGS.sim },
      arcade: { ...DEFAULT_GAMEPAD_BINDINGS.arcade },
    }
    if (stored?.bindings) {
      for (const scheme of SCHEMES) Object.assign(this.bindings[scheme], stored.bindings[scheme] ?? {})
    }
    if (stored?.gamepadBindings) {
      for (const scheme of SCHEMES) Object.assign(this.gamepadBindings[scheme], stored.gamepadBindings[scheme] ?? {})
    }
    this.settings = { ...DEFAULT_SETTINGS, ...(stored?.settings ?? {}) }
    this.customPresets = Array.isArray(stored?.customPresets) ? stored.customPresets : []
    this.hasSeenTutorial = !!stored?.hasSeenTutorial

    this._listeners = new Set()
  }

  getBinding(actionId, { gamepad = false } = {}) {
    const map = gamepad ? this.gamepadBindings[this.scheme] : this.bindings[this.scheme]
    return map[actionId] ?? null
  }

  setBinding(actionId, binding, { gamepad = false } = {}) {
    const map = gamepad ? this.gamepadBindings[this.scheme] : this.bindings[this.scheme]
    map[actionId] = binding
    this._persist()
    this._notify()
  }

  findConflict(actionId, binding, { gamepad = false } = {}) {
    const map = gamepad ? this.gamepadBindings[this.scheme] : this.bindings[this.scheme]
    for (const [id, existing] of Object.entries(map)) {
      if (id !== actionId && bindingsEqual(existing, binding)) return id
    }
    return null
  }

  setScheme(scheme) {
    if (!SCHEMES.includes(scheme) || scheme === this.scheme) return
    this.scheme = scheme
    this._persist()
    this._notify()
  }

  resetAction(actionId, { gamepad = false } = {}) {
    const defaults = gamepad ? DEFAULT_GAMEPAD_BINDINGS : DEFAULT_BINDINGS
    const fallback = defaults[this.scheme][actionId]
    if (!fallback) return
    const map = gamepad ? this.gamepadBindings[this.scheme] : this.bindings[this.scheme]
    map[actionId] = { ...fallback }
    this._persist()
    this._notify()
  }

  resetScheme(scheme = this.scheme) {
    this.bindings[scheme] = { ...DEFAULT_BINDINGS[scheme] }
    this.gamepadBindings[scheme] = { ...DEFAULT_GAMEPAD_BINDINGS[scheme] }
    this._persist()
    this._notify()
  }

  resetAll() {
    this.bindings = { sim: { ...DEFAULT_BINDINGS.sim }, arcade: { ...DEFAULT_BINDINGS.arcade } }
    this.gamepadBindings = {
      sim: { ...DEFAULT_GAMEPAD_BINDINGS.sim },
      arcade: { ...DEFAULT_GAMEPAD_BINDINGS.arcade },
    }
    this.settings = { ...DEFAULT_SETTINGS }
    this._persist()
    this._notify()
  }

  updateSetting(key, value) {
    this.settings[key] = value
    this._persist()
    this._notify()
  }

  markTutorialSeen() {
    this.hasSeenTutorial = true
    this._persist()
  }

  savePreset(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    const snapshot = {
      name: trimmed,
      scheme: this.scheme,
      bindings: deepClone(this.bindings[this.scheme]),
      gamepadBindings: deepClone(this.gamepadBindings[this.scheme]),
      settings: deepClone(this.settings),
    }
    this.customPresets = [...this.customPresets.filter((p) => p.name !== trimmed), snapshot]
    this._persist()
    this._notify()
  }

  loadPreset(name) {
    const preset = this.customPresets.find((p) => p.name === name)
    if (!preset) return
    this.scheme = preset.scheme
    this.bindings[preset.scheme] = deepClone(preset.bindings)
    this.gamepadBindings[preset.scheme] = deepClone(preset.gamepadBindings)
    if (preset.settings) this.settings = { ...this.settings, ...preset.settings }
    this._persist()
    this._notify()
  }

  deletePreset(name) {
    this.customPresets = this.customPresets.filter((p) => p.name !== name)
    this._persist()
    this._notify()
  }

  exportJSON() {
    return JSON.stringify(
      {
        scheme: this.scheme,
        bindings: this.bindings,
        gamepadBindings: this.gamepadBindings,
        settings: this.settings,
        customPresets: this.customPresets,
      },
      null,
      2,
    )
  }

  // Returns true on success. Rejects anything that doesn't look like a
  // config export rather than partially applying a malformed file.
  importJSON(jsonText) {
    try {
      const parsed = JSON.parse(jsonText)
      if (!parsed || typeof parsed !== 'object' || !parsed.bindings || !parsed.settings) return false
      if (parsed.scheme && SCHEMES.includes(parsed.scheme)) this.scheme = parsed.scheme
      for (const scheme of SCHEMES) {
        if (parsed.bindings[scheme]) Object.assign(this.bindings[scheme], parsed.bindings[scheme])
        if (parsed.gamepadBindings?.[scheme]) Object.assign(this.gamepadBindings[scheme], parsed.gamepadBindings[scheme])
      }
      this.settings = { ...this.settings, ...parsed.settings }
      if (Array.isArray(parsed.customPresets)) this.customPresets = parsed.customPresets
      this._persist()
      this._notify()
      return true
    } catch {
      return false
    }
  }

  subscribe(listener) {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  _notify() {
    for (const listener of this._listeners) listener()
  }

  _persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scheme: this.scheme,
          bindings: this.bindings,
          gamepadBindings: this.gamepadBindings,
          settings: this.settings,
          customPresets: this.customPresets,
          hasSeenTutorial: this.hasSeenTutorial,
        }),
      )
    } catch {
      // localStorage unavailable - config still works for this session.
    }
  }
}
