import * as THREE from 'three'
import { createHelicopter } from './helicopter.js'
import { createTerrain } from './terrain.js'
import { createSky, SKY_BOTTOM_COLOR, SKY_DOME_RADIUS } from './sky.js'
import { InputManager } from './inputManager.js'
import { SimFlightModel } from './flightModel/simFlightModel.js'
import { ArcadeFlightModel } from './flightModel/arcadeFlightModel.js'
import { ChaseCamera } from './chaseCamera.js'
import { EnemyManager } from './enemies/EnemyManager.js'
import { EnemyWeaponSystem } from './enemies/EnemyWeaponSystem.js'
import { WeaponSystem } from './weapons/WeaponSystem.js'
import { getLoadout } from './loadouts.js'
import { getHelicopter, resolveWeaponUpgrades } from './helicopters.js'
import { BoosterController } from './boosterController.js'
import { EffectsManager } from './effects.js'
import { ScoreTracker } from './score.js'
import { PlayerHealth } from './playerHealth.js'
import { ObstacleField } from './obstacles/ObstacleField.js'
import { DayNightCycle } from './dayNightCycle.js'
import { EngineSound } from './audio/engineSound.js'
import { EscortNPC } from './escortNPC.js'
import { getDifficulty } from './campaign/difficulty.js'
import { generateWaypointRoute } from './campaign/missionWaypoints.js'
import { createObjectiveMarker } from './obstacles/models.js'
import { BossController } from './bossController.js'
import { BossHazards } from './bossHazards.js'
import { DestructibleCover } from './destructibleCover.js'
import { BossMusic } from './audio/bossMusic.js'
import { musicKeyForChapter } from './audio/audioManifest.js'

const FLARE_DURATION = 3
const FLARE_COOLDOWN = 8
const WAYPOINT_ARRIVAL_RADIUS = 25
const DETECTION_RADIUS = 55
const LOW_HEALTH_FRACTION = 0.3
const COVER_COUNT = 5
const COVER_RING_RADIUS = 35

const TELEGRAPH_WARNINGS = {
  barrage: '⚠ MISSILE BARRAGE INCOMING',
  charge: '⚠ BRACE FOR RAM ATTACK',
}

// The Titan's own phase-change flavor lines - regular bosses don't have
// enough phases for this to be worth a whole data-driven system.
const TITAN_PHASE_LINES = {
  1: 'Command, it just deployed ground support - defensive posture confirmed.',
  2: 'It\'s throwing everything it has left, Horizon Lead. This is the end of it.',
}

// Base ambient-roster sizes per mission type, before difficulty's
// enemyCountMultiplier is applied - 'destroy' scales off its own kill
// target instead (see buildEnemyManager below), the others are flat.
const AMBIENT_ROSTER = {
  escort: { heli: 4, vehicle: 3 },
  recon: { heli: 4, vehicle: 3 },
  survive: { heli: 6, vehicle: 4 },
}

function buildEnemyManager(scene, { runMode, mission, difficulty }) {
  if (runMode === 'freeplay') {
    return new EnemyManager(scene, { helicopterCount: 10, vehicleCount: 10, respawn: true })
  }

  const scale = (n) => Math.max(1, Math.round(n * difficulty.enemyCountMultiplier))
  const healthMultiplier = difficulty.enemyHealthMultiplier

  if (mission.type === 'destroy') {
    return new EnemyManager(scene, {
      helicopterCount: scale(Math.max(4, Math.round(mission.targetKills * 0.6))),
      vehicleCount: scale(Math.max(3, Math.round(mission.targetKills * 0.4))),
      healthMultiplier,
    })
  }
  if (mission.type === 'survive') {
    const base = AMBIENT_ROSTER.survive
    return new EnemyManager(scene, {
      helicopterCount: scale(base.heli),
      vehicleCount: scale(base.vehicle),
      healthMultiplier,
      respawn: true,
    })
  }
  if (mission.type === 'recon') {
    const base = AMBIENT_ROSTER.recon
    return new EnemyManager(scene, {
      helicopterCount: scale(base.heli),
      vehicleCount: scale(base.vehicle),
      healthMultiplier,
      patrolMode: true,
    })
  }
  if (mission.type === 'escort') {
    const base = AMBIENT_ROSTER.escort
    return new EnemyManager(scene, {
      helicopterCount: scale(base.heli),
      vehicleCount: scale(base.vehicle),
      healthMultiplier,
    })
  }
  // boss: just the reinforcement escort count around the boss itself,
  // which is spawned separately via spawnBoss() - see below.
  return new EnemyManager(scene, {
    helicopterCount: scale(mission.escortCount ?? 3),
    vehicleCount: 0,
    healthMultiplier,
  })
}

