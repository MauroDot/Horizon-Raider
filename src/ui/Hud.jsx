import { useEffect, useRef, useState } from 'react'
import { describeBinding } from '../game/controlConfig.js'
import './Hud.css'

const clampPercent = (value) => Math.max(0, Math.min(100, value))

function buildControlHints(controlConfig) {
  const b = (id) => describeBinding(controlConfig.getBinding(id))
  const boosterHints = [
    `${b('boosterSlot1')} shield boost`,
    `${b('boosterSlot2')} speed burst`,
    `${b('boosterSlot3')} weapon boost`,
  ]
  if (controlConfig.scheme === 'sim') {
    return [
      `${b('pitchDown')}/${b('pitchUp')} pitch`,
      `${b('yawLeft')}/${b('yawRight')} yaw`,
      `${b('rollLeft')}/${b('rollRight')} roll`,
      `${b('throttleUp')}/${b('throttleDown')} collective`,
      'Mouse aim',
      `${b('firePrimary')} gun`,
      `${b('fireSecondary')} missile`,
      `${b('reload')} reload`,
      `${b('flares')} flares`,
      `${b('cameraToggle')} camera`,
      `${b('radarToggle')} map`,
      `${b('pause')} pause`,
      ...boosterHints,
    ]
  }
  return [
    `${b('moveForward')}/${b('moveBackward')} move`,
    `${b('strafeLeft')}/${b('strafeRight')} strafe`,
    `${b('altitudeUp')}/${b('altitudeDown')} vertical`,
    'Mouse steer',
    `${b('firePrimary')} gun`,
    `${b('fireSecondary')} missiles`,
    `${b('reload')} reload`,
    `${b('flares')} flares`,
    `${b('cameraToggle')} camera`,
    `${b('radarToggle')} map`,
    `${b('pause')} pause`,
    ...boosterHints,
  ]
}

function buildBoosterKeys(controlConfig) {
  return {
    shield: describeBinding(controlConfig.getBinding('boosterSlot1')),
    speed: describeBinding(controlConfig.getBinding('boosterSlot2')),
    weapon: describeBinding(controlConfig.getBinding('boosterSlot3')),
  }
}

// Turns createScene.js's per-type `missionProgress` payload into a single
// label/value pair for the one-line objective readout - each mission type
// tracks completely different state (kill count, a timer, waypoint index,
// boss health...) so this is the one place that knows how to summarize any
// of them the same way.
function formatObjective(mission, progress) {
  if (!mission || !progress) return null
  switch (progress.type) {
    case 'destroy':
      return { label: 'DESTROY HOSTILES', value: `${progress.kills}/${progress.targetKills}` }
    case 'survive': {
      const remaining = Math.max(0, Math.ceil(progress.surviveRemaining))
      return { label: 'SURVIVE', value: `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` }
    }
    case 'escort':
      return {
        label: 'ESCORT',
        value: `WP ${progress.escortIndex}/${progress.escortTotal} · HULL ${Math.round((progress.escortHealthFraction ?? 0) * 100)}%`,
      }
    case 'recon':
      return { label: progress.detected ? 'DETECTED' : 'RECON SWEEP', value: `${progress.reconIndex}/${progress.reconTotal}`, alert: progress.detected }
    case 'boss':
      // No one-line readout here - the dedicated hud-boss-bar (see below)
      // covers name/health/phase far more prominently for boss fights.
      return null
    default:
      return null
  }
}

const MINIMAP_SIZE = 170
const MINIMAP_RANGE = 550
const MINIMAP_BG = 'rgba(8, 16, 14, 0.55)'
const MINIMAP_RING = 'rgba(120, 255, 200, 0.16)'
const MINIMAP_BORDER = 'rgba(120, 255, 200, 0.35)'

