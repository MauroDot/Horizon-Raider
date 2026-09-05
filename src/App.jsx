import { useEffect, useRef, useState } from 'react'
import { ControlConfig } from './game/controlConfig.js'
import { GamepadManager } from './game/gamepad/gamepadManager.js'
import { AudioManager } from './game/audio/audioManager.js'
import { applyDisplaySettings } from './game/displaySettings.js'
import { useGameStore, GameMode } from './state/gameStore.js'
import { MainMenu } from './ui/MainMenu.jsx'
import { GameScreen } from './ui/GameScreen.jsx'
import './App.css'

// Thin router: gameStore.mode decides whether the Main Menu or the actual
// 3D game is on screen. controlConfig/gamepadManager/audioManager are true
// app-wide singletons - created once here (outside both the menu and the
// restartable game lifecycle) so bindings, a connected controller, and
// music/sfx state all survive every mode transition, menu included.
function App() {
  const mode = useGameStore((s) => s.mode)
  const [controlConfig] = useState(() => new ControlConfig())
  const [gamepadManager] = useState(
    () =>
      new GamepadManager({
        enabled: controlConfig.settings.gamepadEnabled,
        deadzone: controlConfig.settings.gamepadDeadzone,
        sensitivity: controlConfig.settings.gamepadSensitivity,
        triggerCurve: controlConfig.settings.triggerCurve,
        vibration: controlConfig.settings.vibration,
      }),
  )
  const [audioManager] = useState(() => new AudioManager())
  const [notification, setNotification] = useState(null)
  const notificationTimeoutRef = useRef(null)

  useEffect(() => {
    return gamepadManager.onConnectionChange((connected, gamepad) => {
      setNotification(connected ? `Controller connected: ${gamepad.id}` : 'Controller disconnected')
      clearTimeout(notificationTimeoutRef.current)
      notificationTimeoutRef.current = setTimeout(() => setNotification(null), 3000)
    })
  }, [gamepadManager])

  useEffect(() => () => gamepadManager.dispose(), [gamepadManager])

  // Apply the persisted audio settings immediately, and again on every
  // change (Settings screen edits) - same subscribe pattern Hud.jsx uses
  // for controlConfig. Browsers block audio until a user gesture, so the
  // context itself only actually starts producing sound after the first
  // click/keydown resumes it (same convention as engineSound.js's start()).
  // Accessibility settings are pure presentation - push them onto <html>
  // on boot and on every change so CSS picks them up immediately.
  useEffect(() => {
    const apply = () => applyDisplaySettings(controlConfig.settings)
    apply()
    return controlConfig.subscribe(apply)
  }, [controlConfig])

  useEffect(() => {
    const applyAudioSettings = () => {
      const s = controlConfig.settings
      audioManager.setMasterVolume(s.masterVolume)
      audioManager.setMusicVolume(s.musicVolume)
      audioManager.setSfxVolume(s.sfxVolume)
      audioManager.setMuted(s.audioMuted)
    }
    applyAudioSettings()
    return controlConfig.subscribe(applyAudioSettings)
  }, [controlConfig, audioManager])

  useEffect(() => {
    const resume = () => audioManager.resume()
    window.addEventListener('keydown', resume)
    window.addEventListener('mousedown', resume)
    return () => {
      window.removeEventListener('keydown', resume)
      window.removeEventListener('mousedown', resume)
    }
  }, [audioManager])

  useEffect(() => () => audioManager.dispose(), [audioManager])

  // Dev convenience only: lets someone drop a new file into public/audio
  // mid-session and run `window.__audioManager.clearMissingCache()` in the
  // browser console to pick it up without a full reload (see
  // public/audio/README.md). Not read by any game code.
  useEffect(() => {
    window.__audioManager = audioManager
    return () => {
      if (window.__audioManager === audioManager) delete window.__audioManager
    }
  }, [audioManager])

  return (
    <>
      {mode === GameMode.MENU ? (
        <MainMenu
          controlConfig={controlConfig}
          gamepadManager={gamepadManager}
          audioManager={audioManager}
        />
      ) : (
        <GameScreen controlConfig={controlConfig} gamepadManager={gamepadManager} audioManager={audioManager} />
      )}
      {notification && <div className="input-toast">{notification}</div>}
    </>
  )
}

export default App
