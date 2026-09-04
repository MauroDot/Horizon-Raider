// The campaign's story arc: Task Force Horizon vs. the Kestrel Compact, a
// breakaway faction that seized the border archipelago and is escalating
// toward open war. Five chapters, each ending in a unique boss mission (see
// missions.js) and unlocking an end-of-chapter summary shown on GameOver
// once that boss falls - the "cutscene" the spec asks for, done as text
// rather than an actual rendered cutscene (no asset budget for that here).
export const CHAPTERS = [
  {
    id: 'ch1',
    name: 'First Light',
    intro: 'The Compact struck at dawn, seizing the outer islands before the garrison could scramble. Horizon Flight is the first response in-theater.',
    outro: 'The outer islands are secure and the Compact\'s vanguard is broken. Command reroutes Horizon Flight toward the strait - satellite imagery shows the Compact massing a blockade fleet there.',
  },
  {
    id: 'ch2',
    name: 'The Blockade',
    intro: 'The Compact has strung gun platforms and patrol lines across the strait, choking the supply route to the mainland garrisons.',
    outro: 'The blockade is broken and the strait is open again. But intercepted traffic points somewhere unexpected - a black site hidden along the shadow coast, off every chart Command has.',
  },
  {
    id: 'ch3',
    name: 'Shadow Coast',
    intro: 'No maps of this coastline are current. Command wants eyes on the black site before committing anything louder than a single airframe.',
    outro: 'What Horizon Flight found at the black site changes the picture entirely - this was never a rebellion. It was a staging ground. The Compact is dug in for a real war, and it starts at Ironhold.',
  },
  {
    id: 'ch4',
    name: 'Iron Tide',
    intro: 'Ironhold is the Compact\'s main fortress line - the last thing standing between Horizon Flight and their command citadel.',
    outro: 'Ironhold has fallen. What\'s left of the Compact\'s regional command has pulled back to the citadel at the archipelago\'s heart. This ends there.',
  },
  {
    id: 'ch5',
    name: 'Reckoning',
    intro: 'The citadel is the Compact\'s last stronghold, and its commander isn\'t retreating any further. Command has one order: end it.',
    outro: 'The citadel has fallen and the Compact\'s command structure with it. Horizon Flight is stood down - for now. Command\'s already asking what comes next.',
  },
  {
    id: 'chFinal',
    name: 'The Last Stand',
    intro: 'With the Compact\'s command gone, seismic sensors under the citadel picked up something waking. Whatever it is, it was never in anyone\'s files.',
    outro:
      'The Titan is scrap, and with it the last of whatever the Compact was building toward. Horizon Flight flies home over a quiet archipelago for the first time in months. Command calls it a victory. Horizon Lead calls it a long debrief ahead - but for tonight, it\'s over.',
  },
]

export function getChapter(chapterId) {
  return CHAPTERS.find((c) => c.id === chapterId)
}

export function getChapterIndex(chapterId) {
  return CHAPTERS.findIndex((c) => c.id === chapterId)
}