// Sets up the Three.js scene, mounts the renderer into `container`, and
// starts the render loop. Returns `{ dispose }`.
//
// `controlConfig` (ControlConfig, see controlConfig.js) picks the flight
// model - Realistic Simulation vs Arcade FPS-style - for this game
// instance's whole lifetime; changing scheme mid-session goes through a
// full restart (App.jsx's startGame) rather than hot-swapping physics
// models, which would need transplanting position/velocity between two
// different force models for no real player benefit.
//
// `gamepadManager` is shared/persistent (survives restarts) like
// `controlConfig`. `hudRef`/`pausedRef`/`onPauseToggle` behave as before.
//
// `runMode` is 'freeplay' (unlimited respawning hostiles, no objective) or
// 'mission' (`mission` from campaign/missions.js drives real, distinct
// mechanics per its `type` - see MISSION TYPES below). `onRunEnd(stats)`
// fires exactly once per run with `stats.outcome` one of 'died' (player
// destroyed - always wins if another condition triggers the same frame),
// 'missionComplete' (primary objective met), 'escortLost' (escort mission:
// the NPC was destroyed), or 'detected' (recon mission: a patrol enemy
// spotted the player). `stats.secondaryComplete` reports whether the
// mission's optional bonus objective (see missions.js) was also met - only
// meaningful when `outcome === 'missionComplete'`.
//
// MISSION TYPES:
//   destroy - score.kills reaches mission.targetKills (unchanged from before)
//   survive - a countdown timer (mission.surviveSeconds) against a
//             continuously-respawning roster, like Free Play but timed
//   escort  - an EscortNPC autopilots mission.waypointCount waypoints;
//             enemies can target it (see EnemyWeaponSystem's `targets`);
//             success on arrival, 'escortLost' if it dies first
//   recon   - the player must fly within WAYPOINT_ARRIVAL_RADIUS of
//             mission.waypointCount waypoints in order; the ambient roster
//             spawns in "patrol" mode (see EnemyManager) and getting within
//             DETECTION_RADIUS of one instantly ends the mission as
//             'detected'
//   boss    - EnemyManager.spawnBoss() creates one named, heavily-buffed
//             unique enemy (plus a small reinforcement roster); success
//             when it's destroyed
//
// `helicopterColor`/`helicopterId`/`loadout`/`level`/`boosterCharges` are
// the resolved customization/progression inputs (see helicopters.js,
// loadouts.js, helicopters.js's resolveWeaponUpgrades) - unrelated to
// mission type, applied the same way regardless.
export function initGame(
  container,
  {
    hudRef,
    onRunEnd,
    controlConfig,
    gamepadManager,
    audioManager,
    pausedRef,
    onPauseToggle,
    runMode = 'freeplay',
    mission = null,
    difficultyId = 'normal',
    helicopterColor,
    helicopterId,
    loadout,
    level = 1,
    boosterCharges,
    onBoosterUse,
  } = {},
) {
  const heli = getHelicopter(helicopterId)
  const loadoutDef = getLoadout(loadout)
  const weaponUpgrades = resolveWeaponUpgrades(level)
  const difficulty = getDifficulty(difficultyId)
  const scene = new THREE.Scene()

  // Background music pick: Free Play gets its own action theme, a mission
  // plays its chapter's theme (varies by chapter - see musicKeyForChapter),
  // and a boss mission overrides that with the dedicated boss theme (The
  // Titan gets its own distinct one). playMusic() no-ops if this is already
  // the current track (e.g. Retry), so replaying doesn't restart it from
  // the top, and does nothing at all if the file isn't there yet (see
  // audioManifest.js) - Free Play/Campaign are unaffected either way.
  if (mission?.type === 'boss') {
    audioManager?.playMusic(mission.finalBoss ? 'boss-final' : 'boss')
    audioManager?.setMusicIntensity(0) // reset in case a *previous* attempt at this same boss left it raised
  } else if (mission) {
    audioManager?.playMusic(musicKeyForChapter(mission.chapterId))
  } else {
    audioManager?.playMusic('freeplay')
  }

  const sky = createSky()
  scene.add(sky.mesh, sky.stars, sky.celestial)
  scene.fog = new THREE.Fog(SKY_BOTTOM_COLOR, 200, 1600)

  const dayNight = new DayNightCycle()

  const terrain = createTerrain()
  scene.add(terrain)

  const obstacleField = new ObstacleField(scene)

  const hemiLight = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f1e, 0.9)
  scene.add(hemiLight)

  const sunLight = new THREE.DirectionalLight(0xfff2d6, 1.4)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(1024, 1024)
  sunLight.shadow.camera.left = -60
  sunLight.shadow.camera.right = 60
  sunLight.shadow.camera.top = 60
  sunLight.shadow.camera.bottom = -60
  sunLight.shadow.camera.far = 400
  scene.add(sunLight)
  scene.add(sunLight.target)

  const helicopter = createHelicopter({
    bodyColor: helicopterColor,
    accentColor: heli.style.accentColor,
    scale: heli.style.scale,
    plating: heli.style.plating,
    stealth: heli.style.stealth,
  })
  scene.add(helicopter)

  const scheme = controlConfig.scheme
  const FlightModelClass = scheme === 'arcade' ? ArcadeFlightModel : SimFlightModel
  const flightModel = new FlightModelClass(helicopter, {
    position: new THREE.Vector3(0, 30, 0),
    speedMultiplier: heli.speedMultiplier * loadoutDef.speedMultiplier,
    agilityMultiplier: heli.agilityMultiplier,
  })

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 6000)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  const input = new InputManager(renderer.domElement, controlConfig, gamepadManager)
  const chaseCamera = new ChaseCamera(camera)

  const engineSound = new EngineSound(audioManager)
  const startAudio = () => {
    engineSound.start()
    window.removeEventListener('keydown', startAudio)
    renderer.domElement.removeEventListener('mousedown', startAudio)
  }
  window.addEventListener('keydown', startAudio)
  renderer.domElement.addEventListener('mousedown', startAudio)

  const effects = new EffectsManager(scene, audioManager)
  const score = new ScoreTracker()
  const enemyManager = buildEnemyManager(scene, { runMode, mission, difficulty })

  // --- Mission-type-specific setup ---
  let bossEnemy = null
  let bossController = null
  let bossHazards = null
  let bossMusic = null
  let destructibleCover = null
  let escortNPC = null
  let reconWaypoints = null
  let reconIndex = 0
  let reconDetected = false
  let surviveRemaining = 0
  const waypointMarkers = []

  function addWaypointMarkers(points) {
    for (const p of points) {
      const marker = createObjectiveMarker({ height: 16 })
      marker.position.set(p.x, 0, p.z)
      scene.add(marker)
      waypointMarkers.push(marker)
    }
  }

  if (mission?.type === 'boss') {
    bossEnemy = enemyManager.spawnBoss({
      variant: mission.bossVariant,
      healthMultiplier: mission.bossHealthMultiplier,
      glowColor: mission.bossColor,
    })

    const coverPoints = Array.from({ length: COVER_COUNT }, (_, i) => {
      const angle = (Math.PI * 2 * i) / COVER_COUNT
      return {
        x: bossEnemy.mesh.position.x + Math.sin(angle) * COVER_RING_RADIUS,
        z: bossEnemy.mesh.position.z + Math.cos(angle) * COVER_RING_RADIUS,
      }
    })
    destructibleCover = new DestructibleCover(scene, coverPoints)

    bossHazards = new BossHazards(scene, effects, {
      onExplosion: (pos) => destructibleCover.notifyExplosion(pos),
    })

    bossMusic = new BossMusic(audioManager)
    bossMusic.playStinger()
    bossMusic.startDrone()

    const bossMaxPhase = mission.finalBoss ? 2 : 1
    bossController = new BossController(bossEnemy, {
      scene,
      effects,
      enemyManager,
      finalBoss: !!mission.finalBoss,
      onTelegraph: (attack) => hudRef?.current?.showWarning?.(TELEGRAPH_WARNINGS[attack] ?? '⚠ INCOMING ATTACK'),
      onExplosion: (pos) => destructibleCover.notifyExplosion(pos),
      onPhaseChange: (phase) => {
        audioManager?.setMusicIntensity(phase / bossMaxPhase)
        const line = mission.finalBoss ? TITAN_PHASE_LINES[phase] : null
        if (line) hudRef?.current?.showComm?.(line)
      },
    })
  } else if (mission?.type === 'escort') {
    const waypoints = generateWaypointRoute(mission.id, mission.waypointCount)
    escortNPC = new EscortNPC(scene, { waypoints })
    addWaypointMarkers(waypoints)
  } else if (mission?.type === 'recon') {
    reconWaypoints = generateWaypointRoute(mission.id, mission.waypointCount)
    addWaypointMarkers(reconWaypoints)
  } else if (mission?.type === 'survive') {
    surviveRemaining = mission.surviveSeconds
  }

  const weapons = new WeaponSystem({
    scene,
    helicopter,
    effects,
    enemyManager,
    score,
    audioManager,
    onImpact: (strength) => gamepadManager?.rumble(strength, 80),
    onExplosion: (pos) => destructibleCover?.notifyExplosion(pos),
    missileCapacity: Math.max(2, loadoutDef.missileCapacity + weaponUpgrades.ammoBonus),
    damageMultiplier: heli.firepowerMultiplier,
    missileDamageMultiplier: weaponUpgrades.missileDamageMultiplier,
    reloadSpeedMultiplier: weaponUpgrades.reloadSpeedMultiplier,
  })
  const boosters = new BoosterController(boosterCharges, onBoosterUse)

  const playerHealth = new PlayerHealth(100 * heli.armorMultiplier * loadoutDef.armorMultiplier)
  const flareState = { active: false }

  const weaponTargets = [
    {
      id: 'player',
      mesh: helicopter,
      health: playerHealth,
      hitRadius: 2,
      flareStateRef: flareState,
      // Boss attacks/hazards check this (see bossController.js/bossHazards.js)
      // to reduce damage while standing near intact destructible cover -
      // not read by anything else (regular enemy fire ignores it).
      damageReduction: () => destructibleCover?.damageReductionAt(flightModel.position) ?? 0,
      onHit: (damage) => {
        hudRef?.current?.flashDamage?.()
        gamepadManager?.rumble(THREE.MathUtils.clamp(damage / 20, 0.3, 1), 200)
      },
    },
  ]
  const playerTarget = weaponTargets[0]
  if (escortNPC) {
    weaponTargets.push({ id: 'escort', mesh: escortNPC.mesh, health: escortNPC.health, hitRadius: escortNPC.hitRadius })
  }

  const enemyWeapons = new EnemyWeaponSystem({
    scene,
    effects,
    enemyManager,
    targets: weaponTargets,
    accuracy: difficulty.enemyAccuracy,
  })
  let gameOverTriggered = false
  const celestialDir = new THREE.Vector3()
  const SUN_DISTANCE = 300

  // Crash detection: a gentle touchdown or a graze off a wall shouldn't
  // hurt, but hitting the ground or an obstacle above these speeds does.
  const CRASH_GROUND_SPEED = 11
  const CRASH_OBSTACLE_SPEED = 9
  const CRASH_COOLDOWN_SECONDS = 1.2
  let crashCooldown = 0
  function applyCrash(impactSpeed, threshold) {
    if (crashCooldown > 0) return
    crashCooldown = CRASH_COOLDOWN_SECONDS
    const damage = THREE.MathUtils.clamp(30 + (impactSpeed - threshold) * 5, 30, 100)
    playerHealth.takeDamage(damage)
    effects.addExplosion(flightModel.position.clone(), { scale: 1.1 })
    hudRef?.current?.flashDamage?.()
    gamepadManager?.rumble(1, 300)
  }

  let flareTimer = 0
  let flareCooldown = 0
  let selectedWeapon = 'gun' // cosmetic only (see WeaponSystem docs) - both weapons stay independently fireable

  const BASE_FOV = 55
  const MAX_FOV_BOOST = 12
  const FOV_SPEED_REFERENCE = 45

  let radarVisible = true

  // Wall-clock seconds actually spent playing (unpaused ticks only) this
  // run - reported alongside score.snapshot() in onRunEnd so persistentStore
  // can accumulate lifetime playtime for the save-file stats, and used by
  // the 'timeLimit' secondary objective / mission grading.
  let playtimeSeconds = 0

  // Secondary-objective tracking signals. `tookDamage` is set from a single
  // per-tick health comparison (below) rather than hooking every damage
  // call site, so it stays correct automatically as damage sources change -
  // and a Shield Boost absorbing a hit correctly does NOT count as damage,
  // since playerHealth.health never actually drops while invulnerable.
  let tookDamage = false
  let lastHealth = playerHealth.health

  // Radio callout one-shot flags (see missions.js's `radio`).
  let firedStart = false
  let firedMidway = false
  let firedLowHealth = false
  function fireRadio(trigger) {
    const line = mission?.radio?.find((r) => r.trigger === trigger)
    if (line) hudRef?.current?.showComm?.(line.text)
  }

  // 0..1 "how close to primary-objective done" per mission type, used only
  // to fire the 'midway' radio callout once.
  function missionProgressFraction() {
    if (!mission) return 0
    switch (mission.type) {
      case 'destroy':
        return score.kills / mission.targetKills
      case 'survive':
        return 1 - surviveRemaining / mission.surviveSeconds
      case 'escort':
        return escortNPC.currentIndex / escortNPC.waypoints.length
      case 'recon':
        return reconIndex / reconWaypoints.length
      case 'boss':
        return bossEnemy ? 1 - bossEnemy.health / bossEnemy.maxHealth : 0
      default:
        return 0
    }
  }

  const clock = new THREE.Clock()
  let rafId

  function tick() {
    rafId = requestAnimationFrame(tick)
    const delta = Math.min(clock.getDelta(), 0.1)

    const frameInput = input.poll(delta)
    if (frameInput.pressed.pause) onPauseToggle?.()

    if (pausedRef?.current) {
      engineSound.setMuted(true)
      renderer.render(scene, camera)
      return
    }
    engineSound.setMuted(false)
    engineSound.update({ throttleFraction: flightModel.throttleFraction, speed: flightModel.speed })
    playtimeSeconds += delta

    if (!firedStart) {
      firedStart = true
      fireRadio('start')
    }

    crashCooldown = Math.max(0, crashCooldown - delta)
    flareTimer = Math.max(0, flareTimer - delta)
    flareCooldown = Math.max(0, flareCooldown - delta)
    flareState.active = flareTimer > 0

    if (playerHealth.alive) {
      boosters.update(delta)
      if (frameInput.pressed.boosterSlot1) boosters.activate('shield')
      if (frameInput.pressed.boosterSlot2) boosters.activate('speed')
      if (frameInput.pressed.boosterSlot3) boosters.activate('weapon')
      // Live multipliers, re-applied every tick from whatever's currently
      // active - simpler than push events, and self-correcting if a boost
      // expires mid-frame.
      flightModel.boostMultiplier = boosters.speedMultiplier
      weapons.boostFireRateMultiplier = boosters.weaponFireRateMultiplier
      weapons.boostDamageMultiplier = boosters.weaponDamageMultiplier
      playerHealth.invulnerable = boosters.shieldActive

      flightModel.update(delta, { ...frameInput, settings: controlConfig.settings })
      const obstacleImpactSpeed = obstacleField.resolvePlayerCollision(flightModel)

      weapons.update(delta, {
        firingGun: frameInput.actions.firePrimary,
        firingMissile: frameInput.actions.fireSecondary,
      })
      if (frameInput.pressed.reload) weapons.missileAmmo = weapons.missileCapacity
      if (frameInput.pressed.cycleWeapon) selectedWeapon = selectedWeapon === 'gun' ? 'missile' : 'gun'
      if (frameInput.pressed.cameraToggle) chaseCamera.toggleMode()
      if (frameInput.pressed.radarToggle) radarVisible = !radarVisible
      if (frameInput.pressed.flares && flareCooldown <= 0) {
        flareTimer = FLARE_DURATION
        flareCooldown = FLARE_COOLDOWN
        const backward = new THREE.Vector3(0, 0, -1).applyQuaternion(helicopter.quaternion)
        effects.addFlareBurst(flightModel.position.clone(), backward)
      }

      if (flightModel.groundImpactSpeed > CRASH_GROUND_SPEED) {
        applyCrash(flightModel.groundImpactSpeed, CRASH_GROUND_SPEED)
      } else if (obstacleImpactSpeed > CRASH_OBSTACLE_SPEED) {
        applyCrash(obstacleImpactSpeed, CRASH_OBSTACLE_SPEED)
      }

      const rotorSpin = 8 + flightModel.throttleFraction * 10
      helicopter.userData.mainRotor.rotation.y += delta * rotorSpin
      helicopter.userData.tailRotor.rotation.x += delta * rotorSpin * 1.6

      // Mission-type live progress.
      if (mission?.type === 'survive') {
        surviveRemaining = Math.max(0, surviveRemaining - delta)
      } else if (mission?.type === 'recon') {
        if (reconIndex < reconWaypoints.length) {
          const wp = reconWaypoints[reconIndex]
          const dist = Math.hypot(flightModel.position.x - wp.x, flightModel.position.z - wp.z)
          if (dist <= WAYPOINT_ARRIVAL_RADIUS) {
            waypointMarkers[reconIndex].visible = false
            reconIndex++
          }
        }
        if (!reconDetected && enemyManager.checkDetection(flightModel.position, DETECTION_RADIUS)) {
          reconDetected = true
        }
      } else if (mission?.type === 'boss') {
        bossController.update(delta, playerTarget)
        bossHazards.update(delta, playerTarget)
      }
    }
    chaseCamera.update(delta, flightModel, controlConfig.settings.cameraSmoothing)

    const fovBoost = MAX_FOV_BOOST * THREE.MathUtils.clamp(flightModel.speed / FOV_SPEED_REFERENCE, 0, 1)
    const targetFov = BASE_FOV + fovBoost
    if (chaseCamera.mode === 'chase' && Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, delta * 3)
      camera.updateProjectionMatrix()
    } else if (chaseCamera.mode === 'cockpit' && camera.fov !== BASE_FOV) {
      camera.fov = BASE_FOV
      camera.updateProjectionMatrix()
    }

    enemyManager.update(delta, flightModel.position)
    enemyWeapons.update(delta)
    obstacleField.update(delta, flightModel.position)
    if (escortNPC) {
      escortNPC.update(delta)
      if (escortNPC.currentIndex > 0 && waypointMarkers[escortNPC.currentIndex - 1]) {
        waypointMarkers[escortNPC.currentIndex - 1].visible = false
      }
    }
    for (const marker of waypointMarkers) {
      if (marker.visible && marker.userData.ring) marker.userData.ring.rotation.z += delta * 0.6
    }
    effects.update(delta)

    if (playerHealth.health < lastHealth) tookDamage = true
    lastHealth = playerHealth.health
    if (!firedLowHealth && playerHealth.fraction <= LOW_HEALTH_FRACTION && playerHealth.alive) {
      firedLowHealth = true
      fireRadio('lowHealth')
    }
    if (!firedMidway && missionProgressFraction() >= 0.5) {
      firedMidway = true
      fireRadio('midway')
    }

    dayNight.update(delta)
    sky.uniforms.topColor.value.copy(dayNight.skyTop)
    sky.uniforms.bottomColor.value.copy(dayNight.skyBottom)
    scene.fog.color.copy(dayNight.fogColor)
    sunLight.color.copy(dayNight.sunColor)
    sunLight.intensity = dayNight.sunIntensity
    hemiLight.color.copy(dayNight.hemiSky)
    hemiLight.groundColor.copy(dayNight.hemiGround)
    hemiLight.intensity = dayNight.hemiIntensity

    sky.mesh.position.copy(flightModel.position)
    sky.stars.position.copy(flightModel.position)
    sky.stars.material.opacity = dayNight.starsOpacity
    celestialDir.copy(dayNight.sunDirection)
    if (dayNight.isNight) celestialDir.multiplyScalar(-1)
    sky.celestial.position.copy(flightModel.position).addScaledVector(celestialDir, SKY_DOME_RADIUS * 0.9)
    sky.celestial.material.color.set(dayNight.isNight ? 0xcfd6e6 : 0xfff6d8)
    sky.celestial.scale.setScalar(dayNight.isNight ? 40 : 60)

    sunLight.target.position.copy(flightModel.position)
    sunLight.position.copy(flightModel.position).addScaledVector(dayNight.sunDirection, SUN_DISTANCE)

    if (!gameOverTriggered) {
      const finish = (outcome) => {
        gameOverTriggered = true
        const success = outcome === 'missionComplete'
        if (success) fireRadio('complete')
        const secondaryComplete = success ? computeSecondaryComplete() : false
        onRunEnd?.({
          ...score.snapshot(),
          playtimeSeconds,
          outcome,
          missionId: mission?.id ?? null,
          secondaryComplete,
          healthFraction: playerHealth.fraction,
        })
      }

      function computeSecondaryComplete() {
        const obj = mission?.secondaryObjective
        if (!obj) return false
        if (obj.type === 'noDamage') return !tookDamage
        if (obj.type === 'timeLimit') return playtimeSeconds <= obj.seconds
        if (obj.type === 'bonusKills') return score.kills >= (mission.targetKills ?? 0) + obj.amount
        if (obj.type === 'escortHealth') return escortNPC ? escortNPC.health.fraction >= obj.fraction : false
        return false
      }

      if (!playerHealth.alive) {
        effects.addExplosion(helicopter.position.clone(), { scale: 1.6 })
        helicopter.visible = false
        finish('died')
      } else if (mission?.type === 'destroy' && score.kills >= mission.targetKills) {
        finish('missionComplete')
      } else if (mission?.type === 'survive' && surviveRemaining <= 0) {
        finish('missionComplete')
      } else if (mission?.type === 'boss' && bossEnemy && !bossEnemy.alive) {
        finish('missionComplete')
      } else if (mission?.type === 'escort') {
        if (!escortNPC.health.alive) finish('escortLost')
        else if (escortNPC.arrived) finish('missionComplete')
      } else if (mission?.type === 'recon') {
        if (reconDetected) finish('detected')
        else if (reconIndex >= reconWaypoints.length) finish('missionComplete')
      }
    }

    hudRef?.current?.update({
      speed: flightModel.speed,
      altitude: flightModel.altitude,
      throttleFraction: flightModel.throttleFraction,
      scheme,
      heading: flightModel.headingDegrees,
      yaw: flightModel.yaw,
      grounded: flightModel.grounded,
      pointerLocked: frameInput.pointerLocked,
      inputMethod: frameInput.inputMethod,
      gamepadConnected: frameInput.gamepadConnected,
      cameraMode: chaseCamera.mode,
      radarVisible,
      flareActive: flareState.active,
      flareReady: flareCooldown <= 0,
      selectedWeapon,
      missileAmmo: weapons.missileAmmo,
      missileAmmoMax: weapons.missileCapacity,
      hostiles: enemyManager.getAliveEnemies().length,
      health: playerHealth.health,
      healthFraction: playerHealth.fraction,
      clockLabel: dayNight.clockLabel,
      playerX: flightModel.position.x,
      playerZ: flightModel.position.z,
      enemies: enemyManager.getAliveEnemies().map((e) => ({
        x: e.mesh.position.x,
        z: e.mesh.position.z,
        type: e.type,
      })),
      objectives: [
        ...obstacleField.getObjectives(),
        ...(reconWaypoints
          ?.map((p, i) => (i >= reconIndex ? { x: p.x, z: p.z, name: `Waypoint ${i + 1}` } : null))
          .filter(Boolean) ?? []),
        ...(escortNPC ? [{ x: escortNPC.position.x, z: escortNPC.position.z, name: 'Escort' }] : []),
      ],
      mission,
      missionProgress: mission
        ? {
            type: mission.type,
            kills: score.kills,
            targetKills: mission.targetKills,
            surviveRemaining,
            surviveTotal: mission.surviveSeconds,
            escortIndex: escortNPC?.currentIndex,
            escortTotal: escortNPC?.waypoints.length,
            escortHealthFraction: escortNPC?.health.fraction,
            reconIndex,
            reconTotal: reconWaypoints?.length,
            detected: reconDetected,
            bossName: mission.bossName,
            bossHealthFraction: bossEnemy ? Math.max(0, bossEnemy.health / bossEnemy.maxHealth) : null,
            bossPhase: bossController?.phase ?? 0,
            bossMaxPhase: mission.finalBoss ? 2 : 1,
            bossTelegraphing: bossController?.snapshot().telegraphing ?? false,
          }
        : null,
      boosters: boosters.snapshot(),
      ...score.snapshot(),
    })

    renderer.render(scene, camera)
  }
  tick()

  function handleResize() {
    const { clientWidth, clientHeight } = container
    if (clientWidth === 0 || clientHeight === 0) return
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(clientWidth, clientHeight)
  }
  window.addEventListener('resize', handleResize)

  function dispose() {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('keydown', startAudio)
    renderer.domElement.removeEventListener('mousedown', startAudio)
    engineSound.dispose()
    input.dispose()
    weapons.dispose()
    enemyWeapons.dispose()
    effects.dispose()
    enemyManager.dispose()
    obstacleField.dispose()
    escortNPC?.dispose()
    bossController?.dispose()
    bossHazards?.dispose()
    destructibleCover?.dispose()
    bossMusic?.dispose()

    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach((m) => m.dispose())
      }
    })

    renderer.dispose()
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement)
    }
  }

  return { dispose }
}
