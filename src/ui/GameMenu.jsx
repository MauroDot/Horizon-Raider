import { useCallback, useEffect, useRef, useState } from 'react'
import { ACTIONS_BY_SCHEME, describeBinding } from '../game/controlConfig.js'
import { BUTTON } from '../game/gamepad/gamepadManager.js'
import { Slider } from './SettingsControls.jsx'
import {
  GraphicsSettingsView,
  AccessibilitySettingsView,
  GameSettingsView,
  CreditsView,
} from './SettingsViews.jsx'
import './GameMenu.css'

const BUTTON_NAMES = Object.keys(BUTTON)

function useControlConfigVersion(controlConfig) {
  const [, setVersion] = useState(0)
  useEffect(() => controlConfig.subscribe(() => setVersion((v) => v + 1)), [controlConfig])
}

// Rebind capture, keyboard/mouse OR gamepad. Keyboard/mouse listens for raw
// DOM events (capture-phase + stopImmediatePropagation so e.g. Escape
// canceling a capture doesn't *also* fire the game's own Pause binding,
// which defaults to Escape too). Gamepad has no events at all - the button
// press has to be polled for, so that branch runs its own rAF loop
// watching for a 0->1 transition instead.
function useRebindCapture(onCaptured, gamepadManager) {
  const [capturing, setCapturing] = useState(null) // { actionId, gamepad } | null

  useEffect(() => {
    if (!capturing) return undefined
    const finish = (binding) => {
      const target = capturing
      setCapturing(null)
      onCaptured(target.actionId, binding, target.gamepad)
    }

    if (capturing.gamepad) {
      let raf
      let prevButtons = gamepadManager?.poll()?.buttons ?? []
      const loop = () => {
        const state = gamepadManager?.poll()
        if (state) {
          for (let i = 0; i < state.buttons.length; i++) {
            if (state.buttons[i] && !prevButtons[i]) {
              const code = BUTTON_NAMES.find((name) => BUTTON[name] === i)
              if (code) {
                finish({ device: 'gamepad', code })
                return
              }
            }
          }
          prevButtons = state.buttons
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      const onKeyDown = (e) => {
        if (e.code === 'Escape') {
          e.preventDefault()
          e.stopImmediatePropagation()
          finish(null)
        }
      }
      window.addEventListener('keydown', onKeyDown, true)
      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('keydown', onKeyDown, true)
      }
    }

    const onKeyDown = (e) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      finish(e.code === 'Escape' ? null : { device: 'keyboard', code: e.code })
    }
    const onMouseDown = (e) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      const code = e.button === 0 ? 'Left' : e.button === 2 ? 'Right' : e.button === 1 ? 'Middle' : null
      if (code) finish({ device: 'mouse', code })
    }
    const onWheel = (e) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      finish({ device: 'mouse', code: e.deltaY < 0 ? 'WheelUp' : 'WheelDown' })
    }
    const onContextMenu = (e) => e.preventDefault()

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    window.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [capturing, onCaptured, gamepadManager])

  return [capturing, setCapturing]
}

function PauseView({ onResume, onSettings, onQuit }) {
  return (
    <>
      <h1>PAUSED</h1>
      <div className="game-menu-actions">
        <button type="button" onClick={onResume}>
          Resume
        </button>
        <button type="button" onClick={onQuit}>
          End Run &amp; Save Score
        </button>
        <button type="button" onClick={onSettings}>
          Settings
        </button>
      </div>
    </>
  )
}

function SettingsView({ controlConfig, onBack, onNavigate }) {
  return (
    <>
      <h1>SETTINGS</h1>
      <div className="game-menu-preset-row">
        <span>Control Scheme</span>
        <select value={controlConfig.scheme} onChange={(e) => controlConfig.setScheme(e.target.value)}>
          <option value="sim">Realistic Simulation</option>
          <option value="arcade">Arcade FPS-Style</option>
        </select>
      </div>
      <p className="game-menu-note">Changing scheme restarts the current flight.</p>
      <div className="game-menu-list">
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('keyboard')}>
          Control Remapping (Keyboard &amp; Mouse)
        </button>
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('controller')}>
          Controller Remapping
        </button>
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('mouseCamera')}>
          Mouse &amp; Camera
        </button>
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('presets')}>
          Presets
        </button>
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('audio')}>
          Audio
        </button>
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('graphics')}>
          Graphics
        </button>
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('accessibility')}>
          Accessibility
        </button>
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('game')}>
          Game
        </button>
        <button type="button" className="game-menu-list-item" onClick={() => onNavigate('credits')}>
          Credits
        </button>
      </div>
      <div className="game-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

