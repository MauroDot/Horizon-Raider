import { useState } from 'react'
import { useSaveStore, MAX_SLOTS } from '../state/saveStore.js'

function formatTimestamp(ms) {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// The "Load screen" - browses saveStore's named slots (distinct from
// persistentStore's always-on live progress, see saveStore.js's docs).
// Loading replaces live progress with that slot's snapshot; deleting asks
// for a second click as a lightweight confirm (no modal, keeps this a
// simple sub-view like Leaderboard/Customize).
export function SaveGameView({ onBack }) {
  // Select the raw array, not a derived/sorted copy - a selector that
  // returns a fresh array reference every call defeats zustand's snapshot
  // equality check and re-renders on every store read, not just real
  // changes. Sorting happens below, in the render body instead.
  const slots = useSaveStore((s) => s.slots)
  const activeSlotId = useSaveStore((s) => s.activeSlotId)
  const createSave = useSaveStore((s) => s.createSave)
  const loadSave = useSaveStore((s) => s.loadSave)
  const deleteSave = useSaveStore((s) => s.deleteSave)
  const [newName, setNewName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [loadedId, setLoadedId] = useState(null)

  const sortedSlots = [...slots].sort((a, b) => b.updatedAt - a.updatedAt)
  const atCap = slots.length >= MAX_SLOTS

  const handleCreate = () => {
    if (atCap) return
    createSave(newName)
    setNewName('')
  }

  const handleDeleteClick = (id) => {
    if (confirmDeleteId === id) {
      deleteSave(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  const handleLoad = (id) => {
    loadSave(id)
    setLoadedId(id)
  }

  return (
    <div className="main-menu-panel">
      <h1>SAVE FILES</h1>
      <p className="main-menu-note">
        Stored locally in this browser only - {slots.length}/{MAX_SLOTS} slots used. Loading a save replaces your
        current progress with that file's.
      </p>

      {sortedSlots.length === 0 ? (
        <p className="main-menu-note">
          No saves yet - playing a mission or free-play run auto-creates one, or start a named save below.
        </p>
      ) : (
        <div className="main-menu-list">
          {sortedSlots.map((slot) => (
            <div className={`mission-row${slot.id === activeSlotId ? ' selected-row' : ''}`} key={slot.id}>
              <div className="mission-row-info">
                <span className="mission-row-name">
                  {slot.campaignName}
                  {slot.id === activeSlotId ? ' (active)' : ''}
                </span>
                <span className="mission-row-briefing">
                  {formatTimestamp(slot.updatedAt)} · {slot.data.stats.totalKills} kills ·{' '}
                  {slot.data.campaign.unlockedIndex} mission{slot.data.campaign.unlockedIndex === 1 ? '' : 's'}{' '}
                  cleared
                </span>
              </div>
              <div className="save-row-actions">
                <button type="button" onClick={() => handleLoad(slot.id)}>
                  {loadedId === slot.id ? 'Loaded' : 'Load'}
                </button>
                <button type="button" className="save-row-delete" onClick={() => handleDeleteClick(slot.id)}>
                  {confirmDeleteId === slot.id ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="save-new-row">
        <input
          type="text"
          className="save-new-input"
          placeholder="New save name"
          value={newName}
          maxLength={40}
          disabled={atCap}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="button" onClick={handleCreate} disabled={atCap}>
          New Save
        </button>
      </div>
      {atCap && <p className="main-menu-note">Slot limit reached - delete one to create another.</p>}

      <div className="main-menu-actions">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
