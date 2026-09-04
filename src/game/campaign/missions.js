// Campaign mission list: 5 chapters x 4 missions (3 regular + 1 boss) = 20,
// plus one 21st standalone endgame encounter ('final-titan', see the bottom
// of this file) that only unlocks after all 20 are done. Order in this
// array IS the unlock order - persistentStore's `campaign.unlockedIndex`
// gates strictly sequentially through it, which automatically enforces
// "can't play Chapter 2 until Chapter 1 is complete" for free, since a
// chapter's boss mission is always the last entry before the next
// chapter's first mission (and the Titan sits after all five).
//
// `type` drives real, distinct mechanics in createScene.js - see its docs -
// not just a label: 'destroy' (existing kill-count objective), 'survive'
// (timed wave defense), 'escort' (protect an AI-flown NPC along a route),
// 'recon' (visit waypoints - a patrol enemy spotting you within range ends
// the mission as 'detected', so staying undetected IS the primary
// objective here, not a bonus), 'boss' (a single named, heavily-buffed
// unique enemy with its own AI/attack patterns - see bossController.js -
// `finalBoss: true` drives its extra 3-phase behavior for The Titan).
//
// `secondaryObjective` is optional bonus criteria (never required to pass
// the mission, only to earn the 2nd/3rd star - see missionGrading.js):
//   { type: 'noDamage' }                    - finish without taking damage
//   { type: 'timeLimit', seconds }          - finish within a time budget
//   { type: 'bonusKills', amount }          - N kills beyond the primary target
//   { type: 'escortHealth', fraction }      - escort NPC ends above this health
//
// `radio` are short in-mission comm callouts (createScene.js fires them at
// the named trigger points): 'start', 'midway', 'lowHealth', 'complete'.
export const MISSIONS = [
  // --- Chapter 1: First Light ---
  {
    id: 'c1m1',
    chapterId: 'ch1',
    name: 'First Contact',
    type: 'destroy',
    briefing: 'Command reports hostile helicopters over the ridge, screening the Compact\'s beachhead. Clear the approach.',
    targetKills: 5,
    secondaryObjective: { type: 'noDamage' },
    radio: [
      { trigger: 'start', text: 'Horizon Lead, Command. Hostiles confirmed over the ridge - you are weapons free.' },
      { trigger: 'lowHealth', text: 'Horizon Lead, your signature is degraded. Watch your six.' },
      { trigger: 'complete', text: 'Ridge is clear. Good work, Horizon Lead.' },
    ],
  },
  {
    id: 'c1m2',
    chapterId: 'ch1',
    name: 'Eyes Forward',
    type: 'recon',
    briefing: 'Before Command commits ground units, they want a read on Compact patrol strength along the beachhead. Sweep the waypoints - stay clear of their patrols.',
    waypointCount: 3,
    secondaryObjective: { type: 'timeLimit', seconds: 90 },
    radio: [
      { trigger: 'start', text: 'Stay low, Horizon Lead. If their patrols make you, we lose the element of surprise.' },
      { trigger: 'midway', text: 'Good copy on the imagery so far. Continue the sweep.' },
      { trigger: 'complete', text: 'All checkpoints logged. Command has what it needs.' },
    ],
  },
  {
    id: 'c1m3',
    chapterId: 'ch1',
    name: 'Wounded Bird',
    type: 'escort',
    briefing: 'A damaged transport is limping back from the front. Escort it to the forward airstrip before the Compact finishes what they started.',
    waypointCount: 3,
    secondaryObjective: { type: 'escortHealth', fraction: 0.7 },
    radio: [
      { trigger: 'start', text: 'This is Wounded Bird, I\'m losing hydraulics - appreciate the company, Horizon Lead.' },
      { trigger: 'lowHealth', text: 'Wounded Bird taking fire! I can\'t hold much longer!' },
      { trigger: 'complete', text: 'Wounded Bird is down safe. Thank you, Horizon Lead - I mean that.' },
    ],
  },
  {
    id: 'c1m4',
    chapterId: 'ch1',
    name: 'The Vanguard',
    type: 'boss',
    bossName: 'Vanguard Reaper',
    briefing: 'The Compact\'s beachhead commander is airborne and daring Horizon Flight to come get him. Take him down.',
    bossVariant: 'gunship',
    bossHealthMultiplier: 5,
    bossColor: 0xff5522,
    escortCount: 3,
    secondaryObjective: { type: 'noDamage' },
    radio: [
      { trigger: 'start', text: 'Vanguard Reaper, this is Horizon Lead. Your beachhead is finished.' },
      { trigger: 'lowHealth', text: 'Horizon Lead, the Reaper is hitting hard - stay sharp.' },
      { trigger: 'complete', text: 'Vanguard Reaper is down. The outer islands are ours, Horizon Lead.' },
    ],
  },

  // --- Chapter 2: The Blockade ---
  {
    id: 'c2m1',
    chapterId: 'ch2',
    name: 'Breaking the Line',
    type: 'destroy',
    briefing: 'Compact gun platforms are strung across the strait. Punch a hole in their patrol line.',
    targetKills: 8,
    secondaryObjective: { type: 'bonusKills', amount: 4 },
    radio: [
      { trigger: 'start', text: 'Horizon Lead, the strait is thick with hostiles. Open us a corridor.' },
      { trigger: 'complete', text: 'Corridor\'s open. Convoy traffic can move again.' },
    ],
  },
  {
    id: 'c2m2',
    chapterId: 'ch2',
    name: 'Hold the Strait',
    type: 'survive',
    surviveSeconds: 120,
    briefing: 'A convoy is transiting the strait and needs cover while it clears the channel. Hold the line.',
    secondaryObjective: { type: 'noDamage' },
    radio: [
      { trigger: 'start', text: 'Convoy is committed, Horizon Lead. Hold this airspace until they\'re clear.' },
      { trigger: 'midway', text: 'Convoy reports good progress. Keep holding.' },
      { trigger: 'lowHealth', text: 'Horizon Lead, you\'re taking a beating - break off if you need to.' },
      { trigger: 'complete', text: 'Convoy\'s through. Stand down, Horizon Lead - well held.' },
    ],
  },
  {
    id: 'c2m3',
    chapterId: 'ch2',
    name: 'Lifeline',
    type: 'escort',
    briefing: 'A fuel tanker helicopter is the only thing keeping the forward garrisons running. Get it through the blockade.',
    waypointCount: 4,
    secondaryObjective: { type: 'escortHealth', fraction: 0.7 },
    radio: [
      { trigger: 'start', text: 'This is Lifeline, fully loaded and very flammable. Please don\'t let anything hit me.' },
      { trigger: 'lowHealth', text: 'Lifeline is taking fire! This cargo does NOT like bullets!' },
      { trigger: 'complete', text: 'Lifeline is down safe. The garrisons owe you fuel money, Horizon Lead.' },
    ],
  },
  {
    id: 'c2m4',
    chapterId: 'ch2',
    name: 'Iron Warden',
    type: 'boss',
    bossName: 'Iron Warden',
    briefing: 'The blockade\'s flagship - a heavily armored command transport - refuses to withdraw. Break it.',
    bossVariant: 'transport',
    bossHealthMultiplier: 6.5,
    bossColor: 0x3fa8ff,
    escortCount: 4,
    secondaryObjective: { type: 'timeLimit', seconds: 240 },
    radio: [
      { trigger: 'start', text: 'Iron Warden is a slow, armored target, Horizon Lead - but don\'t underestimate that broadside.' },
      { trigger: 'lowHealth', text: 'Horizon Lead, the Warden\'s escorts are closing - watch your flanks.' },
      { trigger: 'complete', text: 'Iron Warden is down. The strait is ours, Horizon Lead.' },
    ],
  },

  // --- Chapter 3: Shadow Coast ---
  {
    id: 'c3m1',
    chapterId: 'ch3',
    name: 'Uncharted',
    type: 'recon',
    briefing: 'Intercepted traffic points to a black site along this coastline. Get eyes on it - quietly.',
    waypointCount: 4,
    secondaryObjective: { type: 'timeLimit', seconds: 120 },
    radio: [
      { trigger: 'start', text: 'This sector\'s unmapped, Horizon Lead. Command wants a look, not a fight.' },
      { trigger: 'midway', text: 'Imagery\'s coming through clean. Keep the sweep going.' },
      { trigger: 'complete', text: 'Command has the full picture now. Head home, Horizon Lead.' },
    ],
  },
  {
    id: 'c3m2',
    chapterId: 'ch3',
    name: 'Burn the Site',
    type: 'destroy',
    briefing: 'The black site\'s security detail is airborne and hunting. Clear them before ground teams move in.',
    targetKills: 10,
    secondaryObjective: { type: 'noDamage' },
    radio: [
      { trigger: 'start', text: 'Security detail is scrambling, Horizon Lead. Don\'t let them regroup.' },
      { trigger: 'complete', text: 'Site security is down. Ground teams are moving in.' },
    ],
  },
  {
    id: 'c3m3',
    chapterId: 'ch3',
    name: 'Dig In',
    type: 'survive',
    surviveSeconds: 150,
    briefing: 'Ground teams need time to exploit the site\'s intel. Keep the sky clear over them.',
    secondaryObjective: { type: 'noDamage' },
    radio: [
      { trigger: 'start', text: 'Ground team is in the site, Horizon Lead. Keep the Compact off their backs.' },
      { trigger: 'midway', text: 'Intel extraction is going well. Keep holding.' },
      { trigger: 'complete', text: 'Extraction complete. Command\'s going to want to see this.' },
    ],
  },
  {
    id: 'c3m4',
    chapterId: 'ch3',
    name: 'Nightshade',
    type: 'boss',
    bossName: 'Nightshade',
    briefing: 'The site\'s black-program prototype is airborne and running. Don\'t let it disappear with what it knows.',
    bossVariant: 'scout',
    bossHealthMultiplier: 4,
    bossColor: 0x9d3fff,
    escortCount: 2,
    secondaryObjective: { type: 'timeLimit', seconds: 200 },
    radio: [
      { trigger: 'start', text: 'Nightshade is fast, Horizon Lead - don\'t let it break contact.' },
      { trigger: 'lowHealth', text: 'It\'s circling back on you, Horizon Lead - stay aggressive.' },
      { trigger: 'complete', text: 'Nightshade is down. Command says this changes everything.' },
    ],
  },

  // --- Chapter 4: Iron Tide ---
  {
    id: 'c4m1',
    chapterId: 'ch4',
    name: 'Forward Observer',
    type: 'escort',
    briefing: 'A spotter helicopter needs to reach the Ironhold ridgeline to call the opening barrage. Get it there alive.',
    waypointCount: 4,
    secondaryObjective: { type: 'escortHealth', fraction: 0.7 },
    radio: [
      { trigger: 'start', text: 'This is Spotter One - get me to that ridge and the barrage does the rest.' },
      { trigger: 'lowHealth', text: 'Spotter One is hit! Almost there, Horizon Lead!' },
      { trigger: 'complete', text: 'Spotter One is in position. Fire mission\'s away - thank you, Horizon Lead.' },
    ],
  },
  {
    id: 'c4m2',
    chapterId: 'ch4',
    name: 'Ironhold Skies',
    type: 'destroy',
    briefing: 'Ironhold\'s air wing has scrambled in full strength. Clear the skies for the ground assault.',
    targetKills: 12,
    secondaryObjective: { type: 'bonusKills', amount: 5 },
    radio: [
      { trigger: 'start', text: 'Full air wing incoming, Horizon Lead. This is the big one.' },
      { trigger: 'midway', text: 'Ground assault is standing by on your progress.' },
      { trigger: 'complete', text: 'Skies are clear. Ground assault is go.' },
    ],
  },
  {
    id: 'c4m3',
    chapterId: 'ch4',
    name: 'Behind the Wire',
    type: 'recon',
    briefing: 'Ironhold\'s inner defenses are still unmapped. Sweep the fortress line before the final push.',
    waypointCount: 5,
    secondaryObjective: { type: 'timeLimit', seconds: 150 },
    radio: [
      { trigger: 'start', text: 'This is the last unknown before the push, Horizon Lead. Stay quiet.' },
      { trigger: 'midway', text: 'Good data so far. Keep going.' },
      { trigger: 'complete', text: 'Fortress line is mapped. The push has everything it needs.' },
    ],
  },
  {
    id: 'c4m4',
    chapterId: 'ch4',
    name: 'Behemoth',
    type: 'boss',
    bossName: 'Behemoth',
    briefing: 'Ironhold\'s garrison commander flies a gunship built like a battleship. Bring it down and the fortress falls.',
    bossVariant: 'gunship',
    bossHealthMultiplier: 8,
    bossColor: 0xffcc22,
    escortCount: 4,
    secondaryObjective: { type: 'timeLimit', seconds: 260 },
    radio: [
      { trigger: 'start', text: 'Behemoth is the real deal, Horizon Lead. Take your time, take the shots.' },
      { trigger: 'lowHealth', text: 'Horizon Lead, you\'re taking heavy damage - this one hits hard.' },
      { trigger: 'complete', text: 'Behemoth is down. Ironhold has fallen, Horizon Lead.' },
    ],
  },

  // --- Chapter 5: Reckoning ---
  {
    id: 'c5m1',
    chapterId: 'ch5',
    name: 'The Long Approach',
    type: 'survive',
    surviveSeconds: 180,
    briefing: 'The citadel\'s outer picket is throwing everything at Horizon Flight to buy time. Hold until the strike package arrives.',
    secondaryObjective: { type: 'noDamage' },
    radio: [
      { trigger: 'start', text: 'This is it, Horizon Lead - hold the approach until the strike package is in position.' },
      { trigger: 'midway', text: 'Strike package is inbound. Keep holding.' },
      { trigger: 'lowHealth', text: 'Horizon Lead, you\'re in the red - hang on, almost there.' },
      { trigger: 'complete', text: 'Strike package is in position. The approach is open, Horizon Lead.' },
    ],
  },
  {
    id: 'c5m2',
    chapterId: 'ch5',
    name: 'Citadel Gates',
    type: 'destroy',
    briefing: 'The citadel\'s gate defenses are the last thing standing between Horizon Flight and the command tower.',
    targetKills: 15,
    secondaryObjective: { type: 'bonusKills', amount: 5 },
    radio: [
      { trigger: 'start', text: 'Gate defenses are heavy, Horizon Lead. Clear them and the tower is exposed.' },
      { trigger: 'midway', text: 'Good progress - the gate is thinning out.' },
      { trigger: 'complete', text: 'Gate defenses are down. The tower is open.' },
    ],
  },
  {
    id: 'c5m3',
    chapterId: 'ch5',
    name: 'Extraction',
    type: 'escort',
    briefing: 'A defecting Compact officer with critical intel needs to reach the extraction point - alive, and fast.',
    waypointCount: 5,
    secondaryObjective: { type: 'escortHealth', fraction: 0.7 },
    radio: [
      { trigger: 'start', text: 'This is the asset - if I go down, everything I know goes with me. Please hurry.' },
      { trigger: 'lowHealth', text: 'They\'re closing in! Horizon Lead, I need cover NOW!' },
      { trigger: 'complete', text: 'Asset is at the extraction point. You just ended this war, Horizon Lead.' },
    ],
  },
  {
    id: 'c5m4',
    chapterId: 'ch5',
    name: 'The Warlord\'s Talon',
    type: 'boss',
    bossName: 'The Warlord\'s Talon',
    briefing: 'The Compact\'s commander is airborne over the citadel, and he isn\'t running. End this, Horizon Lead.',
    bossVariant: 'gunship',
    bossHealthMultiplier: 11,
    bossColor: 0xff2244,
    escortCount: 5,
    secondaryObjective: { type: 'timeLimit', seconds: 300 },
    radio: [
      { trigger: 'start', text: 'That\'s the Talon, Horizon Lead - everything the Compact has left is riding on it.' },
      { trigger: 'lowHealth', text: 'Horizon Lead, this is everything - don\'t let up now!' },
      { trigger: 'complete', text: 'The Talon is down. The Compact\'s command structure is finished, Horizon Lead. It\'s over.' },
    ],
  },

  // --- Endgame: appears only after Chapter 5 (c5m4) is complete. Not one
  // of the "5 chapters x 4 missions" - a 21st, standalone encounter, which
  // fits the existing linear unlockedIndex gating with no structural
  // change (completing c5m4 advances unlockedIndex to 20, which is exactly
  // this mission's array position).
  {
    id: 'final-titan',
    chapterId: 'chFinal',
    name: 'The Last Stand',
    type: 'boss',
    finalBoss: true,
    bossName: 'The Titan',
    briefing: 'Buried under the citadel, one last machine wakes up - bigger than anything the Compact has fielded. Command has no intel on it. Finish this, Horizon Lead.',
    bossVariant: 'transport',
    bossHealthMultiplier: 20,
    bossColor: 0x7fffe6,
    escortCount: 0,
    secondaryObjective: { type: 'noDamage' },
    radio: [
      { trigger: 'start', text: 'Horizon Lead, we have no read on this thing. Whatever it is, it\'s the last one. Make it count.' },
      { trigger: 'midway', text: 'It\'s changing tactics, Horizon Lead - stay adaptive.' },
      { trigger: 'lowHealth', text: 'Horizon Lead, hold on - you\'re almost through this.' },
      { trigger: 'complete', text: 'It\'s down. It\'s actually down. Horizon Lead... you just ended the war.' },
    ],
  },
]

