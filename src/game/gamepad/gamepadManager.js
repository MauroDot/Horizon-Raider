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

function clamp11(v) {
  return Math.max(-1, Math.min(1, v))
}

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
    enabled = true,
  } = {}) {
    this.deadzone = deadzone
    this.sensitivity = sensitivity
    this.triggerCurve = triggerCurve
    this.vibration = vibration
    this.enabled = enabled
    this.index = null
    this.connected = false
    this.lastActiveAt = 0
    // Resting value of each axis, captured on the first poll after a
    // connect and subtracted from every later reading. Without this, a worn
    // stick that rests at 0.2 (or a non-standard pad whose axes[2] is a
    // trigger resting at -1) sails straight past the deadzone and reads as
    // permanent, un-cancellable yaw input - the aircraft just spins.
    this._neutral = null
    this.nonStandardMapping = false

    this._connectionListeners = new Set()
    this._onConnect = (e) => {
      if (this.index == null) this.index = e.gamepad.index
      this._neutral = null // recalibrate against the new device's resting position
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

  updateSettings({ deadzone, sensitivity, triggerCurve, vibration, enabled } = {}) {
    if (enabled != null) this.enabled = enabled
    if (deadzone != null) this.deadzone = deadzone
    if (sensitivity != null) this.sensitivity = sensitivity
    if (triggerCurve != null) this.triggerCurve = triggerCurve
    if (vibration != null) this.vibration = vibration
  }

  // Re-samples the resting axis positions on the next poll - for the
  // Settings screen's "Recalibrate" button (let go of the sticks first).
  recalibrate() {
    this._neutral = null
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
    if (!this.enabled || this.index == null) return null
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    const pad = pads[this.index]
    if (!pad) {
      this.connected = false
      return null
    }
    this.connected = true

    // Axis indices 0-3 only mean left-stick-X/Y, right-stick-X/Y under the
    // W3C *standard* mapping. On a pad the browser reports as non-standard
    // (mapping: ''), axes[2] is just as likely to be a throttle slider or a
    // trigger - and those often rest at a hard -1/+1, which would read as a
    // permanent full-deflection stick input. There's no way to guess the
    // real layout, so sticks are ignored entirely for those devices; buttons
    // still work, since those require a deliberate press.
    this.nonStandardMapping = pad.mapping !== 'standard'

    // Calibrate the resting position once per connected device, then treat
    // that as zero. Fixes stick drift (and any axis that idles off-centre).
    if (!this._neutral) this._neutral = Array.from(pad.axes, (v) => v ?? 0)
    const centred = (i) => (pad.axes[i] ?? 0) - (this._neutral[i] ?? 0)

    const dz = this.deadzone
    const sens = this.sensitivity * 2 // 50% (default) -> 1x, so the slider reads naturally
    const stick = (i) =>
      this.nonStandardMapping ? 0 : clamp11(applyDeadzone(centred(i), dz) * sens)
    const leftX = stick(0)
    const leftY = stick(1)
    const rightX = stick(2)
    const rightY = stick(3)
    const leftTrigger = this._shapeTrigger(pad.buttons[BUTTON.LT]?.value ?? 0)
    const rightTrigger = this._shapeTrigger(pad.buttons[BUTTON.RT]?.value ?? 0)

    const buttons = pad.buttons.map((b) => b.pressed || b.value > 0.5)
    const active =
      buttons.some(Boolean) ||
      Math.abs(leftX) + Math.abs(leftY) + Math.abs(rightX) + Math.abs(rightY) + leftTrigger + rightTrigger > 0.02
    if (active) this.lastActiveAt = performance.now()

    return {
      leftX,
      leftY,
      rightX,
      rightY,
      leftTrigger,
      rightTrigger,
      buttons,
      mapping: pad.mapping || 'non-standard',
      id: pad.id,
      rawAxes: Array.from(pad.axes, (v) => +(v ?? 0).toFixed(3)),
    }
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
