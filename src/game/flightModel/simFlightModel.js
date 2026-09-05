import * as THREE from 'three'
import { getTerrainHeight } from '../terrainHeight.js'
import { AIRSPACE, constrainToAirspace } from './airspace.js'

const GRAVITY = 9.81
const MASS = 1200
const MAX_THRUST = MASS * GRAVITY * 1.55
const HOVER_THROTTLE = (MASS * GRAVITY) / MAX_THRUST
const LINEAR_DRAG = 0.45
const THROTTLE_RATE = 0.6

const MAX_PITCH = THREE.MathUtils.degToRad(28)
const MAX_ROLL = THREE.MathUtils.degToRad(32)
const ATTITUDE_RESPONSE = 3.2
const YAW_RATE = THREE.MathUtils.degToRad(70)
const YAW_RESPONSE = 4
const AUTO_BANK_MAX = THREE.MathUtils.degToRad(8) // cosmetic extra bank layered on top of the player's own roll

const MOUSE_PITCH_SPEED = 1 / 400 // px/frame-ish -> full deflection
const RIGHT_STICK_PITCH_WEIGHT = 0.4 // right stick Y is "fine-tuning", not full authority

// Realistic Simulation flight model: cyclic (pitch/roll attitude) tilts the
// rotor thrust vector, producing real translational motion; the collective
// (throttle) sets overall thrust magnitude; pedals (yaw) rotate the body
// directly. This is genuine helicopter-style physics - momentum, drag,
// gravity - not the direct-axis arcade model (see arcadeFlightModel.js).
// Keyboard, mouse, and a hybrid gamepad stick layout all feed the same
// pitch/roll/yaw targets, summed and clamped.
export class SimFlightModel {
  // `speedMultiplier`/`agilityMultiplier` come from the resolved helicopter
  // variant x loadout preset (see createScene.js) - defaults are neutral so
  // existing callers are unaffected. `boostMultiplier` is a separate,
  // *mutable* field left at 1 by default; createScene writes into it every
  // tick from BoosterController for the temporary Speed Burst power-up,
  // stacking multiplicatively with the permanent `speedMultiplier`.
  constructor(helicopter, { position = new THREE.Vector3(0, 40, 0), speedMultiplier = 1, agilityMultiplier = 1 } = {}) {
    this.helicopter = helicopter
    this.position = position.clone()
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.yawRate = 0
    this.pitch = 0
    this.roll = 0
    this.throttle = HOVER_THROTTLE
    this.speedMultiplier = speedMultiplier
    this.agilityMultiplier = agilityMultiplier
    this.boostMultiplier = 1
    // Per-frame breakdown of what each input source contributed, for the
    // in-game input diagnostics (window.__flightDebug - see createScene.js).
    // Written in place every update() so a stuck key or a drifting gamepad
    // stick can be told apart from mouse look at a glance, rather than only
    // seeing the single summed number that reaches the physics.
    this.debugInputs = { kbYaw: 0, mouseYaw: 0, stickYaw: 0, yawInput: 0, pitchInput: 0, rollInput: 0, throttleInput: 0 }
    this._groundState = { grounded: false }
    this.grounded = false
    this.groundImpactSpeed = 0

    this._quaternion = new THREE.Quaternion()
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ')
    this._up = new THREE.Vector3()
    this._thrust = new THREE.Vector3()
    this._force = new THREE.Vector3()

    helicopter.position.copy(this.position)
  }

  get speed() {
    return this.velocity.length()
  }

  get altitude() {
    return this.position.y - getTerrainHeight(this.position.x, this.position.z)
  }

