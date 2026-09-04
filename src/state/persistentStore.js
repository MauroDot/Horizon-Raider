import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_LOADOUT } from '../game/loadouts.js'
import { DEFAULT_HELICOPTER, HELICOPTERS } from '../game/helicopters.js'
import { BOOSTERS, getBooster } from '../game/boosters.js'
import { levelForTotalXp, xpProgress, computeRunXp, computeRunCurrency } from '../game/progression.js'
import { mergeBestRecord } from '../game/campaign/missionGrading.js'

const MAX_LEADERBOARD_ENTRIES = 10
const DEFAULT_HELICOPTER_COLOR = '#3b5b7a'

const INITIAL_CAMPAIGN = { unlockedIndex: 0, completed: {} }
const INITIAL_STATS = {
  gamesPlayed: 0,
  totalKills: 0,
  bestFreePlayScore: 0,
  totalPlaytimeSeconds: 0,
  totalShotsFired: 0,
  totalShotsHit: 0,
  lifetimeAccuracy: 0,
}
const INITIAL_CUSTOMIZATION = {
  helicopterColor: DEFAULT_HELICOPTER_COLOR,
  loadout: DEFAULT_LOADOUT,
  helicopterId: DEFAULT_HELICOPTER,
}
const INITIAL_UNLOCKS = { paintColors: [], helicopters: [DEFAULT_HELICOPTER], bossTrophies: [] }
const INITIAL_PROGRESSION = { totalXp: 0 }
const INITIAL_BOOSTER_INVENTORY = Object.fromEntries(BOOSTERS.map((b) => [b.id, 0]))
const BOSS_BOUNTY_CREDITS = 100 // flat guaranteed bonus on every boss-mission clear, on top of the normal grade

// Three separate leaderboards, each with its own top-10 ranking metric:
// 'freePlay' by score (desc), 'speedrun' by mission completion time (asc -
// fastest wins), 'overall' by kills (desc) as the one always-eligible
// "how good was this run" catch-all (a run's kills/accuracy/playtime are
// meaningful whether or not it succeeded, unlike score or completion time).
const INITIAL_LEADERBOARD = { freePlay: [], speedrun: [], overall: [] }
const LEADERBOARD_SORT = {
  freePlay: (a, b) => b.score - a.score,
  speedrun: (a, b) => a.timeSeconds - b.timeSeconds,
  overall: (a, b) => b.kills - a.kills,
}
const PROGRESS_STORAGE_KEY = 'horizon-raider:progress'

// Paint colors unlocked by pilot level - "Each level unlocks new
// customization options". Levels line up with the helicopter unlocks
// (helicopters.js) so a level-up milestone reads as one coherent reward,
// not two disconnected systems.
export const UNLOCKABLE_COLORS = [
  { id: 'reaperRed', label: 'Reaper Red', color: '#5c1a1a', requiredLevel: 5 },
  { id: 'stealthCharcoal', label: 'Stealth Charcoal', color: '#24262b', requiredLevel: 10 },
  { id: 'arcticWhite', label: 'Arctic White', color: '#d8dce2', requiredLevel: 20 },
  { id: 'warlordGold', label: 'Warlord Gold', color: '#c9a02c', requiredLevel: 30 },
]

// "Boss drops rare unlocks/rewards on defeat" - one exclusive paint color
// per boss (matching that boss's own glow color from missions.js), unlocked
// permanently the first time that specific boss mission is cleared. Kept in
// its own `unlocks.bossTrophies` array rather than folded into
// `unlocks.paintColors` - that one is recomputed wholesale from level every
// recordRun (see unlockedColorIds), which would silently drop a
// non-level-derived trophy id right back out.
export const BOSS_TROPHY_COLORS = [
  { id: 'trophyVanguard', missionId: 'c1m4', label: 'Reaper Trophy', color: '#ff5522' },
  { id: 'trophyWarden', missionId: 'c2m4', label: 'Warden Trophy', color: '#3fa8ff' },
  { id: 'trophyNightshade', missionId: 'c3m4', label: 'Nightshade Trophy', color: '#9d3fff' },
  { id: 'trophyBehemoth', missionId: 'c4m4', label: 'Behemoth Trophy', color: '#ffcc22' },
  { id: 'trophyTalon', missionId: 'c5m4', label: 'Talon Trophy', color: '#ff2244' },
  { id: 'trophyTitan', missionId: 'final-titan', label: 'Titan Trophy', color: '#7fffe6' },
]