// World +Z maps to "up" (north) and +X to "right" (east) on the minimap -
// matches the game's forward = (sin(yaw), cos(yaw)) convention, so a
// player-triangle rotation of exactly `yaw` radians (see below) points it
// the right way with no extra sign-flipping.
function drawMinimap(ctx, { playerX, playerZ, yaw, enemies, objectives }) {
  const half = MINIMAP_SIZE / 2
  const scale = half / MINIMAP_RANGE

  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

  ctx.save()
  ctx.beginPath()
  ctx.arc(half, half, half - 2, 0, Math.PI * 2)
  ctx.fillStyle = MINIMAP_BG
  ctx.fill()
  ctx.clip()

  ctx.strokeStyle = MINIMAP_RING
  ctx.lineWidth = 1
  for (const f of [0.34, 0.67, 1]) {
    ctx.beginPath()
    ctx.arc(half, half, half * f, 0, Math.PI * 2)
    ctx.stroke()
  }

  const toMap = (x, z) => [half + (x - playerX) * scale, half - (z - playerZ) * scale]

  ctx.fillStyle = '#ffce54'
  for (const o of objectives) {
    const [mx, my] = toMap(o.x, o.z)
    if (Math.hypot(mx - half, my - half) > half) continue
    ctx.save()
    ctx.translate(mx, my)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-4, -4, 8, 8)
    ctx.restore()
  }

  for (const e of enemies) {
    const [mx, my] = toMap(e.x, e.z)
    if (Math.hypot(mx - half, my - half) > half) continue
    ctx.fillStyle = e.type === 'heli' ? '#ff6a5a' : '#ff9a3a'
    ctx.beginPath()
    ctx.arc(mx, my, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  ctx.strokeStyle = MINIMAP_BORDER
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(half, half, half - 2, 0, Math.PI * 2)
  ctx.stroke()

  ctx.save()
  ctx.translate(half, half)
  ctx.rotate(yaw)
  ctx.fillStyle = '#7fe9c0'
  ctx.beginPath()
  ctx.moveTo(0, -7)
  ctx.lineTo(5, 6)
  ctx.lineTo(-5, 6)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Flight + combat HUD. Deliberately not driven by React state for the 60fps
// telemetry: createScene's game loop calls `hudApiRef.current.update(...)`
// directly every frame and this writes straight to the DOM nodes below.
// Control hints and the scheme-dependent layout ARE React state, since
// those only change on a rebind/scheme-switch, not every frame.
export function Hud({ hudApiRef, controlConfig }) {
  const speedRef = useRef(null)
  const altitudeRef = useRef(null)
  const headingRef = useRef(null)
  const throttleFillRef = useRef(null)
  const throttleValueRef = useRef(null)
  const flareStatusRef = useRef(null)
  const weaponSelectRef = useRef(null)
  const groundedRef = useRef(null)
  const lookHintRef = useRef(null)
  const inputMethodRef = useRef(null)

  const [scheme, setScheme] = useState(controlConfig.scheme)
  const [showHints, setShowHints] = useState(controlConfig.settings.showHints)
  const [controlHints, setControlHints] = useState(() => buildControlHints(controlConfig))
  const [boosterKeys, setBoosterKeys] = useState(() => buildBoosterKeys(controlConfig))
  useEffect(
    () =>
      controlConfig.subscribe(() => {
        setScheme(controlConfig.scheme)
        setShowHints(controlConfig.settings.showHints)
        setControlHints(buildControlHints(controlConfig))
        setBoosterKeys(buildBoosterKeys(controlConfig))
      }),
    [controlConfig],
  )

  const killsRef = useRef(null)
  const scoreRef = useRef(null)
  const accuracyRef = useRef(null)
  const hostilesRef = useRef(null)
  const missileAmmoRef = useRef(null)
  const objectivePanelRef = useRef(null)
  const objectiveLabelRef = useRef(null)
  const objectiveValueRef = useRef(null)

  const healthFillRef = useRef(null)
  const healthValueRef = useRef(null)
  const healthPanelRef = useRef(null)
  const damageFlashRef = useRef(null)
  const flashTimeoutRef = useRef(null)

  const commRef = useRef(null)
  const commTimeoutRef = useRef(null)
  const warningRef = useRef(null)
  const warningTimeoutRef = useRef(null)

  const bossBarRef = useRef(null)
  const bossNameRef = useRef(null)
  const bossFillRef = useRef(null)
  const bossPercentRef = useRef(null)

  const clockRef = useRef(null)
  const minimapPanelRef = useRef(null)
  const minimapCanvasRef = useRef(null)
  const minimapCtxRef = useRef(null)

  const gimbalRef = useRef(null)
  const gimbalBracketsRef = useRef(null)
  const gimbalRangeRef = useRef(null)
  const gimbalReadoutRef = useRef(null)
  const leadPipRef = useRef(null)
  const wasLockedRef = useRef(false)
  const breakLockTimeoutRef = useRef(null)

  const boosterSlotRefs = useRef({ shield: null, speed: null, weapon: null })
  const boosterCountRefs = useRef({ shield: null, speed: null, weapon: null })
  const bossPhaseDotRefs = useRef([])

  useEffect(() => {
    hudApiRef.current = {
      update({
        speed,
        altitude,
        throttleFraction,
        heading,
        yaw,
        grounded,
        pointerLocked,
        inputMethod,
        gamepadConnected,
        radarVisible,
        flareActive,
        flareReady,
        selectedWeapon,
        kills,
        score,
        accuracy,
        hostiles,
        missileAmmo,
        missileAmmoMax,
        mission,
        missionProgress,
        health,
        healthFraction,
        clockLabel,
        playerX,
        playerZ,
        enemies,
        objectives,
        boosters,
        targeting,
      }) {
        if (speedRef.current) speedRef.current.textContent = (speed * 3.6).toFixed(0)
        if (altitudeRef.current) altitudeRef.current.textContent = Math.max(0, altitude).toFixed(0)
        if (headingRef.current) {
          headingRef.current.textContent = String(Math.round(heading)).padStart(3, '0')
        }
        if (throttleFillRef.current) {
          throttleFillRef.current.style.height = `${clampPercent(throttleFraction * 100)}%`
        }
        if (throttleValueRef.current) {
          throttleValueRef.current.textContent = `${Math.round(clampPercent(throttleFraction * 100))}%`
        }
        if (flareStatusRef.current) {
          const label = flareActive ? 'ACTIVE' : flareReady ? 'READY' : 'RECHARGE'
          flareStatusRef.current.textContent = label
          flareStatusRef.current.className = `hud-boost-value ${flareActive ? 'active' : flareReady ? 'ready' : 'cooldown'}`
        }
        if (weaponSelectRef.current) {
          weaponSelectRef.current.textContent = selectedWeapon === 'missile' ? 'MISSILE' : 'GUN'
        }
        if (groundedRef.current) groundedRef.current.hidden = !grounded
        if (lookHintRef.current) lookHintRef.current.hidden = pointerLocked
        if (inputMethodRef.current) {
          inputMethodRef.current.textContent = inputMethod === 'gamepad' ? '🎮 GAMEPAD' : '⌨ KEYBOARD'
          inputMethodRef.current.classList.toggle('connected', gamepadConnected)
        }
        if (minimapPanelRef.current) minimapPanelRef.current.hidden = !radarVisible

        if (killsRef.current) killsRef.current.textContent = String(kills)
        if (scoreRef.current) scoreRef.current.textContent = String(score)
        if (accuracyRef.current) accuracyRef.current.textContent = `${accuracy.toFixed(0)}%`
        if (hostilesRef.current) hostilesRef.current.textContent = String(hostiles)
        if (missileAmmoRef.current) {
          missileAmmoRef.current.textContent = `${missileAmmo}/${missileAmmoMax}`
        }
        const objective = formatObjective(mission, missionProgress)
        if (objectivePanelRef.current) {
          objectivePanelRef.current.hidden = !objective
          objectivePanelRef.current.classList.toggle('alert', !!objective?.alert)
        }
        if (objective) {
          if (objectiveLabelRef.current) objectiveLabelRef.current.textContent = `OBJECTIVE: ${objective.label}`
          if (objectiveValueRef.current) objectiveValueRef.current.textContent = objective.value
        }

        if (healthFillRef.current) {
          healthFillRef.current.style.width = `${clampPercent(healthFraction * 100)}%`
        }
        if (healthValueRef.current) healthValueRef.current.textContent = Math.round(health)
        if (healthPanelRef.current) healthPanelRef.current.classList.toggle('critical', healthFraction <= 0.25)

        if (clockRef.current) clockRef.current.textContent = clockLabel

        // --- Gimbal targeting reticle ---
        const gimbal = gimbalRef.current
        if (gimbal) {
          const visible = !!targeting && targeting.onScreen
          gimbal.hidden = !visible
          if (visible) {
            gimbal.style.left = `${targeting.x}%`
            gimbal.style.top = `${targeting.y}%`
            gimbal.classList.toggle('locked', targeting.locked)
            // Brackets close in around a locked contact and sit wide while
            // merely tracking - the main "do I have a lock" read.
            if (gimbalBracketsRef.current) {
              gimbalBracketsRef.current.style.transform = `scale(${targeting.locked ? 0.6 : 1})`
            }
            if (gimbalRangeRef.current) {
              gimbalRangeRef.current.style.transform = `translateY(${(targeting.rangeFraction * 64).toFixed(1)}px)`
            }
            if (gimbalReadoutRef.current) {
              gimbalReadoutRef.current.textContent = `${Math.round(targeting.distance)}m · ${String(
                Math.round(targeting.bearing),
              ).padStart(3, '0')}°`
            }
            // Losing a lock you had is worth a distinct flash, rather than
            // the brackets just silently springing back open.
            if (wasLockedRef.current && !targeting.locked) {
              gimbal.classList.remove('break')
              requestAnimationFrame(() => gimbal.classList.add('break'))
              clearTimeout(breakLockTimeoutRef.current)
              breakLockTimeoutRef.current = setTimeout(() => gimbal.classList.remove('break'), 450)
            }
          }
          wasLockedRef.current = visible && targeting.locked
        }

        const leadPip = leadPipRef.current
        if (leadPip) {
          const showLead = !!targeting && targeting.onScreen && targeting.showLead
          leadPip.hidden = !showLead
          if (showLead) {
            leadPip.style.left = `${targeting.leadX}%`
            leadPip.style.top = `${targeting.leadY}%`
            leadPip.classList.toggle('locked', targeting.locked)
          }
        }

        if (boosters) {
          for (const b of boosters) {
            const slotEl = boosterSlotRefs.current[b.id]
            const countEl = boosterCountRefs.current[b.id]
            if (countEl) countEl.textContent = b.active ? `${Math.ceil(b.remaining)}s` : `x${b.charges}`
            if (slotEl) {
              slotEl.classList.toggle('active', b.active)
              slotEl.classList.toggle('empty', !b.active && b.charges <= 0)
            }
          }
        }

        const isBoss = missionProgress?.type === 'boss'
        if (bossBarRef.current) bossBarRef.current.hidden = !isBoss
        if (isBoss) {
          const frac = missionProgress.bossHealthFraction ?? 0
          if (bossNameRef.current) bossNameRef.current.textContent = missionProgress.bossName ?? 'BOSS'
          if (bossFillRef.current) bossFillRef.current.style.width = `${clampPercent(frac * 100)}%`
          if (bossPercentRef.current) bossPercentRef.current.textContent = `${Math.round(clampPercent(frac * 100))}%`
          if (bossBarRef.current) bossBarRef.current.classList.toggle('telegraph', !!missionProgress.bossTelegraphing)
          const maxPhase = missionProgress.bossMaxPhase ?? 0
          bossPhaseDotRefs.current.forEach((dot, i) => {
            if (!dot) return
            dot.hidden = i > maxPhase
            dot.classList.toggle('active', i === missionProgress.bossPhase)
            dot.classList.toggle('passed', i < missionProgress.bossPhase)
          })
        }

        if (!minimapCtxRef.current && minimapCanvasRef.current) {
          minimapCtxRef.current = minimapCanvasRef.current.getContext('2d')
        }
        if (minimapCtxRef.current && radarVisible) {
          drawMinimap(minimapCtxRef.current, { playerX, playerZ, yaw, enemies, objectives })
        }
      },
      flashDamage() {
        const el = damageFlashRef.current
        if (!el) return
        el.classList.remove('flash')
        requestAnimationFrame(() => el.classList.add('flash'))
        clearTimeout(flashTimeoutRef.current)
        flashTimeoutRef.current = setTimeout(() => el.classList.remove('flash'), 400)
      },
      // Radio callouts (missions.js's `radio`) - createScene.js calls this
      // on specific trigger points (start/midway/lowHealth/complete), not
      // every frame, so it's a one-shot fade rather than part of update().
      showComm(text) {
        const el = commRef.current
        if (!el) return
        el.textContent = text
        el.classList.remove('visible')
        void el.offsetWidth // force reflow so re-adding 'visible' restarts the fade even for back-to-back calls
        el.classList.add('visible')
        clearTimeout(commTimeoutRef.current)
        commTimeoutRef.current = setTimeout(() => el.classList.remove('visible'), 5000)
      },
      // Boss attack telegraphs (bossController.js's onTelegraph) - a bolder,
      // shorter-lived warning than showComm's radio chatter, since it's
      // timing-critical (the attack fires when this disappears).
      showWarning(text) {
        const el = warningRef.current
        if (!el) return
        el.textContent = text
        el.classList.remove('visible')
        void el.offsetWidth
        el.classList.add('visible')
        clearTimeout(warningTimeoutRef.current)
        warningTimeoutRef.current = setTimeout(() => el.classList.remove('visible'), 1400)
      },
    }
    return () => {
      hudApiRef.current = null
      clearTimeout(flashTimeoutRef.current)
      clearTimeout(commTimeoutRef.current)
      clearTimeout(warningTimeoutRef.current)
    }
  }, [hudApiRef])

  return (
    <div className="hud">
      <div className="hud-damage-flash" ref={damageFlashRef} aria-hidden="true" />

      {/* Fixed gun pipper. The machine gun is hitscan straight down the
          nose, so this stays dead-centre as the true aim reference - the
          gimbal reticle below is a separate, moving target indicator. */}
      <div className="hud-crosshair" aria-hidden="true">
        <span className="tick tick-top" />
        <span className="tick tick-bottom" />
        <span className="tick tick-left" />
        <span className="tick tick-right" />
        <span className="dot" />
      </div>

      {/* Gimbal targeting reticle - driven by WeaponSystem.acquireTarget(),
          so "locked" here is the same test the missile seeker applies. */}
      <div className="hud-gimbal" ref={gimbalRef} aria-hidden="true" hidden>
        <svg viewBox="0 0 120 120" className="hud-gimbal-svg">
          <g className="gimbal-rings">
            <path d="M46.3 22.4 A40 40 0 0 1 73.7 22.4" />
            <path d="M97.6 46.3 A40 40 0 0 1 97.6 73.7" />
            <path d="M73.7 97.6 A40 40 0 0 1 46.3 97.6" />
            <path d="M22.4 73.7 A40 40 0 0 1 22.4 46.3" />
          </g>
          <g className="gimbal-brackets" ref={gimbalBracketsRef}>
            <path d="M34 44 L34 34 L44 34" />
            <path d="M76 34 L86 34 L86 44" />
            <path d="M86 76 L86 86 L76 86" />
            <path d="M44 86 L34 86 L34 76" />
          </g>
          <g className="gimbal-range">
            <line x1="106" y1="28" x2="106" y2="92" />
            <line x1="103" y1="28" x2="109" y2="28" />
            <line x1="104" y1="60" x2="108" y2="60" />
            <line x1="103" y1="92" x2="109" y2="92" />
            <polygon className="gimbal-range-caret" ref={gimbalRangeRef} points="99,25 103,28 99,31" />
          </g>
          <circle className="gimbal-dot" cx="60" cy="60" r="1.8" />
        </svg>
        <span className="hud-gimbal-readout" ref={gimbalReadoutRef} />
      </div>

      {/* Where a crossing target will be by the time a missile reaches it. */}
      <div className="hud-lead-pip" ref={leadPipRef} aria-hidden="true" hidden>
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="6.5" />
          <line x1="12" y1="2" x2="12" y2="5.5" />
          <line x1="12" y1="18.5" x2="12" y2="22" />
        </svg>
      </div>

      <div className="hud-panel hud-instruments">
        <div className="hud-readout">
          <span className="hud-label">SPD</span>
          <span className="hud-value" ref={speedRef}>
            0
          </span>
          <span className="hud-unit">km/h</span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">ALT</span>
          <span className="hud-value" ref={altitudeRef}>
            0
          </span>
          <span className="hud-unit">m</span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">HDG</span>
          <span className="hud-value" ref={headingRef}>
            000
          </span>
          <span className="hud-unit">deg</span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">TIME</span>
          <span className="hud-value hud-clock" ref={clockRef}>
            00:00
          </span>
        </div>
      </div>

      <div className="hud-panel hud-combat">
        <div className="hud-readout">
          <span className="hud-label">KILLS</span>
          <span className="hud-value" ref={killsRef}>
            0
          </span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">SCORE</span>
          <span className="hud-value" ref={scoreRef}>
            0
          </span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">ACC</span>
          <span className="hud-value" ref={accuracyRef}>
            0%
          </span>
        </div>
        <div className="hud-readout">
          <span className="hud-label">HOSTILES</span>
          <span className="hud-value" ref={hostilesRef}>
            0
          </span>
        </div>
        {scheme === 'sim' && (
          <div className="hud-readout">
            <span className="hud-label">WPN</span>
            <span className="hud-value hud-weapon-select" ref={weaponSelectRef}>
              GUN
            </span>
          </div>
        )}
      </div>

      <div className="hud-boss-bar" ref={bossBarRef} aria-label="Boss health" hidden>
        <div className="hud-boss-bar-header">
          <span className="hud-boss-name" ref={bossNameRef}>
            BOSS
          </span>
          <div className="hud-boss-phases">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="hud-boss-phase-dot"
                ref={(el) => {
                  bossPhaseDotRefs.current[i] = el
                }}
              />
            ))}
          </div>
          <span className="hud-boss-percent" ref={bossPercentRef}>
            100%
          </span>
        </div>
        <div className="hud-boss-track">
          <div className="hud-boss-fill" ref={bossFillRef} />
        </div>
      </div>

      <div className="hud-warning" ref={warningRef} aria-live="assertive" />

      <div className="hud-panel hud-objective" ref={objectivePanelRef} aria-label="Objective" hidden>
        <span className="hud-label" ref={objectiveLabelRef}>
          OBJECTIVE
        </span>
        <span className="hud-value hud-objective-value" ref={objectiveValueRef}>
          0/0
        </span>
      </div>

      <div className="hud-comm" ref={commRef} aria-live="polite" />

      <div className="hud-panel hud-throttle" aria-label="Status">
        {scheme === 'sim' && (
          <>
            <span className="hud-throttle-caption">THR</span>
            <div className="hud-throttle-track">
              <div className="hud-throttle-fill" ref={throttleFillRef} />
            </div>
            <span className="hud-throttle-value" ref={throttleValueRef}>
              0%
            </span>
          </>
        )}
        <span className="hud-throttle-caption hud-ammo-caption">MSL</span>
        <span className="hud-ammo-value" ref={missileAmmoRef}>
          0/0
        </span>
        <span className="hud-throttle-caption hud-ammo-caption">FLARES</span>
        <span className="hud-boost-value ready" ref={flareStatusRef}>
          READY
        </span>
      </div>

      <div className="hud-panel hud-health" ref={healthPanelRef} aria-label="Health">
        <span className="hud-throttle-caption">HULL</span>
        <div className="hud-health-track">
          <div className="hud-health-fill" ref={healthFillRef} />
        </div>
        <span className="hud-value hud-health-value" ref={healthValueRef}>
          100
        </span>
      </div>

      <div className="hud-panel hud-boosters" aria-label="Boosters">
        {[
          { id: 'shield', label: 'SHIELD', key: boosterKeys.shield },
          { id: 'speed', label: 'SPEED', key: boosterKeys.speed },
          { id: 'weapon', label: 'WEAPON', key: boosterKeys.weapon },
        ].map((b) => (
          <div
            className="hud-booster-slot"
            key={b.id}
            ref={(el) => {
              boosterSlotRefs.current[b.id] = el
            }}
          >
            <span className="hud-booster-key">{b.key}</span>
            <span className="hud-booster-label">{b.label}</span>
            <span
              className="hud-booster-count"
              ref={(el) => {
                boosterCountRefs.current[b.id] = el
              }}
            >
              x0
            </span>
          </div>
        ))}
      </div>

      <div className="hud-input-method" ref={inputMethodRef} aria-label="Input method">
        ⌨ KEYBOARD
      </div>

      <div className="hud-panel hud-minimap" ref={minimapPanelRef} aria-label="Map">
        <canvas ref={minimapCanvasRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />
      </div>

      <div className="hud-badge" ref={groundedRef} hidden>
        GROUND CONTACT
      </div>

      {showHints && (
        <div className="hud-controls">
          {controlHints.map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
          <span className="hud-look-hint" ref={lookHintRef}>
            click to enable
          </span>
        </div>
      )}
    </div>
  )
}