  get headingDegrees() {
    return THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(-this.yaw), 360)
  }

  get throttleFraction() {
    return this.throttle
  }

  // `input` is InputManager's raw poll() result (this frame's `actions`,
  // `mouseDX/DY`, `pad`) plus a resolved `settings` snapshot (sensitivity,
  // invertY, mouseAcceleration) - createScene assembles this each frame.
  update(delta, input) {
    const { actions, pad, mouseDX, mouseDY, settings } = input
    const invert = settings.invertY ? -1 : 1
    const mouseSens = 0.4 + settings.mouseSensitivity * 1.6 // 0..1 slider -> 0.4x..2x

    let mouseDXShaped = mouseDX
    let mouseDYShaped = mouseDY
    if (settings.mouseAcceleration) {
      mouseDXShaped = Math.sign(mouseDX) * Math.pow(Math.abs(mouseDX), 1.3)
      mouseDYShaped = Math.sign(mouseDY) * Math.pow(Math.abs(mouseDY), 1.3)
    }

    // Sign convention (verified against the actual quaternion/thrust math,
    // not just intuition): positive this.pitch = nose down = forward
    // thrust component, so "pitchDown" (dive, moves forward) must map to
    // a *positive* pitchInput.
    const kbPitch = (actions.pitchDown ? 1 : 0) - (actions.pitchUp ? 1 : 0)
    const kbRoll = (actions.rollRight ? 1 : 0) - (actions.rollLeft ? 1 : 0)
    const kbYaw = (actions.yawRight ? 1 : 0) - (actions.yawLeft ? 1 : 0)
    const kbThrottle = (actions.throttleUp ? 1 : 0) - (actions.throttleDown ? 1 : 0)

    // Mouse follows "look" convention (up = nose up = negative pitch, the
    // opposite sign of a flight stick pushed forward) - no extra negation,
    // mouseDY is already negative when the mouse moves up.
    const mousePitch = THREE.MathUtils.clamp(mouseDYShaped * MOUSE_PITCH_SPEED * mouseSens * invert, -1, 1)
    const mouseYaw = THREE.MathUtils.clamp(mouseDXShaped * MOUSE_PITCH_SPEED * mouseSens, -1, 1)

    // Stick follows flight-yoke convention (pushed forward, leftY = -1,
    // means dive/nose-down = positive pitch) - opposite of the mouse.
    const stickPitch = -(pad?.leftY ?? 0)
    const stickRoll = pad?.leftX ?? 0
    const stickYaw = pad?.rightX ?? 0
    const stickPitchFine = -(pad?.rightY ?? 0) * RIGHT_STICK_PITCH_WEIGHT
    const triggerThrottle = (pad?.rightTrigger ?? 0) - (pad?.leftTrigger ?? 0)

    const pitchInput = THREE.MathUtils.clamp(kbPitch + mousePitch + stickPitch + stickPitchFine, -1, 1)
    const rollInput = THREE.MathUtils.clamp(kbRoll + stickRoll, -1, 1)
    const yawInput = THREE.MathUtils.clamp(kbYaw + mouseYaw + stickYaw, -1, 1)
    const throttleInput = THREE.MathUtils.clamp(kbThrottle + triggerThrottle, -1, 1)

    const dbg = this.debugInputs
    dbg.kbYaw = kbYaw
    dbg.mouseYaw = mouseYaw
    dbg.stickYaw = stickYaw
    dbg.yawInput = yawInput
    dbg.pitchInput = pitchInput
    dbg.rollInput = rollInput
    dbg.throttleInput = throttleInput

    this.throttle = THREE.MathUtils.clamp(this.throttle + throttleInput * THROTTLE_RATE * delta, 0, 1)

    // Agility scales how far the cyclic can deflect and how fast the pedals
    // turn the nose; speed (combined with any active boost) scales top
    // speed by thinning drag instead of adding thrust, so hover balance
    // (which only depends on throttle vs. gravity, not drag) is untouched.
    const maxPitch = MAX_PITCH * this.agilityMultiplier
    const maxRoll = MAX_ROLL * this.agilityMultiplier
    const yawRate = YAW_RATE * this.agilityMultiplier
    const effectiveSpeedMultiplier = this.speedMultiplier * this.boostMultiplier

    const targetPitch = pitchInput * maxPitch
    const ease = 1 - Math.exp(-ATTITUDE_RESPONSE * delta)
    this.pitch += (targetPitch - this.pitch) * ease

    const autoBank = THREE.MathUtils.clamp(-this.yawRate / yawRate, -1, 1) * AUTO_BANK_MAX
    const targetRoll = THREE.MathUtils.clamp(rollInput * maxRoll + autoBank, -maxRoll, maxRoll)
    this.roll += (targetRoll - this.roll) * ease

    // Increasing raw yaw swings the nose toward +X, which is the *left*
    // side (established convention: right = -X at yaw 0) - so a positive
    // (right-turn) yawInput has to *decrease* raw yaw. Same negation the
    // pedals needed in the original flight model.
    const targetYawRate = -yawInput * yawRate
    const yawEase = 1 - Math.exp(-YAW_RESPONSE * delta)
    this.yawRate += (targetYawRate - this.yawRate) * yawEase
    this.yaw += this.yawRate * delta

    this._euler.set(this.pitch, this.yaw, this.roll)
    this._quaternion.setFromEuler(this._euler)

    this._up.set(0, 1, 0).applyQuaternion(this._quaternion)
    this._thrust.copy(this._up).multiplyScalar(this.throttle * MAX_THRUST)

    this._force.copy(this._thrust)
    this._force.y -= MASS * GRAVITY
    this._force.addScaledVector(this.velocity, -(LINEAR_DRAG / effectiveSpeedMultiplier) * MASS)

    const acceleration = this._force.divideScalar(MASS)
    this.velocity.addScaledVector(acceleration, delta)
    this.position.addScaledVector(this.velocity, delta)

    this.groundImpactSpeed = constrainToAirspace(this.position, this.velocity, this._groundState)
    this.grounded = this._groundState.grounded

    this.helicopter.position.copy(this.position)
    this.helicopter.quaternion.copy(this._quaternion)
  }
}

export { AIRSPACE }
