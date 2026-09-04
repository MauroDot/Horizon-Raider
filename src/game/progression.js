// Pilot leveling: XP is earned per run (mission or free play) based on
// kills and accuracy, and accumulates into a level via a cumulative curve.
// Level is always *derived* from total XP rather than stored separately -
// one source of truth, no way for the two to drift out of sync.
export const MAX_LEVEL = 50

// XP required to go from level N to N+1 - grows with level so early levels
// (and their unlocks) come quickly, later ones stretch out toward 50.
function xpForLevel(level) {
  return Math.round(100 * Math.pow(level, 1.5))
}

// Cumulative total XP needed to REACH level N (index N-1). Precomputed once
// - CUMULATIVE_XP[0] is level 1's floor (0), CUMULATIVE_XP[MAX_LEVEL-1] is
// the floor of the max level.
const CUMULATIVE_XP = [0]
for (let level = 1; level < MAX_LEVEL; level++) {
  CUMULATIVE_XP.push(CUMULATIVE_XP[level - 1] + xpForLevel(level))
}

export function levelForTotalXp(totalXp) {
  let level = 1
  for (let i = 1; i < CUMULATIVE_XP.length; i++) {
    if (totalXp < CUMULATIVE_XP[i]) break
    level = i + 1
  }
  return Math.min(level, MAX_LEVEL)
}

// Progress within the current level, for an XP bar: { level, current,
// needed, fraction }. At MAX_LEVEL there's nothing further to earn toward,
// so it reports a full bar rather than dividing by zero.
export function xpProgress(totalXp) {
  const level = levelForTotalXp(totalXp)
  if (level >= MAX_LEVEL) return { level, current: 0, needed: 0, fraction: 1 }
  const floor = CUMULATIVE_XP[level - 1]
  const ceil = CUMULATIVE_XP[level]
  return { level, current: totalXp - floor, needed: ceil - floor, fraction: (totalXp - floor) / (ceil - floor) }
}

const XP_PER_KILL = 20
const XP_COMPLETION_BONUS = 25 // every run earns something, even a rough one
const XP_MISSION_BONUS = 50

// Accuracy scales the kill XP by 0.6x (0% hits) to 1.4x (100% hits) -
// rewards actually landing shots without zeroing out a run that had kills
// but sloppy aim.
export function computeRunXp({ kills, accuracy, outcome }) {
  const accuracyMultiplier = 0.6 + (Math.min(Math.max(accuracy, 0), 100) / 100) * 0.8
  let xp = Math.round(kills * XP_PER_KILL * accuracyMultiplier) + XP_COMPLETION_BONUS
  if (outcome === 'missionComplete') xp += XP_MISSION_BONUS
  return xp
}

// Currency ("earned currency/resources" for boosters) is a separate track
// from XP, scaled off score instead of kills/accuracy directly - so a long
// evasive run that racks up score without much shooting still earns some.
const CURRENCY_PER_SCORE = 0.1
const CURRENCY_COMPLETION_BONUS = 10

export function computeRunCurrency({ score, outcome }) {
  let currency = Math.round(score * CURRENCY_PER_SCORE)
  if (outcome === 'missionComplete') currency += CURRENCY_COMPLETION_BONUS
  return currency
}
