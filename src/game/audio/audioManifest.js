// The full list of audio files this game is "ready for" - every key here
// is wired up to a real trigger point in the game (see audioManager.js's
// callers), but none of the files exist yet on disk. That's expected and
// safe: AudioManager treats a missing/404ing file as silence, not an
// error, so the game is fully playable with this whole folder empty. Drop
// a matching .mp3 or .wav at the listed path (either extension works - see
// AudioManager._loadBuffer's extension fallback) and it starts playing
// next time that key is triggered, with no code changes.
//
// Everything resolves under /public/audio/ (Vite serves /public/* from the
// site root, so 'music/menu' below is fetched from '/audio/music/menu.mp3').

const MUSIC_DIR = 'audio/music'
const SFX_DIR = 'audio/sfx'

// One base track per key, playing on loop. `layer` (optional) is a second
// file crossfaded in on top of the base as intensity rises (see
// AudioManager.setMusicIntensity) - e.g. a boss fight's music getting
// heavier as its health drops - without needing a whole extra set of
// per-phase tracks. Chapter mission tracks are keyed by chapterId
// (campaign/chapters.js) so "varies by chapter" falls out of the existing
// data rather than a separate mapping to maintain.
export const MUSIC_MANIFEST = {
  menu: { base: `${MUSIC_DIR}/menu` },
  freeplay: { base: `${MUSIC_DIR}/freeplay` },
  // Internal keys stay 'mission-chN' (musicKeyForChapter builds/looks these
  // up dynamically from chapterId) - only the file each resolves to is
  // named 'chapter-N.mp3' to match the project's audio-file convention.
  'mission-ch1': { base: `${MUSIC_DIR}/chapter-1` },
  'mission-ch2': { base: `${MUSIC_DIR}/chapter-2` },
  'mission-ch3': { base: `${MUSIC_DIR}/chapter-3` },
  'mission-ch4': { base: `${MUSIC_DIR}/chapter-4` },
  'mission-ch5': { base: `${MUSIC_DIR}/chapter-5` },
  boss: { base: `${MUSIC_DIR}/boss`, layer: `${MUSIC_DIR}/boss-intense` },
  'boss-final': { base: `${MUSIC_DIR}/boss-final`, layer: `${MUSIC_DIR}/boss-final-intense` },
  victory: { base: `${MUSIC_DIR}/victory` },
  defeat: { base: `${MUSIC_DIR}/defeat` },
}

// A mission's chapter picks its in-flight track; anything outside the 5
// numbered chapters (currently just the Titan's own chFinal) falls back to
// the last chapter's theme rather than a missing key.
export function musicKeyForChapter(chapterId) {
  return MUSIC_MANIFEST[`mission-${chapterId}`] ? `mission-${chapterId}` : 'mission-ch5'
}

// One file per sound (`fire`/`explosion` are stereotypically reused a lot
// in a single frame, hence AudioManager's per-key voice cap - see
// MAX_CONCURRENT_PER_KEY there).
export const SFX_MANIFEST = {
  gunfire: `${SFX_DIR}/gunfire`,
  missileFire: `${SFX_DIR}/missile-fire`,
  explosionSmall: `${SFX_DIR}/explosion-small`,
  explosionMedium: `${SFX_DIR}/explosion-medium`,
  explosionLarge: `${SFX_DIR}/explosion-large`,
  enemyDestroyed: `${SFX_DIR}/enemy-destroyed`,
  uiClick: `${SFX_DIR}/ui-click`,
  uiError: `${SFX_DIR}/ui-error`,
  missionComplete: `${SFX_DIR}/mission-complete`,
  missionFail: `${SFX_DIR}/mission-failed`,
  levelUp: `${SFX_DIR}/level-up`,
}

// Explosions are one SFX key picked by blast scale (EffectsManager.addExplosion's
// `scale`), not a separate call site per size - "Explosions (varies by
// size)" falls out of the one place every explosion in the game already
// goes through, rather than every caller needing to know which tier to ask
// for.
export function explosionSfxKeyForScale(scale) {
  if (scale >= 2) return 'explosionLarge'
  if (scale >= 1.2) return 'explosionMedium'
  return 'explosionSmall'
}
