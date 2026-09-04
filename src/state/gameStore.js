import { create } from 'zustand'

// The five modes from the spec. FREE_PLAY and MISSION are the two "actually
// flying" states; PAUSE and GAME_OVER are transient overlays on top of
// whichever of those was active (see `previousMode`/`activeMissionId`,
// which both survive through PAUSE/GAME_OVER so retry/resume know what to
// go back to).
export const GameMode = {
  MENU: 'MENU',
  FREE_PLAY: 'FREE_PLAY',
  MISSION: 'MISSION',
  PAUSE: 'PAUSE',
  GAME_OVER: 'GAME_OVER',
}

const GAMEPLAY_MODES = new Set([GameMode.FREE_PLAY, GameMode.MISSION])

export const useGameStore = create((set, get) => ({
  mode: GameMode.MENU,
  previousMode: null, // the gameplay mode PAUSE should resume back into
  activeMissionId: null, // set for the lifetime of a mission run, through PAUSE and GAME_OVER
  activeDifficultyId: 'normal', // chosen on the mission briefing screen; irrelevant (left as-is) for Free Play
  lastRunStats: null, // { kills, score, accuracy, outcome, missionId, secondaryComplete, healthFraction, ... }

  startFreePlay: () =>
    set({ mode: GameMode.FREE_PLAY, previousMode: null, activeMissionId: null, lastRunStats: null }),

  startMission: (missionId, difficultyId = 'normal') =>
    set({
      mode: GameMode.MISSION,
      previousMode: null,
      activeMissionId: missionId,
      activeDifficultyId: difficultyId,
      lastRunStats: null,
    }),

  pause: () =>
    set((s) => (GAMEPLAY_MODES.has(s.mode) ? { mode: GameMode.PAUSE, previousMode: s.mode } : {})),

  resume: () => set((s) => (s.previousMode ? { mode: s.previousMode } : {})),

  togglePause: () => {
    const { mode, pause, resume } = get()
    if (mode === GameMode.PAUSE) resume()
    else if (GAMEPLAY_MODES.has(mode)) pause()
  },

  // Called once per run, either on death or on meeting a mission's
  // objective - `stats` carries which via `stats.outcome`.
  endRun: (stats) => set({ mode: GameMode.GAME_OVER, lastRunStats: stats }),

  // Relaunches the same run type that just ended (free play, or the same
  // mission) - the caller (GameScreen) still has to actually rebuild the
  // Three.js scene; this only updates which mode/mission is "current".
  retry: () =>
    set((s) => ({ mode: s.activeMissionId ? GameMode.MISSION : GameMode.FREE_PLAY, lastRunStats: null })),

  goToMenu: () => set({ mode: GameMode.MENU, previousMode: null, activeMissionId: null, lastRunStats: null }),
}))
