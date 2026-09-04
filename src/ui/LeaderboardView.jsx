import { useState } from 'react'
import { usePersistentStore } from '../state/persistentStore.js'
import { Stars } from './Stars.jsx'
import './LeaderboardView.css'

const CATEGORIES = [
  { id: 'freePlay', label: 'Free Play' },
  { id: 'speedrun', label: 'Speed Run' },
  { id: 'overall', label: 'Overall Stats' },
]

const DIFFICULTY_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }

function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function formatPlaytime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// Local-only (localStorage via persistentStore) - no backend, so "submit"
// just means "save to this browser" (see the FUTURE note in GameOver.jsx's
// spec: an eventual global leaderboard would swap this store's actions for
// API calls without the UI needing to change shape). Three ranked
// categories - Free Play (by score), Speed Run (by mission completion
// time, fastest first), Overall Stats (by kills, the one metric that's
// meaningful whether or not a run actually succeeded).
export function LeaderboardView({ onBack }) {
  const [category, setCategory] = useState('freePlay')
  const [confirmClear, setConfirmClear] = useState(false)
  const leaderboard = usePersistentStore((s) => s.leaderboard)
  const lastSubmittedIds = usePersistentStore((s) => s.lastSubmittedIds)
  const clearLeaderboard = usePersistentStore((s) => s.clearLeaderboard)
  const refreshLeaderboard = usePersistentStore((s) => s.refreshLeaderboard)

  const entries = leaderboard[category] ?? []
  const highlightId = lastSubmittedIds?.[category]

  const selectCategory = (id) => {
    setCategory(id)
    setConfirmClear(false)
  }

  const handleClear = () => {
    if (confirmClear) {
      clearLeaderboard(category)
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
    }
  }

  return (
    <div className="leaderboard-view">
      <h1>LEADERBOARD</h1>
      <div className="leaderboard-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`leaderboard-tab${category === c.id ? ' active' : ''}`}
            onClick={() => selectCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="leaderboard-empty">No entries yet - fly a run and submit yours from the results screen.</p>
      ) : (
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              {category === 'freePlay' && (
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Kills</th>
                  <th>Acc</th>
                  <th>Date</th>
                </tr>
              )}
              {category === 'speedrun' && (
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Mission</th>
                  <th>Time</th>
                  <th>Stars</th>
                  <th>Difficulty</th>
                  <th>Date</th>
                </tr>
              )}
              {category === 'overall' && (
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Kills</th>
                  <th>Acc</th>
                  <th>Playtime</th>
                  <th>Mode</th>
                  <th>Difficulty</th>
                  <th>Date</th>
                </tr>
              )}
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.id} className={entry.id === highlightId ? 'you' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    {entry.name}
                    {entry.id === highlightId && <span className="leaderboard-you-tag">YOU</span>}
                  </td>
                  {category === 'freePlay' && (
                    <>
                      <td>{entry.score}</td>
                      <td>{entry.kills}</td>
                      <td>{entry.accuracy.toFixed(0)}%</td>
                      <td>{formatDate(entry.date)}</td>
                    </>
                  )}
                  {category === 'speedrun' && (
                    <>
                      <td>{entry.missionName}</td>
                      <td>{formatClock(entry.timeSeconds)}</td>
                      <td>
                        <Stars count={entry.stars ?? 0} />
                      </td>
                      <td>{DIFFICULTY_LABELS[entry.difficultyId] ?? '—'}</td>
                      <td>{formatDate(entry.date)}</td>
                    </>
                  )}
                  {category === 'overall' && (
                    <>
                      <td>{entry.kills}</td>
                      <td>{entry.accuracy.toFixed(0)}%</td>
                      <td>{formatPlaytime(entry.playtimeSeconds)}</td>
                      <td>{entry.missionName ?? entry.mode}</td>
                      <td>{DIFFICULTY_LABELS[entry.difficultyId] ?? '—'}</td>
                      <td>{formatDate(entry.date)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="leaderboard-actions">
        <button
          type="button"
          onClick={() => {
            refreshLeaderboard()
            setConfirmClear(false)
          }}
        >
          Refresh
        </button>
        {entries.length > 0 && (
          <button type="button" className="leaderboard-clear" onClick={handleClear}>
            {confirmClear ? 'Confirm?' : 'Clear'}
          </button>
        )}
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
