import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePersistentStore } from './persistentStore.js'

export const MAX_SLOTS = 5

function makeSlot(campaignName) {
  const now = Date.now()
  return {
    id: `save-${now}-${Math.random().toString(36).slice(2, 8)}`,
    campaignName: campaignName?.trim() || 'New Game',
    createdAt: now,
    updatedAt: now,
    version: 1,
    data: usePersistentStore.getState().getSnapshot(),
  }
}

// Named save slots layered on top of persistentStore's continuously-
// auto-persisted "live progress". persistentStore alone already survives a
// page refresh (that's just its own `persist` middleware); this store adds
// the save-file concept the spec asks for: multiple named JSON snapshots
// you can switch between, save over, or delete, distinct from "whatever's
// currently live". It only ever touches persistentStore through
// getSnapshot() (capture) and hydrate() (load) - never automatically on
// boot, so booting the app never silently overwrites fresher live progress
// with a stale slot.
export const useSaveStore = create(
  persist(
    (set, get) => ({
      slots: [],
      activeSlotId: null,

      listSaves: () => [...get().slots].sort((a, b) => b.updatedAt - a.updatedAt),

      // "Start a new game" - captures a fresh default progress snapshot
      // under a player-chosen name and makes it active. Live progress is
      // reset to defaults too (a new save shouldn't inherit whatever the
      // player was just doing under a different, possibly-unsaved, slot).
      // Returns the new slot's id, or null if the slot cap is already hit.
      createSave: (campaignName) => {
        const { slots } = get()
        if (slots.length >= MAX_SLOTS) return null

        usePersistentStore.getState().hydrate(null)
        const slot = makeSlot(campaignName)
        set({ slots: [...slots, slot], activeSlotId: slot.id })
        return slot.id
      },

      // Auto-save entry point: writes current live progress into the active
      // slot, silently creating a default "Autosave" slot first if the
      // player has been playing without ever picking/creating one (so
      // jumping straight into Free Play or Campaign from a clean browser
      // just works, no forced "create a save" step). Called at mission
      // start, mission/run end - see GameScreen.jsx.
      saveToActiveSlot: () => {
        const { activeSlotId, slots } = get()
        const activeSlot = slots.find((s) => s.id === activeSlotId)

        if (!activeSlot) {
          if (slots.length >= MAX_SLOTS) return null
          const slot = makeSlot('Autosave')
          set({ slots: [...slots, slot], activeSlotId: slot.id })
          return slot.id
        }

        const data = usePersistentStore.getState().getSnapshot()
        set({
          slots: slots.map((s) => (s.id === activeSlotId ? { ...s, data, updatedAt: Date.now() } : s)),
        })
        return activeSlotId
      },

      // Explicit "Load" from the Load Game screen: hydrates live progress
      // from the chosen slot's snapshot and makes it the active slot so
      // subsequent auto-saves land back in the same file.
      loadSave: (id) => {
        const slot = get().slots.find((s) => s.id === id)
        if (!slot) return false
        usePersistentStore.getState().hydrate(slot.data)
        set({ activeSlotId: id })
        return true
      },

      deleteSave: (id) =>
        set((s) => ({
          slots: s.slots.filter((slot) => slot.id !== id),
          activeSlotId: s.activeSlotId === id ? null : s.activeSlotId,
        })),
    }),
    { name: 'horizon-raider:saves' },
  ),
)
