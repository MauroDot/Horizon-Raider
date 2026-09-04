import { useEffect, useState } from 'react'
import { useGameStore } from '../state/gameStore.js'
import { usePersistentStore } from '../state/persistentStore.js'
import { getMissionIndex, getMissionsForChapter } from '../game/campaign/missions.js'
import { CHAPTERS } from '../game/campaign/chapters.js'
import { LeaderboardView } from './LeaderboardView.jsx'
import { SaveGameView } from './SaveGameView.jsx'
import { LoadoutView } from './LoadoutView.jsx'
import { PilotSummary } from './PilotSummary.jsx'
import { MissionBriefing } from './MissionBriefing.jsx'
import { Stars } from './Stars.jsx'
import './MainMenu.css'

function formatPlaytime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

const TYPE_ICON = { destroy: '🎯', escort: '🛡', survive: '⏱', recon: '👁', boss: '⚔' }

// Missions grouped by chapter (see chapters.js/missions.js) - a chapter is
// visible once its first mission is unlocked, and within it each mission
// still has its own individual lock state, so "can't play Chapter 2 until
// Chapter 1 is complete" falls out of the same linear unlockedIndex that
// already gated the flat list, just rendered in groups. Clicking an
// unlocked mission opens MissionBriefing rather than launching directly.
function CampaignView({ onBack }) {
  const startMission = useGameStore((s) => s.startMission)
  const campaign = usePersistentStore((s) => s.campaign)
  const [briefingMission, setBriefingMission] = useState(null)

  if (briefingMission) {
    return (
      <MissionBriefing
        mission={briefingMission}
        onBack={() => setBriefingMission(null)}
        onStart={(difficultyId) => startMission(briefingMission.id, difficultyId)}
      />
    )
  }

  return (
    <div className="main-menu-panel campaign-panel">
      <h1>CAMPAIGN</h1>
      <p className="main-menu-note">Story missions, grouped by chapter. Clear a chapter's boss to unlock the next.</p>
      <div className="main-menu-list campaign-list">
        {CHAPTERS.map((chapter) => {
          const missions = getMissionsForChapter(chapter.id)
          const chapterUnlocked = missions.some((m) => getMissionIndex(m.id) <= campaign.unlockedIndex)
          return (
            <div className="chapter-group" key={chapter.id}>
              <div className="chapter-header">
                <span className="chapter-name">{chapter.name}</span>
                {!chapterUnlocked && <span className="chapter-locked-tag">LOCKED</span>}
              </div>
              {chapterUnlocked &&
                missions.map((mission) => {
                  const index = getMissionIndex(mission.id)
                  const unlocked = index <= campaign.unlockedIndex
                  const record = campaign.completed[mission.id]
                  return (
                    <div className={`mission-row${unlocked ? '' : ' locked'}`} key={mission.id}>
                      <div className="mission-row-info">
                        <span className="mission-row-name">
                          {TYPE_ICON[mission.type]} {mission.name}
                        </span>
                        <span className="mission-row-briefing">
                          {unlocked ? mission.briefing : 'Locked - complete the previous mission'}
                        </span>
                        {record && (
                          <span className="mission-row-record">
                            <Stars count={record.bestStars ?? 0} />
                            {record.bestRank && <span className="rank-badge">{record.bestRank}</span>}
                          </span>
                        )}
                      </div>
                      <button type="button" disabled={!unlocked} onClick={() => setBriefingMission(mission)}>
                        {record ? 'Replay' : 'Briefing'}
                      </button>
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
      <div className="main-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}

// The title screen - gameStore's entry point (mode === 'MENU'). Free Play
// and Campaign both just flip gameStore's mode (App.jsx swaps in
// GameScreen in response); Leaderboard/Loadout/Save Files are menu-only
// sub-views that never touch gameStore at all.
//
// `audioManager` starts the menu music track on mount (a no-op today until
// a real music/menu.mp3 exists - see audioManifest.js) and plays a click
// SFX on the primary mode buttons - representative wiring for "UI clicks,
// beeps" rather than instrumenting literally every button in the app.
export function MainMenu({ audioManager }) {
  const [view, setView] = useState('root')
  const startFreePlay = useGameStore((s) => s.startFreePlay)
  const stats = usePersistentStore((s) => s.stats)

  useEffect(() => {
    audioManager?.playMusic('menu')
  }, [audioManager])

  const click = (fn) => () => {
    audioManager?.playSfx('uiClick')
    fn()
  }

  if (view === 'campaign') return <div className="main-menu"><CampaignView onBack={() => setView('root')} /></div>
  if (view === 'leaderboard') {
    return (
      <div className="main-menu">
        <LeaderboardView onBack={() => setView('root')} />
      </div>
    )
  }
  if (view === 'loadout') return <div className="main-menu"><LoadoutView onBack={() => setView('root')} /></div>
  if (view === 'saves') return <div className="main-menu"><SaveGameView onBack={() => setView('root')} /></div>

  return (
    <div className="main-menu">
      <div className="main-menu-panel main-menu-root">
        <h1 className="main-menu-title">HORIZON RAIDER</h1>
        <p className="main-menu-subtitle">A helicopter combat sandbox</p>
        <PilotSummary />

        <div className="main-menu-modes">
          <button type="button" className="main-menu-mode" onClick={click(startFreePlay)}>
            <span className="main-menu-mode-title">FREE PLAY</span>
            <span className="main-menu-mode-desc">Sandbox. Unlimited enemies, no objectives.</span>
          </button>
          <button type="button" className="main-menu-mode" onClick={click(() => setView('campaign'))}>
            <span className="main-menu-mode-title">CAMPAIGN</span>
            <span className="main-menu-mode-desc">Story missions with progression.</span>
          </button>
          <button type="button" className="main-menu-mode" onClick={click(() => setView('loadout'))}>
            <span className="main-menu-mode-title">LOADOUT</span>
            <span className="main-menu-mode-desc">Helicopter, paint, preset, and boosters.</span>
          </button>
          <button type="button" className="main-menu-mode" onClick={click(() => setView('leaderboard'))}>
            <span className="main-menu-mode-title">LEADERBOARD</span>
            <span className="main-menu-mode-desc">View and submit high scores.</span>
          </button>
          <button type="button" className="main-menu-mode" onClick={click(() => setView('saves'))}>
            <span className="main-menu-mode-title">SAVE FILES</span>
            <span className="main-menu-mode-desc">Load, create, or delete a save slot.</span>
          </button>
        </div>

        <div className="main-menu-footer">
          <span className="main-menu-stats">
            {stats.gamesPlayed} flights · {stats.totalKills} kills · {stats.lifetimeAccuracy.toFixed(0)}% acc · best{' '}
            {stats.bestFreePlayScore} · {formatPlaytime(stats.totalPlaytimeSeconds)} played
          </span>
        </div>
      </div>
    </div>
  )
}
