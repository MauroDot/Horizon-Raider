import * as THREE from 'three'
import { getTerrainHeight } from './terrainHeight.js'

const DISTANCE = 14
const HEIGHT = 5
const LOOK_HEIGHT = 1.2
const GROUND_CLEARANCE = 2.5 // keeps the camera from clipping into sloped terrain behind the helicopter
// Local to the helicopter, just ahead of the nose (wedge nose tip ~z=2.4,
// gunner canopy front ~z=1.8) - close enough to read as "in the cockpit"
// without the camera clipping inside the fuselage/glass geometry.
const COCKPIT_OFFSET = new THREE.Vector3(0, 0.25, 2.7)
// A camera looks down its own local -Z, but the helicopter's nose is +Z
// (the established forward convention everywhere else: forward =
// (sin(yaw), 0, cos(yaw))). Copying the airframe's orientation onto the
// camera therefore aims it straight back down the tail boom - this half
// turn about Y is what makes 'cockpit' actually look out the front.
const CAMERA_FACES_NOSE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)

// Third-person chase camera (follows yaw, not pitch/roll, so the horizon
// stays level) or first-person cockpit view (rigidly locked to the
// helicopter's own orientation - no lag, to avoid a nauseating floaty
// first-person view), toggled by "cameraToggle". Chase-mode follow
// smoothing is driven by the cameraSmoothing setting (0 = snappy, 1 =
// lazy/floaty).
export class ChaseCamera {
  constructor(camera) {
    this.camera = camera
    this.mode = 'chase'
    this._desiredPos = new THREE.Vector3()
    this._desiredLook = new THREE.Vector3()
    this._currentLook = new THREE.Vector3()
    this._initialized = false
  }

  toggleMode() {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase'
    this._initialized = false // snap to the new mode's position instead of lerping across the map
  }

  update(delta, flightModel, cameraSmoothing = 0.5) {
    const { position, helicopter } = flightModel

    if (this.mode === 'cockpit') {
      this.camera.position.copy(position).add(COCKPIT_OFFSET.clone().applyQuaternion(helicopter.quaternion))
      this.camera.quaternion.copy(helicopter.quaternion).multiply(CAMERA_FACES_NOSE)
      this._initialized = false // stay un-lerped so re-toggling to chase doesn't inherit cockpit's tight follow
      return
    }

    const baseRadius = Math.hypot(DISTANCE, HEIGHT)
    const basePolar = Math.atan2(HEIGHT, DISTANCE)
    const azimuth = flightModel.yaw + Math.PI
    const horizontalDist = Math.cos(basePolar) * baseRadius
    const verticalDist = Math.sin(basePolar) * baseRadius

    this._desiredPos.set(
      position.x + Math.sin(azimuth) * horizontalDist,
      position.y + verticalDist,
      position.z + Math.cos(azimuth) * horizontalDist,
    )
    const groundLevel = getTerrainHeight(this._desiredPos.x, this._desiredPos.z)
    this._desiredPos.y = Math.max(this._desiredPos.y, groundLevel + GROUND_CLEARANCE)

    this._desiredLook.set(position.x, position.y + LOOK_HEIGHT, position.z)

    if (!this._initialized) {
      this.camera.position.copy(this._desiredPos)
      this._currentLook.copy(this._desiredLook)
      this._initialized = true
    } else {
      const sharpness = THREE.MathUtils.lerp(8, 1, cameraSmoothing)
      const t = 1 - Math.exp(-sharpness * delta)
      this.camera.position.lerp(this._desiredPos, t)
      this._currentLook.lerp(this._desiredLook, t)
    }

    this.camera.lookAt(this._currentLook)
  }
}
