// Unlockable player helicopters. Each has real stat multipliers (applied on
// top of the loadout preset's own multipliers - see loadouts.js) AND a
// distinct look, via `style` passed to createHelicopter(): an accent color,
// a uniform scale (bigger reads "heavier", smaller reads "nimbler"), and a
// couple of silhouette toggles (extra armor plating, a darker stealth
// finish). This is a genuinely different-*handling* aircraft with a
// recognizably different silhouette, built from the one parametrized
// player model rather than five separate hand-modeled airframes - scoped
// that way deliberately rather than promising bespoke geometry per variant.
export const HELICOPTERS = [
  {
    id: 'viper',
    label: 'Viper',
    description: 'Balanced starting gunship. Reliable in every category.',
    requiredLevel: 1,
    speedMultiplier: 1,
    agilityMultiplier: 1,
    armorMultiplier: 1,
    firepowerMultiplier: 1,
    style: { accentColor: 0xd94f3d, scale: 1, plating: false, stealth: false },
  },
  {
    id: 'reaper',
    label: 'Reaper',
    description: 'Heavy attack variant - more armor and firepower, less nimble.',
    requiredLevel: 5,
    speedMultiplier: 0.9,
    agilityMultiplier: 0.85,
    armorMultiplier: 1.35,
    firepowerMultiplier: 1.25,
    style: { accentColor: 0xb33a1f, scale: 1.12, plating: true, stealth: false },
  },
  {
    id: 'phantom',
    label: 'Phantom',
    description: 'Stealth variant - dark low-visibility finish, quick and evasive.',
    requiredLevel: 10,
    speedMultiplier: 1.1,
    agilityMultiplier: 1.15,
    armorMultiplier: 0.85,
    firepowerMultiplier: 1,
    style: { accentColor: 0x2a2c30, scale: 0.94, plating: false, stealth: true },
  },
  {
    id: 'striker',
    label: 'Striker',
    description: 'Lightweight airframe built for raw speed.',
    requiredLevel: 15,
    speedMultiplier: 1.25,
    agilityMultiplier: 1.2,
    armorMultiplier: 0.75,
    firepowerMultiplier: 0.95,
    style: { accentColor: 0xffce54, scale: 0.88, plating: false, stealth: false },
  },
  {
    id: 'warlord',
    label: 'Warlord',
    description: 'Ultimate endgame gunship - dominant across the board.',
    requiredLevel: 30,
    speedMultiplier: 1.2,
    agilityMultiplier: 1.15,
    armorMultiplier: 1.5,
    firepowerMultiplier: 1.5,
    style: { accentColor: 0xffd21a, scale: 1.2, plating: true, stealth: false },
  },
]

export const DEFAULT_HELICOPTER = 'viper'

export function getHelicopter(id) {
  return HELICOPTERS.find((h) => h.id === id) ?? HELICOPTERS[0]
}

// Automatic weapon upgrades unlocked by pilot level (see progression.js) -
// "Weapon upgrades: better missiles, faster reload, larger ammo" from the
// spec, scoped as level-gated and automatic rather than a second
// currency-purchasable tree, since currency is earmarked for boosters.
// Cumulative: everything unlocked at or below the player's level applies at
// once, not just the highest tier.
export const WEAPON_UPGRADES = [
  { id: 'quickload', label: 'Quickload Kit', requiredLevel: 8, description: 'Missile regen 25% faster.', reloadSpeedMultiplier: 1.25 },
  { id: 'extendedRacks', label: 'Extended Racks', requiredLevel: 16, description: '+4 missile capacity.', ammoBonus: 4 },
  { id: 'apWarheads', label: 'AP Warheads', requiredLevel: 24, description: 'Missile damage +25%.', missileDamageMultiplier: 1.25 },
]

export function resolveWeaponUpgrades(level) {
  const unlocked = WEAPON_UPGRADES.filter((u) => level >= u.requiredLevel)
  return {
    unlocked,
    reloadSpeedMultiplier: unlocked.reduce((m, u) => m * (u.reloadSpeedMultiplier ?? 1), 1),
    ammoBonus: unlocked.reduce((sum, u) => sum + (u.ammoBonus ?? 0), 0),
    missileDamageMultiplier: unlocked.reduce((m, u) => m * (u.missileDamageMultiplier ?? 1), 1),
  }
}