function unlockedColorIds(level) {
  return UNLOCKABLE_COLORS.filter((c) => level >= c.requiredLevel).map((c) => c.id)
}

function unlockedHelicopterIds(level) {
  return HELICOPTERS.filter((h) => level >= h.requiredLevel).map((h) => h.id)
}

// The persistence layer: campaign progress, local leaderboard, lifetime
// stats, pilot progression (XP/level/currency), and cosmetic customization -
// everything that should survive a page reload, as opposed to gameStore's
// in-memory mode machine. Backed by localStorage via zustand's `persist`
// middleware (one JSON blob, same approach as controlConfig.js's hand-rolled
// version, just using the library's built-in equivalent here since this
// state is simpler/flatter). This auto-persists continuously (every set()
// flushes to localStorage) - that alone is what makes progress survive a
// page refresh. saveStore.js layers named, explicit save slots on top of
// this; it only ever touches this store via `getSnapshot()` (capture) and
// `hydrate()` (load), never automatically on boot, so loading a slot is
// always a deliberate action.
export const usePersistentStore = create(
  persist(
    (set, get) => ({
      campaign: INITIAL_CAMPAIGN,
      leaderboard: INITIAL_LEADERBOARD,
      stats: INITIAL_STATS,
      customization: INITIAL_CUSTOMIZATION,
      unlocks: INITIAL_UNLOCKS,
      progression: INITIAL_PROGRESSION,
      currency: 0,
      boosterInventory: INITIAL_BOOSTER_INVENTORY,
      // Rewards from the most recently recorded run, for GameOver to show
      // ("+120 XP, +30 credits, LEVEL UP!") - transient, not part of what
      // save slots capture.
      lastRunRewards: null,
      // Which entry id was just submitted to each leaderboard category this
      // session - LeaderboardView highlights these as "your" rank. Transient
      // (not part of a save slot's snapshot), same as lastRunRewards.
      lastSubmittedIds: { freePlay: null, speedrun: null, overall: null },

      // `run` is gameStore's lastRunStats shape plus `missionIndex` (the
      // campaign's position in MISSIONS, so completing it can unlock the
      // next one) when it came from a mission. Also carries `playtimeSeconds`,
      // `shotsFired`, `shotsHit` from score.js's extended snapshot() so
      // lifetime totals/accuracy can accumulate here.
      //
      // A campaign run additionally carries the already-computed mission
      // grade (`stars`/`rank`/`xpGain`/`currencyGain`/`difficultyId`) from
      // GameScreen.jsx's gradeMission() call - it has the mission/difficulty
      // context this store doesn't need to duplicate. When those are absent
      // (Free Play has no mission to grade), XP/currency fall back to the
      // plain kill/accuracy/score formula and no campaign.completed record
      // is written.
      recordRun: (run) =>
        set((s) => {
          const totalShotsFired = s.stats.totalShotsFired + (run.shotsFired ?? 0)
          const totalShotsHit = s.stats.totalShotsHit + (run.shotsHit ?? 0)
          const stats = {
            gamesPlayed: s.stats.gamesPlayed + 1,
            totalKills: s.stats.totalKills + run.kills,
            bestFreePlayScore: run.missionId ? s.stats.bestFreePlayScore : Math.max(s.stats.bestFreePlayScore, run.score),
            totalPlaytimeSeconds: s.stats.totalPlaytimeSeconds + (run.playtimeSeconds ?? 0),
            totalShotsFired,
            totalShotsHit,
            lifetimeAccuracy: totalShotsFired > 0 ? (totalShotsHit / totalShotsFired) * 100 : 0,
          }

          let campaign = s.campaign
          if (run.missionId && run.outcome === 'missionComplete') {
            const prevRecord = s.campaign.completed[run.missionId]
            const record =
              run.stars != null
                ? mergeBestRecord(prevRecord, {
                    score: run.score,
                    stars: run.stars,
                    rank: run.rank,
                    difficultyId: run.difficultyId ?? 'normal',
                  })
                : { bestScore: Math.max(prevRecord?.bestScore ?? 0, run.score) }
            campaign = {
              unlockedIndex: Math.max(s.campaign.unlockedIndex, run.missionIndex + 1),
              completed: { ...s.campaign.completed, [run.missionId]: record },
            }
          }

          // Boss bounty: a flat currency bonus plus a one-time exclusive
          // trophy paint color, on any boss-mission clear.
          let bossBounty = 0
          let bossTrophies = s.unlocks.bossTrophies
          let newTrophy = null
          if (run.missionId && run.outcome === 'missionComplete' && run.isBossMission) {
            bossBounty = BOSS_BOUNTY_CREDITS
            const trophy = BOSS_TROPHY_COLORS.find((t) => t.missionId === run.missionId)
            if (trophy && !bossTrophies.includes(trophy.id)) {
              bossTrophies = [...bossTrophies, trophy.id]
              newTrophy = trophy
            }
          }

          const xpGain = run.xpGain ?? computeRunXp({ kills: run.kills, accuracy: run.accuracy, outcome: run.outcome })
          const currencyGain =
            (run.currencyGain ?? computeRunCurrency({ score: run.score, outcome: run.outcome })) + bossBounty
          const previousLevel = levelForTotalXp(s.progression.totalXp)
          const totalXp = s.progression.totalXp + xpGain
          const level = levelForTotalXp(totalXp)

          const unlocks = { paintColors: unlockedColorIds(level), helicopters: unlockedHelicopterIds(level), bossTrophies }

          return {
            stats,
            campaign,
            unlocks,
            progression: { totalXp },
            currency: s.currency + currencyGain,
            lastRunRewards: {
              xpGain,
              currencyGain,
              level,
              leveledUp: level > previousLevel,
              stars: run.stars ?? null,
              rank: run.rank ?? null,
              newTrophy,
            },
          }
        }),

      // `category` is 'freePlay' | 'speedrun' | 'overall' (see
      // LEADERBOARD_SORT above for what each ranks by). Returns the new
      // entry's id (or null for an unknown category) so the caller can
      // highlight it as "your" rank - also recorded in `lastSubmittedIds`
      // for LeaderboardView to read back later without threading the id
      // through props.
      submitScore: (category, entry) => {
        const sortFn = LEADERBOARD_SORT[category]
        if (!sortFn) return null
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        const record = { ...entry, id, date: Date.now() }
        set((s) => ({
          leaderboard: {
            ...s.leaderboard,
            [category]: [...s.leaderboard[category], record].sort(sortFn).slice(0, MAX_LEADERBOARD_ENTRIES),
          },
          lastSubmittedIds: { ...s.lastSubmittedIds, [category]: id },
        }))
        return id
      },

      // Clears one category, or all three if none given ("Clear data
      // option (for testing)").
      clearLeaderboard: (category) =>
        set((s) => ({
          leaderboard: category ? { ...s.leaderboard, [category]: [] } : INITIAL_LEADERBOARD,
        })),

      // Re-reads the leaderboard straight from localStorage - since it's
      // genuinely shared browser-wide storage, another tab open on this
      // same game can submit/clear scores independently of this tab's
      // in-memory copy. A real "Refresh" action for a local leaderboard
      // means "pick up whatever's actually on disk now", not a no-op.
      refreshLeaderboard: () => {
        try {
          const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
          if (!raw) return
          const stored = JSON.parse(raw)?.state?.leaderboard
          if (stored && !Array.isArray(stored)) {
            set((s) => ({ leaderboard: { ...s.leaderboard, ...stored } }))
          }
        } catch {
          // localStorage unavailable, or the stored blob is corrupt/from an
          // older schema - leave the current in-memory state as-is.
        }
      },

      setHelicopterColor: (color) =>
        set((s) => ({ customization: { ...s.customization, helicopterColor: color } })),

      setLoadout: (loadout) =>
        set((s) => ({ customization: { ...s.customization, loadout } })),

      setHelicopter: (helicopterId) =>
        set((s) => ({ customization: { ...s.customization, helicopterId } })),

      // Spends currency for one more charge of a booster type - refuses
      // silently (returns false) if the player can't afford it, rather than
      // going negative.
      purchaseBooster: (id) => {
        const def = getBooster(id)
        const { currency, boosterInventory } = get()
        if (!def || currency < def.cost) return false
        set({
          currency: currency - def.cost,
          boosterInventory: { ...boosterInventory, [id]: (boosterInventory[id] ?? 0) + 1 },
        })
        return true
      },

      // Called live, mid-run, when BoosterController actually consumes a
      // charge (see GameScreen.jsx's onBoosterUse) - deducts immediately so
      // a closed tab mid-mission doesn't refund an already-used charge.
      consumeBoosterCharge: (id) =>
        set((s) => ({
          boosterInventory: { ...s.boosterInventory, [id]: Math.max(0, (s.boosterInventory[id] ?? 0) - 1) },
        })),

      resetProgress: () =>
        set({
          campaign: INITIAL_CAMPAIGN,
          stats: INITIAL_STATS,
          unlocks: INITIAL_UNLOCKS,
          progression: INITIAL_PROGRESSION,
          currency: 0,
          boosterInventory: INITIAL_BOOSTER_INVENTORY,
        }),

      isMissionUnlocked: (missionIndex) => missionIndex <= get().campaign.unlockedIndex,

      getProgress: () => xpProgress(get().progression.totalXp),

      // Plain, JSON-serializable copy of everything a save slot should
      // capture. Deep-cloned (via JSON round-trip) so a slot snapshot can't
      // alias live state - mutating the store later must never retroactively
      // change an already-saved slot.
      getSnapshot: () => {
        const { campaign, leaderboard, stats, customization, unlocks, progression, currency, boosterInventory } = get()
        return JSON.parse(
          JSON.stringify({ campaign, leaderboard, stats, customization, unlocks, progression, currency, boosterInventory }),
        )
      },

      // Replaces live progress with a save slot's captured data (used by
      // saveStore.loadSave). Falls back to defaults for any field the slot
      // predates, so loading an older save format doesn't crash.
      hydrate: (data) =>
        set({
          campaign: data?.campaign ?? INITIAL_CAMPAIGN,
          // A save slot from before the 3-category leaderboard existed has
          // `leaderboard` as a flat array (or nothing at all) - normalize
          // either back to the current {freePlay,speedrun,overall} shape
          // rather than crash every leaderboard.freePlay/.speedrun/.overall
          // read downstream.
          leaderboard:
            data?.leaderboard && !Array.isArray(data.leaderboard)
              ? { ...INITIAL_LEADERBOARD, ...data.leaderboard }
              : INITIAL_LEADERBOARD,
          stats: { ...INITIAL_STATS, ...data?.stats },
          customization: { ...INITIAL_CUSTOMIZATION, ...data?.customization },
          unlocks: { ...INITIAL_UNLOCKS, ...data?.unlocks },
          progression: { ...INITIAL_PROGRESSION, ...data?.progression },
          currency: data?.currency ?? 0,
          boosterInventory: { ...INITIAL_BOOSTER_INVENTORY, ...data?.boosterInventory },
          lastRunRewards: null,
          lastSubmittedIds: { freePlay: null, speedrun: null, overall: null },
        }),
    }),
    {
      name: PROGRESS_STORAGE_KEY,
      // zustand's default rehydration merge is a SHALLOW `{...current, ...persisted}`
      // - it replaces nested objects (customization, unlocks, stats, ...) wholesale
      // rather than merging their keys. A localStorage blob saved by an older build
      // (before a field like unlocks.helicopters or progression existed) would then
      // wipe that field back to `undefined` on load instead of falling back to the
      // current default, and a component reading it (e.g. `unlocks.helicopters.includes`)
      // would throw during render - with no error boundary, that blanks the whole
      // page. Mirrors hydrate()'s own per-field fallbacks so an old save format loads
      // safely both through an explicit slot load AND through this automatic one.
      merge: (persisted, current) => {
        const p = persisted ?? {}
        return {
          ...current,
          ...p,
          stats: { ...current.stats, ...p.stats },
          customization: { ...current.customization, ...p.customization },
          unlocks: { ...current.unlocks, ...p.unlocks },
          progression: { ...current.progression, ...p.progression },
          boosterInventory: { ...current.boosterInventory, ...p.boosterInventory },
          // A pre-3-category localStorage blob has `leaderboard` as a flat
          // array - don't spread that over the {freePlay,speedrun,overall}
          // shape (it would silently replace it and every `.freePlay` read
          // downstream would throw). Just keep the current default in that
          // case; a normal, current-shape blob still merges per-category.
          leaderboard: p.leaderboard && !Array.isArray(p.leaderboard) ? { ...current.leaderboard, ...p.leaderboard } : current.leaderboard,
        }
      },
    },
  ),
)
