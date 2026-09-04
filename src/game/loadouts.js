// Player loadout presets - a speed/armor/ordnance tradeoff, independent of
// (and stacked multiplicatively on top of) the selected helicopter's own
// stats (see helicopters.js). `armorMultiplier` scales PlayerHealth's max
// health, `speedMultiplier` scales the flight model's top speed/turn-rate
// knob, `missileCapacity` sets the base missile pool before weapon-upgrade
// bonuses (helicopters.js's resolveWeaponUpgrades) are added on top.
export const LOADOUTS = [
  { id: 'standard', label: 'Standard', description: 'Balanced in every category.', speedMultiplier: 1, armorMultiplier: 1, missileCapacity: 8 },
  { id: 'heavy', label: 'Heavy', description: 'More armor and health, slower.', speedMultiplier: 0.82, armorMultiplier: 1.4, missileCapacity: 10 },
  { id: 'light', label: 'Light', description: 'Faster, less armor.', speedMultiplier: 1.18, armorMultiplier: 0.75, missileCapacity: 8 },
  { id: 'scout', label: 'Scout', description: 'Maximum speed, minimal weapons.', speedMultiplier: 1.35, armorMultiplier: 0.55, missileCapacity: 4 },
]

export const DEFAULT_LOADOUT = 'standard'

export function getLoadout(id) {
  return LOADOUTS.find((l) => l.id === id) ?? LOADOUTS[0]
}
