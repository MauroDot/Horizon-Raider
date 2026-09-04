import { ACTIONS_BY_SCHEME } from './controlConfig.js'
import { BUTTON } from './gamepad/gamepadManager.js'

const MOUSE_AXIS_FULL_SPEED_PXPS = 600 // mouse-X speed (px/s) that maps to full deflection
const WHEEL_NUDGE_SECONDS = 0.15

// Resolves live input into a scheme-agnostic snapshot every frame: every
// bindable action (from the *current* scheme's action list, see
// controlConfig.js) as a plain 0/1, checked against BOTH its keyboard/mouse
// binding and its gamepad binding - so keyboard and controller both just
// work without the player choosing a "mode". Continuous signals (mouse
// deltas, gamepad sticks/triggers) come through separately, raw, for each
// flight model to interpret per its own scheme's semantics.
export class InputManager {
  constructor(domElement, controlConfig, gamepadManager) {
    this.domElement = domElement
    this.controlConfig = controlConfig
    this.gamepadManager = gamepadManager
    this.keys = new Set()
    this.mouseButtons = new Set()
    this.mouseDX = 0
    this.mouseDY = 0
    this.pointerLocked = false
    this.inputMethod = 'keyboard'

    this._wheelUpTimer = 0
    this._wheelDownTimer = 0
    this._prevDigital = new Map() // actionId -> was it active last frame (for edge-detected actions)
    this._lastKeyboardActivity = 0

    this._handleKeyDown = (e) => {
      // Tab's default browser action is focus-navigation, which can fire a
      // window blur mid-keypress - and the blur handler below clears all
      // held keys as a stuck-key safety net, wiping Tab out before its own
      // keyup even arrives. Suppressing the default keeps it a plain
      // in-game binding like any other key.
      if (e.code === 'Tab') e.preventDefault()
      this.keys.add(e.code)
      this._lastKeyboardActivity = performance.now()
    }
    this._handleKeyUp = (e) => this.keys.delete(e.code)
    this._handleMouseMove = (e) => {
      if (!this.pointerLocked) return
      this.mouseDX += e.movementX || 0
      this.mouseDY += e.movementY || 0
      this._lastKeyboardActivity = performance.now()
    }
    this._handleMouseDown = (e) => {
      this.mouseButtons.add(e.button)
      this._lastKeyboardActivity = performance.now()
    }
    this._handleMouseUp = (e) => this.mouseButtons.delete(e.button)
    this._handleWheel = (e) => {
      e.preventDefault()
      if (e.deltaY < 0) this._wheelUpTimer = WHEEL_NUDGE_SECONDS
      else if (e.deltaY > 0) this._wheelDownTimer = WHEEL_NUDGE_SECONDS
      this._lastKeyboardActivity = performance.now()
    }
    this._handleContextMenu = (e) => e.preventDefault()
    this._handleClick = () => {
      if (document.pointerLockElement !== domElement) domElement.requestPointerLock?.()
    }
    this._handlePointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === domElement
      if (!this.pointerLocked) this.mouseButtons.clear()
    }
    this._handleBlur = () => {
      this.keys.clear()
      this.mouseButtons.clear()
    }

    window.addEventListener('keydown', this._handleKeyDown)
    window.addEventListener('keyup', this._handleKeyUp)
    window.addEventListener('mousemove', this._handleMouseMove)
    window.addEventListener('blur', this._handleBlur)
    domElement.addEventListener('click', this._handleClick)
    domElement.addEventListener('mousedown', this._handleMouseDown)
    domElement.addEventListener('mouseup', this._handleMouseUp)
    domElement.addEventListener('wheel', this._handleWheel, { passive: false })
    domElement.addEventListener('contextmenu', this._handleContextMenu)
    document.addEventListener('pointerlockchange', this._handlePointerLockChange)
  }

  _keyboardMouseActive(binding, mouseAxisSpeedX) {
    if (!binding) return false
    if (binding.device === 'keyboard') return this.keys.has(binding.code)
    switch (binding.code) {
      case 'Left':
        return this.mouseButtons.has(0)
      case 'Right':
        return this.mouseButtons.has(2)
      case 'Middle':
        return this.mouseButtons.has(1)
      case 'AxisXNeg':
        return -mouseAxisSpeedX > 0.15
      case 'AxisXPos':
        return mouseAxisSpeedX > 0.15
      case 'WheelUp':
        return this._wheelUpTimer > 0
      case 'WheelDown':
        return this._wheelDownTimer > 0
      default:
        return false
    }
  }

  _gamepadActive(binding, padState) {
    if (!binding || !padState) return false
    const index = BUTTON[binding.code]
    return index != null && !!padState.buttons[index]
  }

  // Snapshot of this frame's resolved input. `delta` is used to turn the
  // raw per-frame mouse delta into a framerate-independent speed.
  poll(delta) {
    this._wheelUpTimer = Math.max(0, this._wheelUpTimer - delta)
    this._wheelDownTimer = Math.max(0, this._wheelDownTimer - delta)

    const mouseAxisSpeedX = delta > 0 ? this.mouseDX / delta / MOUSE_AXIS_FULL_SPEED_PXPS : 0
    const mouseDX = this.mouseDX
    const mouseDY = this.mouseDY
    this.mouseDX = 0
    this.mouseDY = 0

    const padState = this.gamepadManager?.poll() ?? null

    if (padState && this.gamepadManager.lastActiveAt > this._lastKeyboardActivity) {
      this.inputMethod = 'gamepad'
    } else if (this._lastKeyboardActivity > 0) {
      this.inputMethod = 'keyboard'
    }

    const scheme = this.controlConfig.scheme
    const actions = {}
    const edges = {}
    for (const action of ACTIONS_BY_SCHEME[scheme]) {
      const kbBinding = this.controlConfig.getBinding(action.id, { gamepad: false })
      const padBinding = this.controlConfig.getBinding(action.id, { gamepad: true })
      const active =
        this._keyboardMouseActive(kbBinding, mouseAxisSpeedX) || this._gamepadActive(padBinding, padState)
      actions[action.id] = active

      const wasActive = this._prevDigital.get(action.id) ?? false
      edges[action.id] = active && !wasActive
      this._prevDigital.set(action.id, active)
    }

    return {
      actions, // { [actionId]: boolean held }
      pressed: edges, // { [actionId]: boolean rising-edge this frame }
      mouseDX,
      mouseDY,
      pointerLocked: this.pointerLocked,
      inputMethod: this.inputMethod,
      gamepadConnected: !!padState,
      pad: padState, // raw { leftX, leftY, rightX, rightY, leftTrigger, rightTrigger, buttons }
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._handleKeyDown)
    window.removeEventListener('keyup', this._handleKeyUp)
    window.removeEventListener('mousemove', this._handleMouseMove)
    window.removeEventListener('blur', this._handleBlur)
    this.domElement.removeEventListener('click', this._handleClick)
    this.domElement.removeEventListener('mousedown', this._handleMouseDown)
    this.domElement.removeEventListener('mouseup', this._handleMouseUp)
    this.domElement.removeEventListener('wheel', this._handleWheel)
    this.domElement.removeEventListener('contextmenu', this._handleContextMenu)
    document.removeEventListener('pointerlockchange', this._handlePointerLockChange)
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.()
    }
  }
}
