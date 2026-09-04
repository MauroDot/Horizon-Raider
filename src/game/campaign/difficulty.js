// Easy/Normal/Hard: real multipliers applied at mission construction
// (EnemyManager's roster size/health, EnemyWeaponSystem's hit chance) and
// at reward time (missionGrading.js) - not just a label. `accuracy` scales
// the enemy weapon system's chance to actually take a shot when it has one
// lined up, not the player's own accuracy stat.
export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', enemyCountMultiplier: 0.7, enemyHealthMultiplier: 0.75, enemyAccuracy: 0.45, rewardMultiplier: 0.8 },
  { id: 'normal', label: 'Normal', enemyCountMultiplier: 1, enemyHealthMultiplier: 1, enemyAccuracy: 0.7, rewardMultiplier: 1 },
  { id: 'hard', label: 'Hard', enemyCountMultiplier: 1.4, enemyHealthMultiplier: 1.35, enemyAccuracy: 0.92, rewardMultiplier: 1.4 },
]

export const DEFAULT_DIFFICULTY = 'normal'

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]
}

// Easy is always open. Normal unlocks once the player has completed any
// mission at all (so the very first campaign attempt isn't gated). Hard
// unlocks per-mission, once THAT mission has been cleared at least once -
// "unlock higher difficulties after completing missions", read as
// rewarding replay with a harder/better-paying option rather than gating
// the whole tier globally.
export function isDifficultyUnlocked(difficultyId, missionId, campaign) {
  if (difficultyId === 'easy') return true
  if (difficultyId === 'normal') return Object.keys(campaign.completed).length > 0
  if (difficultyId === 'hard') return !!campaign.completed[missionId]
  return false
}
