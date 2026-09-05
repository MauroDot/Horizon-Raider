import * as THREE from 'three'
import { getTerrainHeight } from '../terrainHeight.js'
import { AIRSPACE, constrainToAirspace } from './airspace.js'

const MAX_SPEED = 42 // m/s, forward/back and strafe top speed
const MAX_CLIMB_SPEED = 16
const ACCEL_RESPONSE = 2.2 // how fast velocity eases toward target - the whole momentum/drag feel
const VERTICAL_RESPONSE = 2.6

const YAW_MAX_RATE = THREE.MathUtils.degToRad(110)
const YAW_RESPONSE = 4.5
const MOUSE_YAW_FULL_SPEED_PXPS = 600

const VISUAL_PITCH_MAX = THREE.MathUtils.degToRad(24) // cosmetic nose-tilt "look", not a physics input
const VISUAL_ROLL_MAX = THREE.MathUtils.degToRad(22) // cosmetic bank-into-turn
const VISUAL_RESPONSE = 3.5

// Arcade FPS-style flight model: W/S and A/D translate directly along
// forward and strafe (no attitude physics), Shift/Ctrl move straight up
// or down, and the mouse (or gamepad right stick) directly steers the
// nose - yaw turns the body, mouse-Y sets a cosmetic look-pitch. Every
// target is eased toward exponentially (momentum), never snapped.
export class ArcadeFlightModel {
  // Same `speedMultiplier`/`agilityMultiplier`/mutable `boostMultiplier`
  // contract as SimFlightModel - see its constructor doc.
  constructor(helicopter, { position = new THREE.Vector3(0, 40, 0), speedMultiplier = 1, agilityMultiplier = 1 } = {}) {
    this.helicopter = helicopter
    this.position = position.clone()
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.yawRate = 0
    this.visualPitch = 0
    this.visualRoll = 0
    this.speedMultiplier = speedMultiplier
    this.agilityMultiplier = agilityMultiplier
    this.boostMultiplier = 1
    // See SimFlightModel's equivalent - per-frame input breakdown for
    // window.__flightDebug, written in place (no per-frame allocation).
    this.debugInputs = { kbYaw: 0, mouseYaw: 0, stickYaw: 0, yawInput: 0, forwardInput: 0, strafeInput: 0, verticalInput: 0 }
    this._groundState = { grounded: false }
    this.grounded = false
    this.groundImpactSpeed = 0

    this._quaternion = new THREE.Quaternion()
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ')
    this._forward = new THREE.Vector3()
    this._right = new THREE.Vector3()

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

  // Arcade has no collective/throttle concept - always at full power. Kept
  // as a getter (rather than removing the field everywhere it's read) so
  // the HUD/engine-sound code doesn't need scheme-specific branches.
  get throttleFraction() {
    return 1
  }

  update(delta, input) {
    const { actions, pad, mouseDX, mouseDY, settings } = input
    const invert = settings.invertY ? -1 : 1
    const mouseSens = 0.4 + settings.mouseSensitivity * 1.6

    let mouseDXShaped = mouseDX
    let mouseDYShaped = mouseDY
    if (settings.mouseAcceleration) {
      mouseDXShaped = Math.sign(mouseDX) * Math.pow(Math.abs(mouseDX), 1.3)
      mouseDYShaped = Math.sign(mouseDY) * Math.pow(Math.abs(mouseDY), 1.3)
    }

    const forwardInput = (actions.moveForward ? 1 : 0) - (actions.moveBackward ? 1 : 0)
    const strafeInput = (actions.strafeRight ? 1 : 0) - (actions.strafeLeft ? 1 : 0)
    const verticalInput = (actions.altitudeUp ? 1 : 0) - (actions.altitudeDown ? 1 : 0)

    const mouseYawSpeed = delta > 0 ? (mouseDXShaped / delta / MOUSE_YAW_FULL_SPEED_PXPS) * mouseSens : 0
    const mouseLookSpeed = delta > 0 ? (mouseDYShaped / delta / MOUSE_YAW_FULL_SPEED_PXPS) * mouseSens * invert : 0
    const stickYaw = pad?.rightX ?? 0
    const stickLook = -(pad?.rightY ?? 0) * invert

    const yawInput = THREE.MathUtils.clamp(mouseYawSpeed + stickYaw, -1, 1)
    const lookInput = THREE.MathUtils.clamp(mouseLookSpeed + stickLook, -1, 1)

    const dbg = this.debugInputs
    dbg.kbYaw = 0 // arcade has no keyboard yaw binding - the mouse/stick steer
    dbg.mouseYaw = mouseYawSpeed
    dbg.stickYaw = stickYaw
    dbg.yawInput = yawInput
    dbg.forwardInput = forwardInput
    dbg.strafeInput = strafeInput
    dbg.verticalInput = verticalInput

    const yawMaxRate = YAW_MAX_RATE * this.agilityMultiplier
    const effectiveSpeedMultiplier = this.speedMultiplier * this.boostMultiplier
    const maxSpeed = MAX_SPEED * effectiveSpeedMultiplier
    const maxClimbSpeed = MAX_CLIMB_SPEED * effectiveSpeedMultiplier

    // Yaw rate eases toward its target - momentum on the rotation itself,
    // not just the translation, so mouse flicks swing the nose smoothly.
    // Increasing raw yaw swings the nose toward +X, which is the *left*
    // side (established convention: right = -X at yaw 0) - so turning
    // right (positive yawInput) has to *decrease* raw yaw.
    const targetYawRate = -yawInput * yawMaxRate
    const yawEase = 1 - Math.exp(-YAW_RESPONSE * delta)
    this.yawRate += (targetYawRate - this.yawRate) * yawEase
    this.yaw += this.yawRate * delta

    this._forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    this._right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw))

    const horizEase = 1 - Math.exp(-ACCEL_RESPONSE * delta)
    const targetForwardSpeed = forwardInput * maxSpeed
    const currentForwardSpeed = this.velocity.dot(this._forward)
    const forwardDelta = (targetForwardSpeed - currentForwardSpeed) * horizEase
    this.velocity.addScaledVector(this._forward, forwardDelta)

    const targetStrafeSpeed = strafeInput * maxSpeed
    const currentStrafeSpeed = this.velocity.dot(this._right)
    const strafeDelta = (targetStrafeSpeed - currentStrafeSpeed) * horizEase
    this.velocity.addScaledVector(this._right, strafeDelta)

    const targetClimbSpeed = verticalInput * maxClimbSpeed
    const vertEase = 1 - Math.exp(-VERTICAL_RESPONSE * delta)
    this.velocity.y += (targetClimbSpeed - this.velocity.y) * vertEase

    this.position.addScaledVector(this.velocity, delta)

    // Cosmetic attitude: nose follows the look input, banks into turns.
    const targetPitch = lookInput * VISUAL_PITCH_MAX
    const targetRoll = THREE.MathUtils.clamp(-this.yawRate / yawMaxRate, -1, 1) * VISUAL_ROLL_MAX
    const visualEase = 1 - Math.exp(-VISUAL_RESPONSE * delta)
    this.visualPitch += (targetPitch - this.visualPitch) * visualEase
    this.visualRoll += (targetRoll - this.visualRoll) * visualEase
    this._euler.set(this.visualPitch, this.yaw, this.visualRoll)
    this._quaternion.setFromEuler(this._euler)

    this.groundImpactSpeed = constrainToAirspace(this.position, this.velocity, this._groundState)
    this.grounded = this._groundState.grounded

    this.helicopter.position.copy(this.position)
    this.helicopter.quaternion.copy(this._quaternion)
  }
}

export { AIRSPACE }
