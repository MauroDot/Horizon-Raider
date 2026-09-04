// Standard Gamepad button indices (W3C spec) - Xbox layout labels in
// comments since that's what the design doc uses, but this works with any
// controller the browser maps to the standard layout.
export const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  LS: 10,
  RS: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
}

const DEFAULT_DEADZONE = 0.15
const DEFAULT_SENSITIVITY = 0.5

function applyDeadzone(value, deadzone) {
  const magnitude = Math.abs(value)
  if (magnitude < deadzone) return 0
  const sign = Math.sign(value)
  return sign * ((magnitude - deadzone) / (1 - deadzone))
}

// Polls the Gamepad API (no events for per-frame axis state - the browser
// only gives us connect/disconnect events, everything else is read fresh
// each frame) and applies deadzone/trigger-curve shaping. Also drives
// rumble via the standard Haptic Actuator API where supported.
export class GamepadManager {
  constructor({
    deadzone = DEFAULT_DEADZONE,
    sensitivity = DEFAULT_SENSITIVITY,
    triggerCurve = 'linear',
    vibration = 1,
  } = {}) {
    this.deadzone = deadzone
    this.sensitivity = sensitivity
    this.triggerCurve = triggerCurve
    this.vibration = vibration
    this.index = null
    this.connected = false
    this.lastActiveAt = 0

    this._connectionListeners = new Set()
    this._onConnect = (e) => {
      if (this.index == null) this.index = e.gamepad.index
      this.connected = true
      this._notify(true, e.gamepad)
    }
    this._onDisconnect = (e) => {
      if (e.gamepad.index !== this.index) return
      this.connected = false
      this.index = null
      this._notify(false, e.gamepad)
    }
    window.addEventListener('gamepadconnected', this._onConnect)
    window.addEventListener('gamepaddisconnected', this._onDisconnect)
  }

  updateSettings({ deadzone, sensitivity, triggerCurve, vibration } = {}) {
    if (deadzone != null) this.deadzone = deadzone
    if (sensitivity != null) this.sensitivity = sensitivity
    if (triggerCurve != null) this.triggerCurve = triggerCurve
    if (vibration != null) this.vibration = vibration
  }

  onConnectionChange(listener) {
    this._connectionListeners.add(listener)
    return () => this._connectionListeners.delete(listener)
  }

  _notify(connected, gamepad) {
    for (const listener of this._connectionListeners) listener(connected, gamepad)
  }

  _shapeTrigger(value) {
    return this.triggerCurve === 'exponential' ? value * value : value
  }

  // Returns null when nothing's connected. Otherwise a plain snapshot:
  // stick axes (deadzone + sensitivity applied), trigger values (curve
  // applied), a button/dpad boolean array, and raw button objects for
  // callers that need press-strength (not used yet, kept for headroom).
  poll() {
    if (this.index == null) return null
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    const pad = pads[this.index]
    if (!pad) {
      this.connected = false
      return null
    }
    this.connected = true

    const dz = this.deadzone
    const sens = this.sensitivity * 2 // 50% (default) -> 1x, so the slider reads naturally
    const leftX = applyDeadzone(pad.axes[0] ?? 0, dz) * sens
    const leftY = applyDeadzone(pad.axes[1] ?? 0, dz) * sens
    const rightX = applyDeadzone(pad.axes[2] ?? 0, dz) * sens
    const rightY = applyDeadzone(pad.axes[3] ?? 0, dz) * sens
    const leftTrigger = this._shapeTrigger(pad.buttons[BUTTON.LT]?.value ?? 0)
    const rightTrigger = this._shapeTrigger(pad.buttons[BUTTON.RT]?.value ?? 0)

    const buttons = pad.buttons.map((b) => b.pressed || b.value > 0.5)
    const active =
      buttons.some(Boolean) ||
      Math.abs(leftX) + Math.abs(leftY) + Math.abs(rightX) + Math.abs(rightY) + leftTrigger + rightTrigger > 0.02
    if (active) this.lastActiveAt = performance.now()

    return { leftX, leftY, rightX, rightY, leftTrigger, rightTrigger, buttons }
  }

  rumble(strength = 1, durationMs = 150) {
    if (this.vibration <= 0 || this.index == null) return
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    const actuator = pads[this.index]?.vibrationActuator
    actuator
      ?.playEffect?.('dual-rumble', {
        duration: durationMs,
        strongMagnitude: Math.min(1, strength * this.vibration),
        weakMagnitude: Math.min(1, strength * this.vibration * 0.6),
      })
      .catch(() => {})
  }

  dispose() {
    window.removeEventListener('gamepadconnected', this._onConnect)
    window.removeEventListener('gamepaddisconnected', this._onDisconnect)
  }
}