function BindingList({ controlConfig, gamepad, capturing, onStartCapture, onBack, title }) {
  const scheme = controlConfig.scheme
  const actions = ACTIONS_BY_SCHEME[scheme]
  const categories = [...new Set(actions.map((a) => a.category))]

  return (
    <>
      <h1>{title}</h1>
      {capturing && (
        <p className="game-menu-hint">
          {gamepad ? 'Press a button/bumper/trigger to bind, ESC to cancel' : 'Press any key to bind, ESC to cancel'}
        </p>
      )}
      <div className="game-menu-binding-list">
        {categories.map((category) => (
          <div key={category} className="game-menu-category">
            <h2>{category}</h2>
            {actions
              .filter((a) => a.category === category)
              .map((action) => {
                const isCapturing = capturing?.actionId === action.id && capturing.gamepad === gamepad
                const binding = controlConfig.getBinding(action.id, { gamepad })
                return (
                  <div className="game-menu-binding-row" key={action.id}>
                    <span className="game-menu-binding-label">{action.label}</span>
                    <button
                      type="button"
                      className={`game-menu-binding-key${isCapturing ? ' capturing' : ''}`}
                      onClick={() => onStartCapture({ actionId: action.id, gamepad })}
                    >
                      {isCapturing ? 'Waiting…' : describeBinding(binding)}
                    </button>
                    <button
                      type="button"
                      className="game-menu-binding-reset"
                      title="Reset this binding to default"
                      onClick={() => controlConfig.resetAction(action.id, { gamepad })}
                    >
                      ↺
                    </button>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
      <div className="game-menu-actions">
        <button type="button" onClick={() => controlConfig.resetScheme(scheme)}>
          Reset {scheme === 'sim' ? 'Sim' : 'Arcade'} to Default
        </button>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

function MouseCameraView({ controlConfig, onBack }) {
  const s = controlConfig.settings
  const set = (key, value) => controlConfig.updateSetting(key, value)
  return (
    <>
      <h1>MOUSE &amp; CAMERA</h1>
      <div className="game-menu-slider-list">
        <Slider label="Mouse Sensitivity" value={s.mouseSensitivity} onChange={(v) => set('mouseSensitivity', v)} />
        <Slider
          label="Camera Smoothing"
          value={s.cameraSmoothing}
          onChange={(v) => set('cameraSmoothing', v)}
        />
        <div className="game-menu-toggle-row">
          <span>Invert Y-Axis</span>
          <input type="checkbox" checked={s.invertY} onChange={(e) => set('invertY', e.target.checked)} />
        </div>
        <div className="game-menu-toggle-row">
          <span>Mouse Acceleration</span>
          <input
            type="checkbox"
            checked={s.mouseAcceleration}
            onChange={(e) => set('mouseAcceleration', e.target.checked)}
          />
        </div>
        <div className="game-menu-toggle-row">
          <span>Show Control Hints</span>
          <input type="checkbox" checked={s.showHints} onChange={(e) => set('showHints', e.target.checked)} />
        </div>
      </div>
      <div className="game-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

function AudioSettingsView({ controlConfig, audioManager, onBack }) {
  const s = controlConfig.settings
  const set = (key, value) => {
    controlConfig.updateSetting(key, value)
    // App.jsx also applies settings on every controlConfig change, but
    // pushing it here too means the slider feels live even in the one
    // render tick before that subscription fires.
    if (key === 'masterVolume') audioManager?.setMasterVolume(value)
    else if (key === 'musicVolume') audioManager?.setMusicVolume(value)
    else if (key === 'sfxVolume') audioManager?.setSfxVolume(value)
    else if (key === 'audioMuted') audioManager?.setMuted(value)
  }
  return (
    <>
      <h1>AUDIO</h1>
      <div className="game-menu-slider-list">
        <Slider label="Master Volume" value={s.masterVolume} onChange={(v) => set('masterVolume', v)} />
        <Slider label="Music Volume" value={s.musicVolume} onChange={(v) => set('musicVolume', v)} />
        <Slider label="SFX Volume" value={s.sfxVolume} onChange={(v) => set('sfxVolume', v)} />
        <div className="game-menu-toggle-row">
          <span>Mute All</span>
          <input type="checkbox" checked={s.audioMuted} onChange={(e) => set('audioMuted', e.target.checked)} />
        </div>
      </div>
      <div className="game-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

function ControllerSettingsView({ controlConfig, gamepadManager }) {
  const s = controlConfig.settings
  const GAMEPAD_SETTING_KEY = {
    gamepadDeadzone: 'deadzone',
    gamepadSensitivity: 'sensitivity',
    gamepadEnabled: 'enabled',
  }
  const set = (key, value) => {
    controlConfig.updateSetting(key, value)
    gamepadManager?.updateSettings({ [GAMEPAD_SETTING_KEY[key] ?? key]: value })
  }
  // Live axis readout while this screen is open. A stick that reads
  // non-zero here with your hands off the controller is exactly what makes
  // the aircraft turn on its own - the numbers make that immediately
  // visible instead of something you have to infer from the flying.
  const [pad, setPad] = useState(null)
  useEffect(() => {
    const id = setInterval(() => setPad(gamepadManager?.poll() ?? null), 200)
    return () => clearInterval(id)
  }, [gamepadManager])
  const drifting = pad && (Math.abs(pad.leftX) > 0.02 || Math.abs(pad.leftY) > 0.02 || Math.abs(pad.rightX) > 0.02 || Math.abs(pad.rightY) > 0.02)

  return (
    <div className="game-menu-controller-settings">
      <p className="game-menu-note">
        {gamepadManager?.connected ? 'Controller connected.' : 'No controller detected - connect one and press a button.'}
      </p>

      {pad && (
        <div className="game-menu-note">
          <div>
            Live sticks - L({pad.leftX.toFixed(2)}, {pad.leftY.toFixed(2)}) R({pad.rightX.toFixed(2)},{' '}
            {pad.rightY.toFixed(2)})
          </div>
          {gamepadManager?.nonStandardMapping && (
            <div style={{ color: '#ffce54' }}>
              Non-standard controller layout - stick axes are ignored for flight (buttons still work), because there
              is no reliable way to tell a stick axis from a throttle or trigger on this device.
            </div>
          )}
          {drifting && !gamepadManager?.nonStandardMapping && (
            <div style={{ color: '#ff6a5a' }}>
              Sticks are not centred. With your hands off the controller, press Recalibrate - otherwise this offset
              is read as a constant steering input and the aircraft will turn on its own.
            </div>
          )}
        </div>
      )}

      <div className="game-menu-preset-row">
        <span>Ignore controller</span>
        <input
          type="checkbox"
          checked={!s.gamepadEnabled}
          onChange={(e) => set('gamepadEnabled', !e.target.checked)}
        />
      </div>
      <div className="game-menu-preset-row">
        <span>Stick centre</span>
        <button type="button" onClick={() => gamepadManager?.recalibrate()}>
          Recalibrate
        </button>
      </div>
      <div className="game-menu-slider-list">
        <Slider label="Dead Zone" value={s.gamepadDeadzone} min={0.05} max={0.3} onChange={(v) => set('gamepadDeadzone', v)} />
        <Slider label="Stick Sensitivity" value={s.gamepadSensitivity} onChange={(v) => set('gamepadSensitivity', v)} />
        <Slider label="Vibration" value={s.vibration} onChange={(v) => set('vibration', v)} />
        <div className="game-menu-preset-row">
          <span>Trigger Response</span>
          <select value={s.triggerCurve} onChange={(e) => set('triggerCurve', e.target.value)}>
            <option value="linear">Linear</option>
            <option value="exponential">Exponential</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function PresetsView({ controlConfig, onBack }) {
  const [presetName, setPresetName] = useState('')
  const fileInputRef = useRef(null)
  const [importMessage, setImportMessage] = useState('')

  function exportConfig() {
    const blob = new Blob([controlConfig.exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'horizon-raider-controls.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importConfig(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const ok = controlConfig.importJSON(String(reader.result))
      setImportMessage(ok ? 'Imported successfully.' : 'That file is not a valid controls export.')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <>
      <h1>PRESETS</h1>
      <div className="game-menu-preset-row">
        <span>Load built-in</span>
        <select
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value
            if (v === 'realistic') {
              controlConfig.setScheme('sim')
              controlConfig.resetScheme('sim')
            } else if (v === 'arcade') {
              controlConfig.setScheme('arcade')
              controlConfig.resetScheme('arcade')
            } else if (v === 'controller') {
              controlConfig.resetScheme(controlConfig.scheme)
            }
            e.target.value = ''
          }}
        >
          <option value="" disabled>
            Choose…
          </option>
          <option value="realistic">Realistic Default</option>
          <option value="arcade">Arcade Default</option>
          <option value="controller">Controller Default (current scheme)</option>
        </select>
      </div>

      <h2 className="game-menu-subheading">Your Presets</h2>
      <div className="game-menu-list">
        {controlConfig.customPresets.length === 0 && <p className="game-menu-note">No saved presets yet.</p>}
        {controlConfig.customPresets.map((p) => (
          <div className="game-menu-binding-row" key={p.name}>
            <span className="game-menu-binding-label">
              {p.name} <span className="game-menu-note-inline">({p.scheme})</span>
            </span>
            <button type="button" className="game-menu-binding-key" onClick={() => controlConfig.loadPreset(p.name)}>
              Load
            </button>
            <button type="button" className="game-menu-binding-reset" onClick={() => controlConfig.deletePreset(p.name)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="game-menu-save-row">
        <input
          type="text"
          placeholder="Preset name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            if (!presetName.trim()) return
            controlConfig.savePreset(presetName)
            setPresetName('')
          }}
        >
          Save Current
        </button>
      </div>

      <div className="game-menu-actions">
        <button type="button" onClick={exportConfig}>
          Export Preset
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import Preset
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importConfig} />
      {importMessage && <p className="game-menu-note">{importMessage}</p>}

      <div className="game-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

// Unified pause / settings menu. Pause is the entry point since there's no
// separate title screen to hang a menu off of otherwise.
// `standalone` opens straight into Settings with no pause layer behind it,
// which is how the Main Menu reuses this exact screen - one settings
// implementation rather than a menu copy and an in-game copy that drift.
export function GameMenu({
  controlConfig,
  gamepadManager,
  audioManager,
  onResume,
  onQuit,
  standalone = false,
  onClose,
}) {
  useControlConfigVersion(controlConfig)
  const [view, setView] = useState(standalone ? 'settings' : 'pause')
  const [conflict, setConflict] = useState(null)

  const handleCaptured = useCallback(
    (actionId, binding, gamepad) => {
      if (!binding) return
      const conflictingActionId = controlConfig.findConflict(actionId, binding, { gamepad })
      if (conflictingActionId) {
        setConflict({ actionId, binding, conflictingActionId, gamepad })
      } else {
        controlConfig.setBinding(actionId, binding, { gamepad })
      }
    },
    [controlConfig],
  )

  const [capturing, startCapture] = useRebindCapture(handleCaptured, gamepadManager)

  function resolveConflict(replace) {
    if (replace && conflict) {
      controlConfig.setBinding(conflict.conflictingActionId, null, { gamepad: conflict.gamepad })
      controlConfig.setBinding(conflict.actionId, conflict.binding, { gamepad: conflict.gamepad })
    }
    setConflict(null)
  }

  return (
    <div className="game-menu">
      <div className="game-menu-panel">
        {view === 'pause' && <PauseView onResume={onResume} onSettings={() => setView('settings')} onQuit={onQuit} />}
        {view === 'settings' && (
          <SettingsView
            controlConfig={controlConfig}
            onBack={standalone ? onClose : () => setView('pause')}
            onNavigate={setView}
          />
        )}
        {view === 'keyboard' && (
          <BindingList
            controlConfig={controlConfig}
            gamepad={false}
            capturing={capturing}
            onStartCapture={startCapture}
            onBack={() => setView('settings')}
            title="KEYBOARD &amp; MOUSE"
          />
        )}
        {view === 'controller' && (
          <>
            <BindingList
              controlConfig={controlConfig}
              gamepad
              capturing={capturing}
              onStartCapture={startCapture}
              onBack={() => setView('settings')}
              title="CONTROLLER"
            />
            <ControllerSettingsView controlConfig={controlConfig} gamepadManager={gamepadManager} />
          </>
        )}
        {view === 'mouseCamera' && <MouseCameraView controlConfig={controlConfig} onBack={() => setView('settings')} />}
        {view === 'presets' && <PresetsView controlConfig={controlConfig} onBack={() => setView('settings')} />}
        {view === 'graphics' && (
          <GraphicsSettingsView controlConfig={controlConfig} onBack={() => setView('settings')} />
        )}
        {view === 'accessibility' && (
          <AccessibilitySettingsView controlConfig={controlConfig} onBack={() => setView('settings')} />
        )}
        {view === 'game' && <GameSettingsView controlConfig={controlConfig} onBack={() => setView('settings')} />}
        {view === 'credits' && <CreditsView onBack={() => setView('settings')} />}
        {view === 'audio' && (
          <AudioSettingsView controlConfig={controlConfig} audioManager={audioManager} onBack={() => setView('settings')} />
        )}
      </div>

      {conflict && (
        <div className="game-menu-conflict-backdrop">
          <div className="game-menu-conflict">
            <p>
              <strong>{describeBinding(conflict.binding)}</strong> is already bound to{' '}
              <strong>
                {ACTIONS_BY_SCHEME[controlConfig.scheme].find((a) => a.id === conflict.conflictingActionId)?.label}
              </strong>
              .
            </p>
            <p>Replace it?</p>
            <div className="game-menu-actions">
              <button type="button" onClick={() => resolveConflict(true)}>
                Replace
              </button>
              <button type="button" onClick={() => resolveConflict(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
