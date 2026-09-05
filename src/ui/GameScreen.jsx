import { useCallback, useEffect, useRef, useState } from 'react'
import { initGame } from '../game/createScene.js'
import { useGameStore, GameMode } from '../state/gameStore.js'
import { usePersistentStore } from '../state/persistentStore.js'
import { useSaveStore } from '../state/saveStore.js'
import { MISSIONS, getMissionIndex } from '../game/campaign/missions.js'
import { gradeMission } from '../game/campaign/missionGrading.js'
import { Hud } from './Hud.jsx'
import { GameOver } from './GameOver.jsx'
import { GameMenu } from './GameMenu.jsx'
import { TutorialOverlay } from './TutorialOverlay.jsx'

// Mounted for the whole FREE_PLAY / MISSION / PAUSE / GAME_OVER cluster of
// modes (App.jsx swaps it in/out based on gameStore.mode) - it does NOT
// remount between those four, only when the player leaves to MENU and
// comes back. PAUSE and GAME_OVER are therefore just conditional overlays
// here, not separate mounts; `launchGame` (the actual dispose-old/build-new
// Three.js scene step) is called explicitly on mount, on Retry, and on a
// control-scheme switch - never implicitly from a mode change, so pausing
// or ending a run never has a side effect of touching the live scene.
export function GameScreen({ controlConfig, gamepadManager, audioManager }) {
  const containerRef = useRef(null)
  const hudApiRef = useRef(null)
  const gameRef = useRef(null)
  const activeSchemeRef = useRef(null)
  const pausedRef = useRef(false)

  const mode = useGameStore((s) => s.mode)
  const lastRunStats = useGameStore((s) => s.lastRunStats)
  const togglePause = useGameStore((s) => s.togglePause)
  const resume = useGameStore((s) => s.resume)
  const endRun = useGameStore((s) => s.endRun)
  const retry = useGameStore((s) => s.retry)
  const goToMenu = useGameStore((s) => s.goToMenu)
  const recordRun = usePersistentStore((s) => s.recordRun)

  const paused = mode === GameMode.PAUSE
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const [showTutorial, setShowTutorial] = useState(!controlConfig.hasSeenTutorial)

  const launchGame = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    gameRef.current?.dispose()
    activeSchemeRef.current = controlConfig.scheme

    const missionId = useGameStore.getState().activeMissionId
    const mission = missionId ? MISSIONS.find((m) => m.id === missionId) : null
    const difficultyId = useGameStore.getState().activeDifficultyId
    const { helicopterColor, loadout, helicopterId } = usePersistentStore.getState().customization
    const { level } = usePersistentStore.getState().getProgress()
    const boosterCharges = usePersistentStore.getState().boosterInventory

    // Auto-save on mission start (per the save/load spec) - a safety net so
    // progress up to this point (including whichever save slot is now
    // active) isn't lost if the browser closes mid-mission. Free Play runs
    // don't get a "start" save since there's no mission progress to protect
    // yet; they're still covered by the "on run end" save below.
    // Auto-save can be turned off in Settings > Game; the run-end save
    // below still happens either way, so a finished run is never lost.
    if (mission && controlConfig.settings.autoSave !== false) useSaveStore.getState().saveToActiveSlot()

    gameRef.current = initGame(container, {
      hudRef: hudApiRef,
      controlConfig,
      gamepadManager,
      audioManager,
      pausedRef,
      runMode: mission ? 'mission' : 'freeplay',
      mission,
      difficultyId,
      helicopterColor,
      helicopterId,
      loadout,
      level,
      boosterCharges,
      // Booster charges are consumed live (not batched to run-end) so a
      // closed tab mid-mission doesn't refund an already-used charge - see
      // persistentStore.consumeBoosterCharge's own docs.
      onBoosterUse: (id) => usePersistentStore.getState().consumeBoosterCharge(id),
      onPauseToggle: togglePause,
      onRunEnd: (stats) => {
        // Grade the run (stars/rank/XP/credits) here, where the mission and
        // difficulty context already live, rather than have persistentStore
        // reach back into campaign data it otherwise has no reason to know
        // about. Free Play has no mission to grade - recordRun falls back
        // to its plain kill/accuracy/score formula for those.
        const grade = mission
          ? gradeMission({
              mission,
              difficultyId,
              success: stats.outcome === 'missionComplete',
              secondaryComplete: stats.secondaryComplete,
              stats,
              healthFraction: stats.healthFraction,
            })
          : null
        recordRun({
          ...stats,
          missionIndex: mission ? getMissionIndex(mission.id) : -1,
          difficultyId,
          isBossMission: mission?.type === 'boss',
          stars: grade?.stars,
          rank: grade?.rank,
          xpGain: grade?.xp,
          currencyGain: grade?.currency,
        })
        // Auto-save on mission complete, and also on any run ending at all
        // (death, or a Free Play session winding down) - covers "Free play
        // high scores" persistence for players who never touch the
        // Campaign, not just the spec's literal "mission complete" case.
        useSaveStore.getState().saveToActiveSlot()
        // Free Play has its own difficulty now, so this is always meaningful -
        // it used to be nulled for non-mission runs, which meant Free Play
        // leaderboard entries recorded no difficulty at all.
        endRun({ ...stats, grade, difficultyId })
      },
    })
  }, [controlConfig, gamepadManager, audioManager, togglePause, endRun, recordRun])

  useEffect(() => {
    launchGame()
    return () => gameRef.current?.dispose()
  }, [launchGame])

  // A scheme switch changes which physics model is active - simplest and
  // most robust to just rebuild the scene rather than hot-swap models.
  // Pause state lives in gameStore now (not local state), so this doesn't
  // need to preserve/restore anything explicitly - `mode` just stays
  // whatever it already was (e.g. still PAUSE) across the relaunch.
  useEffect(() => {
    return controlConfig.subscribe(() => {
      if (activeSchemeRef.current !== null && activeSchemeRef.current !== controlConfig.scheme) {
        launchGame()
      }
    })
  }, [controlConfig, launchGame])

  // Ends the run through the scene's own finish path, so the score is
  // recorded, auto-saved and offered to the leaderboard exactly as it
  // would be on death - "quit anytime and save score".
  const handleQuitRun = useCallback(() => {
    if (gameRef.current?.endRun) {
      resume() // leave PAUSE so the results screen isn't behind the pause overlay
      gameRef.current.endRun('quit')
    } else {
      goToMenu()
    }
  }, [resume, goToMenu])

  const handleRetry = useCallback(() => {
    retry()
    launchGame()
  }, [retry, launchGame])

  return (
    <>
      <div className="game-viewport" ref={containerRef} />
      <Hud hudApiRef={hudApiRef} controlConfig={controlConfig} />
      {showTutorial && <TutorialOverlay controlConfig={controlConfig} onDismiss={() => setShowTutorial(false)} />}
      {mode === GameMode.PAUSE && !showTutorial && (
        <GameMenu
          controlConfig={controlConfig}
          gamepadManager={gamepadManager}
          audioManager={audioManager}
          onResume={resume}
          onQuit={handleQuitRun}
        />
      )}
      {mode === GameMode.GAME_OVER && lastRunStats && (
        <GameOver stats={lastRunStats} audioManager={audioManager} onRetry={handleRetry} onMenu={goToMenu} />
      )}
    </>
  )
}
