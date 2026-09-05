import { useEffect, useState } from 'react'
import { usePersistentStore } from '../state/persistentStore.js'
import { MISSIONS, describeSecondaryObjective, isChapterFinale } from '../game/campaign/missions.js'
import { getChapter, getChapterIndex, CHAPTERS } from '../game/campaign/chapters.js'
import { Stars } from './Stars.jsx'
import './GameOver.css'

const TITLES = {
  died: 'AIRCRAFT DESTROYED',
  missionComplete: 'MISSION COMPLETE',
  escortLost: 'ESCORT DESTROYED',
  detected: 'COVER BLOWN',
  quit: 'SESSION ENDED',
}

const FAILURE_NOTES = {
  escortLost: 'The NPC helicopter you were protecting went down.',
  detected: 'A Compact patrol spotted you before the sweep was finished.',
}

const CATEGORY_LABELS = {
  freePlay: 'Free Play High Scores',
  speedrun: 'Campaign Speed Run',
  overall: 'Overall Stats',
}

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Rare, discrete event (not a 60fps telemetry stream) so this one is plain
// React state/props, unlike Hud's imperative update loop.
export function GameOver({ stats, audioManager, onRetry, onMenu }) {
  const submitScore = usePersistentStore((s) => s.submitScore)
  const rewards = usePersistentStore((s) => s.lastRunRewards)
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const mission = stats.missionId ? MISSIONS.find((m) => m.id === stats.missionId) : null
  const success = stats.outcome === 'missionComplete'

  // Runs exactly once per GameOver appearance (GameScreen mounts a fresh
  // instance each time gameStore.mode becomes GAME_OVER) - the "Game over
  // (defeat or victory theme)" music crossfade, the matching result SFX,
  // and a level-up chime layered on top when this run's XP crossed a level.
  useEffect(() => {
    audioManager?.playMusic(success ? 'victory' : 'defeat')
    audioManager?.playSfx(success ? 'missionComplete' : 'missionFail')
    if (rewards?.leveledUp) audioManager?.playSfx('levelUp')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const campaignComplete = success && mission?.finalBoss
  const title = campaignComplete ? 'THE TITAN IS DOWN' : TITLES[stats.outcome] ?? TITLES.died
  const secondaryText = mission ? describeSecondaryObjective(mission) : null
  const completeLine = mission?.radio?.find((r) => r.trigger === 'complete')?.text
  // The Titan's own single-mission "chapter" (chFinal) would otherwise also
  // satisfy isChapterFinale() - it gets the bigger, distinct ending-sequence
  // panel below instead of the normal per-chapter cutscene.
  const chapterComplete = success && mission && !mission.finalBoss && isChapterFinale(mission.id)
  const chapter = chapterComplete ? getChapter(mission.chapterId) : null
  const nextChapter = chapterComplete ? CHAPTERS[getChapterIndex(mission.chapterId) + 1] : null
  const ending = campaignComplete ? getChapter('chFinal') : null

  // Which of the 3 leaderboards this run can post to: Free Play only makes
  // sense for a Free Play run, Speed Run only for an actually-completed
  // mission (a failed attempt has no meaningful "completion time"), and
  // Overall Stats always - kills/accuracy/playtime are real numbers
  // whether or not the run succeeded.
  const eligibleCategories = [
    ...(!mission ? ['freePlay'] : []),
    ...(mission && success ? ['speedrun'] : []),
    'overall',
  ]

  function submit(e) {
    e.preventDefault()
    if (submitted) return
    const submitName = name.trim().slice(0, 16) || 'Player'
    const base = { name: submitName, difficultyId: stats.difficultyId ?? null }
    for (const category of eligibleCategories) {
      if (category === 'freePlay') {
        submitScore('freePlay', { ...base, score: stats.score, kills: stats.kills, accuracy: stats.accuracy })
      } else if (category === 'speedrun') {
        submitScore('speedrun', {
          ...base,
          missionName: mission.name,
          timeSeconds: stats.playtimeSeconds,
          stars: stats.grade?.stars ?? 0,
          rank: stats.grade?.rank ?? null,
        })
      } else {
        submitScore('overall', {
          ...base,
          kills: stats.kills,
          accuracy: stats.accuracy,
          playtimeSeconds: stats.playtimeSeconds,
          mode: mission ? 'Campaign' : 'Free Play',
          missionName: mission?.name ?? null,
        })
      }
    }
    setSubmitted(true)
  }

  return (
    <div className="game-over">
      <div className="game-over-panel">
        <h1 className={success ? 'success' : ''}>{title}</h1>
        {mission && <p className="game-over-mission">{mission.name}</p>}
        {!success && FAILURE_NOTES[stats.outcome] && <p className="game-over-fail-note">{FAILURE_NOTES[stats.outcome]}</p>}

        {stats.grade && (
          <div className="game-over-grade">
            <Stars count={stats.grade.stars} />
            {stats.grade.rank && <span className="rank-badge large">{stats.grade.rank}</span>}
          </div>
        )}

        <div className="game-over-stats">
          <div>
            <span className="game-over-label">Kills</span>
            <span className="game-over-value">{stats.kills}</span>
          </div>
          <div>
            <span className="game-over-label">Score</span>
            <span className="game-over-value">{stats.score}</span>
          </div>
          <div>
            <span className="game-over-label">Accuracy</span>
            <span className="game-over-value">{stats.accuracy.toFixed(0)}%</span>
          </div>
          {mission && success && (
            <div>
              <span className="game-over-label">Time</span>
              <span className="game-over-value">{formatClock(stats.playtimeSeconds)}</span>
            </div>
          )}
        </div>

        {secondaryText && (
          <p className={`game-over-secondary${stats.secondaryComplete ? ' met' : ''}`}>
            {stats.secondaryComplete ? '✓' : '✗'} {secondaryText}
          </p>
        )}

        {success && completeLine && <p className="game-over-radio">"{completeLine}"</p>}

        {rewards && (
          <div className="game-over-rewards">
            <span>+{rewards.xpGain} XP</span>
            <span>+{rewards.currencyGain} credits</span>
            {rewards.leveledUp && <span className="game-over-levelup">LEVEL UP! Now level {rewards.level}</span>}
          </div>
        )}

        {rewards?.newTrophy && (
          <p className="game-over-trophy">
            🏆 New unlock: <strong>{rewards.newTrophy.label}</strong> paint
          </p>
        )}

        {chapterComplete && (
          <div className="game-over-chapter">
            <h2>{chapter.name} - COMPLETE</h2>
            <p>{chapter.outro}</p>
            {nextChapter && <p className="game-over-chapter-next">Next: {nextChapter.name}</p>}
          </div>
        )}

        {campaignComplete && (
          <div className="game-over-ending">
            <h2>CAMPAIGN COMPLETE</h2>
            <p>{ending.outro}</p>
          </div>
        )}

        <form className="game-over-submit-block" onSubmit={submit}>
          {submitted ? (
            <p className="game-over-submitted">
              Submitted to: {eligibleCategories.map((c) => CATEGORY_LABELS[c]).join(', ')}.
            </p>
          ) : (
            <>
              <p className="game-over-submit-note">
                Eligible for: {eligibleCategories.map((c) => CATEGORY_LABELS[c]).join(', ')}
              </p>
              <div className="game-over-submit">
                <input
                  type="text"
                  placeholder="Player"
                  value={name}
                  maxLength={16}
                  onChange={(e) => setName(e.target.value)}
                />
                <button type="submit">Submit Score</button>
              </div>
            </>
          )}
        </form>

        <div className="game-over-actions">
          <button type="button" className="game-over-restart" onClick={onRetry}>
            {mission ? 'Retry Mission' : 'Retry'}
          </button>
          <button type="button" className="game-over-menu" onClick={onMenu}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  )
}
