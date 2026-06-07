export const EVENT_FREQUENCIES = {
  none: { label: 'None', chance: 0 },
  sparse: { label: 'Sparse', chance: 0.05 },
  normal: { label: 'Normal', chance: 0.12 },
  frequent: { label: 'Frequent', chance: 0.25 },
};

export function shouldTriggerEvent(terrainType, weather, frequencyKey) {
  const freq = EVENT_FREQUENCIES[frequencyKey];
  if (!freq || freq.chance === 0) return false;

  const terrainMod = {
    plains: 0, forest: 0.05, hills: 0.02, mountains: 0.05,
    swamp: 0.08, desert: 0.03, tundra: 0.03, beach: 0,
  }[terrainType] || 0;

  const weatherMod = (weather?.encounterMod || 0) / 100;
  const totalChance = freq.chance + terrainMod + weatherMod;

  return Math.random() < totalChance;
}

function pickWeighted(entries) {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

const TERRAIN_EVENT_TABLES = {
  plains: [
    { type: 'combat', weight: 20, title: 'Wolves on the Hunt',
      description: 'A pack of wolves circles the party, eyes gleaming in the tall grass. They\'ve been tracking the group for some time.' },
    { type: 'combat', weight: 10, title: 'Giant Eagle',
      description: 'A territorial giant eagle descends from the sky, mistaking a pack animal for prey.' },
    { type: 'discovery', weight: 15, title: 'Abandoned Cart',
      description: 'The party finds a broken-down cart half-sunk in the earth. Scavenged long ago, but perhaps something useful remains.' },
    { type: 'discovery', weight: 10, title: 'Ancient Waystone',
      description: 'A weathered stone pillar rises from the grass, covered in faded runes. It marks an old trade route.' },
    { type: 'hazard', weight: 15, title: 'Hidden Sinkhole',
      description: 'The lead character stumbles as the ground gives way — a sinkhole concealed by tall grass!' },
    { type: 'npc', weight: 15, title: 'Travelling Merchant',
      description: 'A merchant caravan crests a nearby hill, banners fluttering. They wave in greeting and approach.' },
    { type: 'npc', weight: 10, title: 'Patrol Riders',
      description: 'Armed riders appear on the horizon, moving with purpose. They\'ve spotted the party and are heading this way.' },
    { type: 'weatherChange', weight: 3, title: 'Sudden Storm',
      description: 'The sky darkens with shocking speed as a squall rolls across the plains.' },
    { type: 'navigation', weight: 2, title: 'Lost Bearings',
      description: 'The featureless plains stretch in every direction. The party struggles to hold their course.' },
  ],
  forest: [
    { type: 'combat', weight: 20, title: 'Ambush from the Brush',
      description: 'Goblins burst from the undergrowth, crude weapons raised! They\'ve been waiting for prey on this game trail.' },
    { type: 'combat', weight: 15, title: 'Dire Bear',
      description: 'A massive dire bear rises on its hind legs, disturbed from its feeding. It does not appreciate the interruption.' },
    { type: 'discovery', weight: 15, title: 'Hidden Glade',
      description: 'Pushing through a thicket, the party discovers a serene glade with a crystal-clear pool at its centre.' },
    { type: 'discovery', weight: 10, title: 'Fungal Grove',
      description: 'A cluster of luminous mushrooms pulses with faint blue light. They may have alchemical value.' },
    { type: 'hazard', weight: 10, title: 'Poison Ivy Patch',
      description: 'The party pushes through a dense patch of vegetation — but the vines are coated with irritant sap.' },
    { type: 'hazard', weight: 5, title: 'Deadfall Trap',
      description: 'A rotted tree limb crashes down behind the party, barely missing the rearguard. The noise echoes through the woods.' },
    { type: 'npc', weight: 10, title: 'Lost Hunter',
      description: 'A half-starved hunter stumbles out of the brush, relief flooding his face. He\'s been lost for days.' },
    { type: 'npc', weight: 5, title: 'Wood Elf Patrol',
      description: 'Silent figures emerge from the shadows, bows trained on the party. The wood elf patrol speaks in hushed tones.' },
    { type: 'weatherChange', weight: 5, title: 'Canopy Storm',
      description: 'The wind howls through the treetops as a storm brews overhead. Soon the forest floor will be slick with rain.' },
    { type: 'navigation', weight: 5, title: 'Twisted Trails',
      description: 'The forest plays tricks on the eyes. The party realises they\'ve been walking in a slow curve, off course.' },
  ],
  hills: [
    { type: 'combat', weight: 20, title: 'Hill Giant',
      description: 'A lone hill giant lumbers over a ridge, a uprooted tree over one shoulder. It grunts at the intruders.' },
    { type: 'combat', weight: 10, title: 'Stirge Swarm',
      description: 'A dark cloud rises from a rocky crevice — a swarm of stirges, attracted by the warmth of living bodies!' },
    { type: 'discovery', weight: 15, title: 'Cave Entrance',
      description: 'Behind a curtain of moss, the party finds the mouth of a cave. Cool air and the trickle of water emerge from within.' },
    { type: 'discovery', weight: 10, title: 'Fossil Bed',
      description: 'Erosion has exposed a layer of ancient fossils embedded in the rock. A scholar would pay well for these.' },
    { type: 'hazard', weight: 15, title: 'Rockfall',
      description: 'Loose stones tumble from above as the party traverses a narrow pass. The lead character must dodge the falling debris!' },
    { type: 'npc', weight: 10, title: 'Dwarven Prospectors',
      description: 'A group of dwarven prospectors calls out from a nearby outcropping, picks and hammers in hand.' },
    { type: 'npc', weight: 5, title: 'Hermit',
      description: 'A wizened figure emerges from a nearly invisible shelter built into the hillside, curious about the visitors.' },
    { type: 'weatherChange', weight: 10, title: 'Flash Flood',
      description: 'Dark clouds gather over the peaks. A flash flood could sweep through the low valleys — time to find high ground.' },
    { type: 'navigation', weight: 5, title: 'Ridge Confusion',
      description: 'One ridge looks much like another. The party is no longer certain which valley they need to follow.' },
  ],
  mountains: [
    { type: 'combat', weight: 20, title: 'Peryton Attack',
      description: 'A screeching peryton dives from above, its shadow passing over the party before the attack comes.' },
    { type: 'combat', weight: 10, title: 'Stone Giant',
      description: 'The ground trembles as a stone giant rounds a cliff face, displeased by the tiny figures in its domain.' },
    { type: 'discovery', weight: 15, title: 'Crystal Vein',
      description: 'A seam of raw crystal glitters in the rock face, catching the thin mountain light.' },
    { type: 'discovery', weight: 10, title: 'Ancient Temple',
      description: 'Half-hidden by an avalanche, the remains of an ancient mountain temple jut from the ice and scree.' },
    { type: 'hazard', weight: 15, title: 'Avalanche',
      description: 'A crack splits the snowy slope above. The party has seconds to take cover before tons of snow come crashing down!' },
    { type: 'hazard', weight: 10, title: 'Crevice',
      description: 'A deep crevice hidden beneath a dusting of snow nearly claims the lead character!' },
    { type: 'npc', weight: 10, title: 'Goliath Clan',
      description: 'A band of goliaths observes the party from a high ridge. One raises a hand in a cautious greeting.' },
    { type: 'weatherChange', weight: 5, title: 'Whiteout',
      description: 'A sudden blizzard engulfs the mountain path. Visibility drops to zero in moments.' },
    { type: 'navigation', weight: 5, title: 'False Pass',
      description: 'The trail the party has been following dead-ends at a sheer cliff. They must backtrack and find another route.' },
  ],
  desert: [
    { type: 'combat', weight: 20, title: 'Sand Wyrm',
      description: 'The sand erupts as a juvenile sand wyrm bursts forth, hungry and aggressive.' },
    { type: 'combat', weight: 10, title: 'Scorpion Brood',
      description: 'A nest of giant scorpions scuttles from the shadow of a dune, pincers raised.' },
    { type: 'discovery', weight: 15, title: 'Desert Ruins',
      description: 'Wind-worn pillars rise from the sand — the remains of an ancient civilisation buried by the desert.' },
    { type: 'discovery', weight: 10, title: 'Oasis',
      description: 'A lush oasis appears between two dunes, palm trees and clear water a welcome sight.' },
    { type: 'hazard', weight: 15, title: 'Quicksand',
      description: 'The ground turns treacherous as the lead character steps into a patch of quicksand!' },
    { type: 'hazard', weight: 10, title: 'Sandstorm',
      description: 'A wall of sand approaches with terrifying speed. The party must find shelter immediately!' },
    { type: 'npc', weight: 10, title: 'Nomad Caravan',
      description: 'A line of robed figures leads camels over a dune. The desert nomads regard the party with wary curiosity.' },
    { type: 'weatherChange', weight: 5, title: 'Heat Lightning',
      description: 'The sky flickers with distant lightning, but no rain falls. The air grows heavy and oppressively hot.' },
    { type: 'navigation', weight: 5, title: 'Dune Shifts',
      description: 'The shifting sands have erased familiar landmarks. The party must reorient themselves.' },
  ],
  swamp: [
    { type: 'combat', weight: 20, title: 'Lizardfolk Ambush',
      description: 'Spears fly from the murk! A lizardfolk hunting party sees the group as intruders in their territory.' },
    { type: 'combat', weight: 15, title: 'Giant Constrictor',
      description: 'A massive serpent slides silently through the brackish water, drawn by movement and sound.' },
    { type: 'discovery', weight: 10, title: 'Sunken Temple',
      description: 'The skeletal remains of a stone temple rise from the stagnant water, its entrance a dark archway.' },
    { type: 'discovery', weight: 10, title: 'Herb Grove',
      description: 'A small island of dry ground hosts rare medicinal herbs that only grow in fetid conditions.' },
    { type: 'hazard', weight: 15, title: 'Toxic Gas',
      description: 'Bubbles rise from the mud, releasing pockets of noxious gas. The party must move quickly to avoid the worst of it!' },
    { type: 'hazard', weight: 10, title: 'Quagmire',
      description: 'The ground proves unstable — a peat bog that tries to pull the party down into the dark water!' },
    { type: 'npc', weight: 10, title: 'Half-Elf Witch',
      description: 'A lone figure stands on a raised platform of roots, watching the party approach. She knows these swamps intimately.' },
    { type: 'weatherChange', weight: 5, title: 'Thickening Mist',
      description: 'The air temperature drops and a thick mist rolls in, reducing visibility to arm\'s length.' },
    { type: 'navigation', weight: 5, title: 'Twisted Waterways',
      description: 'The channels through the swamp twist and loop back on themselves. The party has been going in circles.' },
  ],
  tundra: [
    { type: 'combat', weight: 20, title: 'Winter Wolf Pack',
      description: 'Pale shapes move through the blowing snow — a pack of winter wolves, hunger in their eyes.' },
    { type: 'combat', weight: 10, title: 'Yeti',
      description: 'A hulking white figure rises from behind a snowdrift, letting out a guttural roar.' },
    { type: 'discovery', weight: 15, title: 'Frozen Ruins',
      description: 'The remains of an ancient structure emerge from the permafrost, its stones etched with frost-covered carvings.' },
    { type: 'discovery', weight: 10, title: 'Hot Spring',
      description: 'Steam rises from a pool of geothermal water — a rare haven of warmth in the frozen waste.' },
    { type: 'hazard', weight: 15, title: 'Thin Ice',
      description: 'A frozen lake stretches ahead, but the ice is thinner than it appears. The lead character feels it crack beneath them!' },
    { type: 'hazard', weight: 10, title: 'Snowblind',
      description: 'The sun reflects off the endless white, making it nearly impossible to see. The party must stop and rest their eyes.' },
    { type: 'npc', weight: 10, title: 'Tribal Hunters',
      description: 'Fur-clad hunters emerge from the white landscape, pulling sledges loaded with game.' },
    { type: 'weatherChange', weight: 5, title: 'Blizzard',
      description: 'The wind picks up without warning, driving snow horizontal. The party must shelter or risk freezing.' },
    { type: 'navigation', weight: 5, title: 'Whiteout',
      description: 'Between the snow and the flat light, the party has lost all sense of direction.' },
  ],
  beach: [
    { type: 'combat', weight: 15, title: 'Coastal Predators',
      description: 'Pterodactyl-like creatures wheel overhead and dive at the party, defending their nesting grounds.' },
    { type: 'combat', weight: 10, title: 'Merfolk Raiders',
      description: 'Figures rise from the surf — merfolk armed with tridents, warning the party away from sacred waters.' },
    { type: 'discovery', weight: 20, title: 'Shipwreck',
      description: 'The remains of a ship lie half-buried in the sand. Salt-caked cargo may still be salvageable.' },
    { type: 'discovery', weight: 15, title: 'Sea Cave',
      description: 'An opening in the cliff face leads to a sea cave, its walls glittering with minerals and strangely coloured moss.' },
    { type: 'hazard', weight: 10, title: 'Riptide',
      description: 'A character wading in the shallows is caught by a sudden riptide, pulled away from shore!' },
    { type: 'hazard', weight: 5, title: 'Cliff Fall',
      description: 'The edge of the cliff crumbles as the party walks the coastal path. The ground is less stable than it appeared.' },
    { type: 'npc', weight: 15, title: 'Fisherfolk',
      description: 'A small fishing boat approaches the shore. The grizzled fisherfolk wave and offer news from coastal settlements.' },
    { type: 'weatherChange', weight: 5, title: 'Coastal Storm',
      description: 'Dark clouds gather over the sea and race toward land. A coastal storm is about to break.' },
    { type: 'navigation', weight: 5, title: 'Tide Cut-off',
      description: 'The rising tide has cut off the coastal path ahead. The party must find an inland route or wait for low tide.' },
  ],
};

export function generateRandomEvent(terrainType) {
  const table = TERRAIN_EVENT_TABLES[terrainType] || TERRAIN_EVENT_TABLES.plains;
  const picked = pickWeighted(table);
  return { ...picked, terrain: terrainType };
}
