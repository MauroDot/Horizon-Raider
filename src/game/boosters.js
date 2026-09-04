// Purchasable, temporary in-mission power-ups. Bought as charges with
// earned currency (persistentStore.currency) from the Loadout screen;
// charges carry are consumed one at a time in-flight (boosterController.js)
// via a dedicated keybind per slot (controlConfig.js's boosterSlot1/2/3).
export const BOOSTERS = [
  {
    id: 'shield',
    label: 'Shield Boost',
    description: 'Nullifies all damage for a short time.',
    cost: 40,
    duration: 8,
  },
  {
    id: 'speed',
    label: 'Speed Burst',
    description: 'Sharply increases top speed and turn rate.',
    cost: 30,
    duration: 10,
  },
  {
    id: 'weapon',
    label: 'Weapon Boost',
    description: 'Doubles fire rate and boosts damage.',
    cost: 35,
    duration: 10,
  },
]

export function getBooster(id) {
  return BOOSTERS.find((b) => b.id === id)
}
