import { useState } from 'react'
import { usePersistentStore } from '../state/persistentStore.js'
import { getChapter } from '../game/campaign/chapters.js'
import { describePrimaryObjective, describeSecondaryObjective } from '../game/campaign/missions.js'
import { DIFFICULTIES, DEFAULT_DIFFICULTY, isDifficultyUnlocked } from '../game/campaign/difficulty.js'
import { Stars } from './Stars.jsx'

const TYPE_LABELS = {
  destroy: 'DESTROY TARGET',
  escort: 'ESCORT',
  survive: 'SURVIVE',
  recon: 'RECONNAISSANCE',
  boss: 'BOSS BATTLE',
}

// Pre-mission briefing: story context, primary/secondary objectives, and
// the Easy/Normal/Hard difficulty pick - the spec's "mission briefing
// screen with story context" and "Difficulty scaling ... Unlock higher
// difficulties after completing missions" in one place. Reached from
// CampaignView's mission list, replaces the old direct-launch button.
export function MissionBriefing({ mission, onBack, onStart }) {
  const chapter = getChapter(mission.chapterId)
  const campaign = usePersistentStore((s) => s.campaign)
  const record = campaign.completed[mission.id]
  const [difficultyId, setDifficultyId] = useState(DEFAULT_DIFFICULTY)

  const secondary = describeSecondaryObjective(mission)

  return (
    <div className="main-menu-panel briefing-panel">
      <span className="briefing-chapter">{chapter?.name}</span>
      <h1>{mission.name}</h1>
      <span className={`briefing-type-badge type-${mission.type}`}>{TYPE_LABELS[mission.type]}</span>

      <p className="briefing-text">{mission.briefing}</p>

      <div className="briefing-objectives">
        <div className="briefing-objective-row">
          <span className="briefing-objective-label">PRIMARY</span>
          <span>{describePrimaryObjective(mission)}</span>
        </div>
        {secondary && (
          <div className="briefing-objective-row secondary">
            <span className="briefing-objective-label">SECONDARY</span>
            <span>{secondary}</span>
          </div>
        )}
      </div>

      {record && (
        <div className="briefing-record">
          Best: <Stars count={record.bestStars ?? 0} /> {record.bestRank && <span className="briefing-rank">{record.bestRank}</span>}{' '}
          <span className="briefing-record-score">Score {record.bestScore}</span>
        </div>
      )}

      <div className="briefing-difficulty">
        <span className="briefing-objective-label">DIFFICULTY</span>
        <div className="difficulty-options">
          {DIFFICULTIES.map((d) => {
            const unlocked = isDifficultyUnlocked(d.id, mission.id, campaign)
            return (
              <button
                key={d.id}
                type="button"
                className={`difficulty-option${difficultyId === d.id ? ' selected' : ''}`}
                disabled={!unlocked}
                onClick={() => setDifficultyId(d.id)}
                title={unlocked ? d.label : `Complete this mission once to unlock ${d.label}`}
              >
                {d.label}
                {!unlocked && ' 🔒'}
              </button>
            )
          })}
        </div>
      </div>

      <div className="main-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" className="briefing-start" onClick={() => onStart(difficultyId)}>
          {record ? 'Replay Mission' : 'Start Mission'}
        </button>
      </div>
    </div>
  )
}
