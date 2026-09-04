# Audio files

Every file below is a **placeholder** - a real, present-on-disk, empty
(0-byte) stub. The game already fails gracefully on this: an empty file
fails to decode exactly like a missing one, so this whole folder can sit
empty-stub as it is right now and the game stays fully playable in
silence. `src/game/audio/audioManifest.js` is the source of truth this
list is generated from, and `src/game/audio/audioManager.js` is what loads
them (it tries `.mp3` first, then `.wav`, per file - use whichever your
export gives you, no code changes needed either way).

**To replace one:** export the matching track from Suno and drag it into
this folder (or the `music/`/`sfx/` subfolder), overwriting the placeholder
of the same name. Keep the filename exactly as listed (change only the
extension if you're using `.wav`) - the app fetches these by exact path.
While the dev server is running, either refresh the page or run
`window.__audioManager?.clearMissingCache()` in the browser console to
pick up a newly-dropped file without a full reload.

## music/ - one looping track per file

| File | Suno track to put here |
|---|---|
| `menu.mp3` | Ambient/epic main menu theme - the player's first impression, unhurried |
| `freeplay.mp3` | Driving action/combat loop for the open Free Play sandbox |
| `chapter-1.mp3` | Chapter 1, "First Light" - opening skirmish, tone-setting |
| `chapter-2.mp3` | Chapter 2, "The Blockade" - naval/patrol tension |
| `chapter-3.mp3` | Chapter 3, "Shadow Coast" - infiltration, quieter/tenser |
| `chapter-4.mp3` | Chapter 4, "Iron Tide" - full assault, biggest regular-chapter energy |
| `chapter-5.mp3` | Chapter 5, "Reckoning" - the campaign's climax before the finale |
| `boss.mp3` | Base theme for the 5 regular chapter boss fights |
| `boss-intense.mp3` | Optional second layer crossfaded on top of `boss.mp3` as a fight escalates (a chapter boss's "enrage" phase) - `boss.mp3` alone is a complete track without it |
| `boss-final.mp3` | The Titan (the endgame boss after Chapter 5) - distinct from the regular boss theme |
| `victory.mp3` | GameOver screen, mission/run succeeded |
| `defeat.mp3` | GameOver screen, mission/run failed |

(`boss-final-intense.mp3` is also supported as an optional layer for The
Titan, same idea as `boss-intense.mp3`, but isn't stubbed here since it's
purely optional - add it only if you want that extra layer.)

## sfx/ - one-shot sounds

| File | Suno track to put here |
|---|---|
| `gunfire.mp3` | Machine gun burst |
| `missile-fire.mp3` | Missile launch whoosh |
| `explosion-small.mp3` | Small blast (e.g. a grazing crash) |
| `explosion-medium.mp3` | Medium blast (a regular enemy kill) |
| `explosion-large.mp3` | Large blast (a boss going down) |
| `enemy-destroyed.mp3` | Short "kill confirmed" stinger, layered on top of the explosion |
| `mission-complete.mp3` | GameOver, success |
| `mission-failed.mp3` | GameOver, failure |
| `level-up.mp3` | Pilot level increases after a run |
| `ui-click.mp3` | Main menu button presses |
| `ui-error.mp3` | An invalid/blocked UI action (reserved for future use - not wired to a trigger yet) |

Export from Suno and drag files here to replace placeholders.