export function getMissionIndex(missionId) {
  return MISSIONS.findIndex((m) => m.id === missionId)
}

export function getMission(missionId) {
  return MISSIONS.find((m) => m.id === missionId)
}

export function getMissionsForChapter(chapterId) {
  return MISSIONS.filter((m) => m.chapterId === chapterId)
}

// True for a chapter's final mission (always its boss, by construction) -
// used to trigger the end-of-chapter cutscene summary on GameOver.
export function isChapterFinale(missionId) {
  const mission = getMission(missionId)
  if (!mission) return false
  const chapterMissions = getMissionsForChapter(mission.chapterId)
  return chapterMissions[chapterMissions.length - 1]?.id === missionId
}

const SECONDARY_LABELS = {
  noDamage: () => 'Complete without taking damage',
  timeLimit: (o) => `Complete within ${Math.floor(o.seconds / 60)}:${String(o.seconds % 60).padStart(2, '0')}`,
  bonusKills: (o) => `Destroy ${o.amount} additional hostiles`,
  escortHealth: (o) => `Escort survives above ${Math.round(o.fraction * 100)}% health`,
}

export function describeSecondaryObjective(mission) {
  const obj = mission.secondaryObjective
  if (!obj) return null
  return SECONDARY_LABELS[obj.type]?.(obj) ?? null
}

const PRIMARY_LABELS = {
  destroy: (m) => `Destroy ${m.targetKills} hostiles`,
  survive: (m) => `Survive for ${Math.floor(m.surviveSeconds / 60)}:${String(m.surviveSeconds % 60).padStart(2, '0')}`,
  escort: () => 'Escort the NPC helicopter to the extraction point',
  recon: (m) => `Visit all ${m.waypointCount} recon waypoints`,
  boss: (m) => `Destroy ${m.bossName}`,
}

export function describePrimaryObjective(mission) {
  return PRIMARY_LABELS[mission.type]?.(mission) ?? 'Complete the mission'
}
