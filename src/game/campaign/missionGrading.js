import { computeRunXp, computeRunCurrency } from '../progression.js'
import { getDifficulty } from './difficulty.js'

export const RANK_ORDER = ['C', 'B', 'A', 'S']

// Stars: 1 for clearing the primary objective, a 2nd for the mission's
// secondary objective (missions with none just get it for free alongside
// the 1st), a 3rd for finishing with at least half health - a flat,
// type-agnostic "did you actually take a beating doing it" bonus that
// works the same whether the mission was a firefight, an escort, or a
// stealth sweep.
export function computeStars({ success, secondaryComplete, hasSecondary, healthFraction }) {
  if (!success) return 0
  let stars = 1
  if (!hasSecondary || secondaryComplete) stars = 2
  if (stars === 2 && healthFraction >= 0.5) stars = 3
  return stars
}

// Rank blends the star result with shot accuracy, so a flawless-objective
// run with poor gunnery doesn't automatically top a clean, accurate one.
export function computeRank({ success, stars, accuracy }) {
  if (!success) return null
  if (stars === 3 && accuracy >= 80) return 'S'
  if (stars === 3 || (stars === 2 && accuracy >= 70)) return 'A'
  if (stars === 2 || (stars === 1 && accuracy >= 50)) return 'B'
  return 'C'
}

// Full grade for a finished mission run: stars, rank, and the XP/credits it
// pays out. Reuses progression.js's base kill/accuracy/score formulas, then
// layers the difficulty's reward multiplier and a small per-star bonus on
// top - so Hard + a 3-star clear meaningfully outpays Easy + a bare pass.
export function gradeMission({ mission, difficultyId, success, secondaryComplete, stats, healthFraction }) {
  const difficulty = getDifficulty(difficultyId)
  const hasSecondary = !!mission.secondaryObjective
  const stars = computeStars({ success, secondaryComplete, hasSecondary, healthFraction })
  const rank = computeRank({ success, stars, accuracy: stats.accuracy })

  const outcome = success ? 'missionComplete' : 'died'
  const baseXp = computeRunXp({ kills: stats.kills, accuracy: stats.accuracy, outcome })
  const baseCurrency = computeRunCurrency({ score: stats.score, outcome })
  const starMultiplier = 1 + stars * 0.15

  return {
    stars,
    rank,
    success,
    xp: Math.round(baseXp * difficulty.rewardMultiplier * starMultiplier),
    currency: Math.round(baseCurrency * difficulty.rewardMultiplier * starMultiplier),
  }
}

// Merges a new grade into a mission's best-ever record (persistentStore's
// campaign.completed[missionId]) - keeps the best score/stars/rank seen
// across every attempt/difficulty, and which difficulties have been cleared
// at least once (feeds difficulty.js's Hard-unlock check and a bit of
// CampaignView polish).
export function mergeBestRecord(prev, { score, stars, rank, difficultyId }) {
  const prevRankIndex = prev?.bestRank ? RANK_ORDER.indexOf(prev.bestRank) : -1
  const rankIndex = rank ? RANK_ORDER.indexOf(rank) : -1
  const difficultiesCleared = new Set(prev?.difficultiesCleared ?? [])
  difficultiesCleared.add(difficultyId)
  return {
    bestScore: Math.max(prev?.bestScore ?? 0, score),
    bestStars: Math.max(prev?.bestStars ?? 0, stars),
    bestRank: rankIndex > prevRankIndex ? rank : (prev?.bestRank ?? rank),
    difficultiesCleared: [...difficultiesCleared],
  }
}
