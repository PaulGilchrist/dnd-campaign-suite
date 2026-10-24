let nameCache = null;
let traitCache = null;

async function loadNameData() {
  if (nameCache) return nameCache;
  const response = await fetch('/data/npc-names.json');
  nameCache = await response.json();
  return nameCache;
}

async function loadTraitData() {
  if (traitCache) return traitCache;
  const response = await fetch('/data/npc-generator-traits.json');
  traitCache = await response.json();
  return traitCache;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Presence+non-empty selector (#1180, fix#39/fix#184 sibling law): [] is truthy,
// so `pool || other || []` chains guard only ABSENT keys — a PRESENT-but-EMPTY
// array reaches pick([]) === undefined. Returns the first pool that is both.
function firstNonEmpty(...pools) {
  return pools.find(pool => Array.isArray(pool) && pool.length > 0);
}

function pickN(arr, n) {
  const copy = [...arr];
  const result = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

// fix#357 empty-pool guard (fix#197 census x7, trait picks). PRODUCER CENSUS:
// npc-generator-traits.json disk 2026-10-24 — races:15 classRoles:89 attitudes:5
// appearances:101 personalities:79 goals:57 secrets:55 tags:67 — every pool is an
// authored non-empty array; there is no authored-nullable pool in this file, so an
// absent-or-empty pick here is key drift or an emptied bank. Bare pick([]) used to
// leak `undefined` onto the NPC record (absence-or-empty, undefined-field not a
// crash-path — the name-hole class twin, fix#197). LOUD per #app no-fallbacks,
// mirroring this file's own :308-311 exhausted-name-pool precedent: console.error
// names the broken pool, then refuse instead of shipping an undefined field.
// RNG-shape note: the guard consumes ZERO randomness; every pool is non-empty on
// disk today, so the slot map in npcGenerator.test.js is byte-unchanged on all pins.
function pickFrom(pool, what) {
  if (!(Array.isArray(pool) && pool.length > 0)) {
    console.error(`npcGenerator: trait pool '${what}' is absent or empty (npc-generator-traits.json key drift?)`);
    throw new TypeError(`npcGenerator: no entries in trait pool '${what}'`);
  }
  return pick(pool);
}

const WEAPON_ACTION_TEMPLATES = [
  { names: ["Longsword", "Shortsword", "Bastard Sword", "Scimitar", "Rapier"], damageDice: ["1d8", "1d6", "1d8", "1d6", "1d8"], type: "Slashing" },
  { names: ["Battleaxe", "Handaxe", "Warhammer", "Mace", "Morningstar"], damageDice: ["1d8", "1d6", "1d8", "1d6", "1d8"], type: "Bludgeoning" },
  { names: ["Spear", "Javelin", "Trident", "Lance", "Halberd"], damageDice: ["1d6", "1d6", "1d6", "1d10", "1d10"], type: "Piercing" },
  { names: ["Dagger", "Sickle", "Club", "Light Hammer", "Quarterstaff"], damageDice: ["1d4", "1d4", "1d4", "1d4", "1d6"], type: "Varies" },
];

const RANGED_TEMPLATES = [
  { names: ["Longbow", "Shortbow", "Hand Crossbow", "Heavy Crossbow", "Sling"], damageDice: ["1d8", "1d6", "1d6", "1d10", "1d4"], type: "Piercing" },
];

const SPELL_ACTION_TEMPLATES = [
  { names: ["Firebolt", "Ray of Frost", "Chill Touch", "Eldritch Blast", "Sacred Flame"], damageDice: ["1d10", "1d8", "1d8", "1d10", "1d8"], type: "Fire/Cold/Necrotic/Force/Radiant" },
  { names: ["Burning Hands", "Thunderwave", "Ice Knife", "Witch Bolt", "Guiding Bolt"], damageDice: ["3d6", "2d8", "1d10", "1d12", "4d6"], type: "Fire/Thunder/Cold/Lightning/Radiant" },
];

const TRAIT_POOL = [
  { name: "Pack Tactics", description: "The creature has advantage on an attack roll against a creature if at least one of the creature's allies is within 5 feet of the target and the ally isn't incapacitated." },
  { name: "Brute", description: "A melee weapon deals one extra die of its damage when the creature scores a critical hit." },
  { name: "Keen Senses", description: "The creature has advantage on Wisdom (Perception) checks." },
  { name: "Nimble Escape", description: "The creature can take the Disengage or Hide action as a bonus action on each of its turns." },
  { name: "Shadow Stealth", description: "While in dim light or darkness, the creature can take the Hide action as a bonus action." },
  { name: "Reckless", description: "At the start of its turn, the creature can gain advantage on all melee weapon attack rolls during that turn, but attack rolls against it have advantage until the start of its next turn." },
  { name: "Sneak Attack", description: "Once per turn, the creature deals an extra 2d6 damage when it hits with a weapon attack and has advantage on the attack roll." },
  { name: "Tough Hide", description: "The creature's natural armor grants a +1 bonus to AC already included in their armor class." },
  { name: "Amphibious", description: "The creature can breathe both air and water." },
  { name: "Frightful Presence", description: "Each creature of the creature's choice within 30 feet must succeed on a DC 11 Wisdom saving throw or become frightened for 1 minute." },
  { name: "Multiattack", description: "The creature makes two attacks on its turn." },
  { name: "Resistance", description: "The creature has advantage on saving throws against a specific condition or effect." },
];

function getHPRange(cr) {
  const ranges = {
    0: [1, 4],
    0.125: [5, 10],
    0.25: [11, 20],
    0.5: [21, 35],
    1: [36, 50],
    2: [51, 75],
    3: [76, 100],
    4: [101, 130],
    5: [131, 165],
  };
  return ranges[cr] || [4, 10];
}

function getACRange(cr) {
  const ranges = {
    0: [9, 11],
    0.125: [11, 13],
    0.25: [12, 14],
    0.5: [12, 15],
    1: [13, 16],
    2: [14, 17],
    3: [15, 18],
    4: [16, 19],
    5: [16, 20],
  };
  return ranges[cr] || [10, 13];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDiceString(diceStr) {
  const match = diceStr.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return '1';
  const num = parseInt(match[1]);
  const die = parseInt(match[2]);
  const mod = match[3] ? parseInt(match[3]) : 0;
  let total = 0;
  for (let i = 0; i < num; i++) total += randomInt(1, die);
  return String(total + mod);
}

function scaleDamage(baseDice, cr) {
  const match = baseDice.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return baseDice;
  let num = parseInt(match[1]);
  const die = match[2];
  const mod = match[3] || '';
  if (cr >= 2) num = Math.max(num, 2);
  if (cr >= 4) num = Math.max(num, 3);
  if (cr >= 5) num = Math.min(num + 1, 5);
  return `${num}d${die}${mod}`;
}

const CR_ROLL_TABLE = [
  [0.25, 0],
  [0.45, 0.125],
  [0.60, 0.25],
  [0.72, 0.5],
  [0.82, 1],
  [0.89, 2],
  [0.94, 3],
  [0.97, 4],
];

function rollChallengeRating() {
  const crRoll = Math.random();
  const entry = CR_ROLL_TABLE.find(([threshold]) => crRoll < threshold);
  return entry ? entry[1] : 5;
}

function rollSpeeds(crNum) {
  const speed = { walk: '30 ft.' };
  if (crNum >= 2 && Math.random() > 0.75) {
    const extraSpeeds = ['fly', 'swim', 'climb', 'burrow'];
    const extra = pick(extraSpeeds);
    speed[extra] = '30 ft.';
  }
  return speed;
}

function rollAbilityScores(crNum, abilityScore, isCaster) {
  const primaryAbilities = ['str', 'dex'];
  if (isCaster) primaryAbilities.push('int', 'wis', 'cha');
  const primaryAbility = pick(primaryAbilities);

  const abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  abilityScores[primaryAbility] = abilityScore;
  const others = ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter(a => a !== primaryAbility);
  const secondary = pick(others);
  abilityScores[secondary] = 10 + Math.floor(crNum);
  abilityScores.con = Math.max(abilityScores.con, 10 + Math.floor(crNum * 0.8));
  return abilityScores;
}

function buildHitDice(crNum, con) {
  const hitDiceNum = Math.max(1, Math.floor(crNum * 2) + 1);
  const hitDiceDie = crNum >= 3 ? 8 : 6;
  const conMod = Math.floor((con - 10) / 2);
  return `${hitDiceNum}d${hitDiceDie}${conMod > 0 ? '+' + conMod * hitDiceNum : ''}`;
}

function rangedRange(name) {
  if (name === 'Longbow') return '150/600 ft.';
  if (name.includes('Heavy')) return '100/400 ft.';
  return '80/320 ft.';
}

function formatMod(mod) {
  if (mod === 0) return '';
  return mod > 0 ? '+' + mod : String(mod);
}

function buildSpellAction(crNum, atkBonus) {
  const template = pick(SPELL_ACTION_TEMPLATES);
  // fix#357 x7-census cited :189 (stamp era): PRODUCER is this file's own
  // SPELL_ACTION_TEMPLATES module constant (2 templates x names/damageDice 5+5
  // parallel, non-empty by literal) — cannot legitimately yield empty; a length
  // miss = code edit, caught byte-exact by the seed-census action pins. INTENDED,
  // kept quiet; preservation arm in npcGenerator.test.js structural table.
  const idx = Math.floor(Math.random() * template.names.length);
  const dice = scaleDamage(template.damageDice[idx], crNum);
  const dmgNum = rollDiceString(dice);
  return {
    name: template.names[idx],
    attack_bonus: '',
    damage_dice_primary: '',
    damage_type_primary: '',
    description: `Spell Attack Roll: +${atkBonus}, range ${crNum >= 2 ? '60 ft.' : '30 ft.'}. Hit: ${dmgNum} (${dice}) ${template.type} damage.`
  };
}

function buildRangedAction(crNum, atkBonus) {
  const template = pick(RANGED_TEMPLATES);
  // fix#357 cited :203 (stamp era) — same verdict as :189: in-file parallel-literal
  // producer, INTENDED quiet, structural preservation arm.
  const idx = Math.floor(Math.random() * template.names.length);
  const dice = scaleDamage(template.damageDice[idx], crNum);
  const dmgNum = rollDiceString(dice);
  const range = rangedRange(template.names[idx]);
  return {
    name: template.names[idx],
    attack_bonus: `+${atkBonus}`,
    damage_dice_primary: dice,
    damage_type_primary: template.type,
    description: `Ranged Attack Roll: +${atkBonus}, range ${range}. Hit: ${dmgNum} (${dice}) ${template.type} damage.`
  };
}

function buildMeleeAction(crNum, atkBonus, abilityScore) {
  const template = pick(WEAPON_ACTION_TEMPLATES);
  // fix#357 cited :218 (stamp era) — same verdict as :189/:203: in-file parallel-
  // literal producer, INTENDED quiet, structural preservation arm.
  const idx = Math.floor(Math.random() * template.names.length);
  const dice = scaleDamage(template.damageDice[idx], crNum);
  const dmgNum = rollDiceString(dice);
  const modStr = formatMod(Math.floor((abilityScore - 10) / 2));
  return {
    name: template.names[idx],
    attack_bonus: `+${atkBonus}`,
    damage_dice_primary: modStr ? `${dice}${modStr}` : dice,
    damage_type_primary: template.type,
    description: `Melee Attack Roll: +${atkBonus}, reach 5 ft. Hit: ${dmgNum} (${dice}${modStr}) ${template.type} damage.`
  };
}

function chooseActionBuilder(templateRoll, isCaster) {
  if (isCaster && templateRoll > 0.4) return buildSpellAction;
  if (templateRoll > 0.6) return buildRangedAction;
  return buildMeleeAction;
}

function buildActions(crNum, isCaster, atkBonus, abilityScore) {
  const actions = [];
  const actionsCount = crNum >= 3 ? 3 : crNum >= 1 ? 2 : 1;
  for (let i = 0; i < actionsCount; i++) {
    const builder = chooseActionBuilder(Math.random(), isCaster);
    actions.push(builder(crNum, atkBonus, abilityScore));
  }
  return actions;
}

function rollTraits(crNum) {
  if (crNum >= 1 && Math.random() > 0.5) {
    return [pick(TRAIT_POOL)];
  }
  return [];
}

function generateStatBlock(role) {
  const crNum = rollChallengeRating();
  const profBonus = crNum >= 9 ? 4 : crNum >= 4 ? 3 : 2;
  const abilityScore = 10 + Math.floor(crNum * 1.5) + (Math.random() > 0.5 ? 1 : 0);
  const hpRange = getHPRange(crNum);
  const hp = randomInt(hpRange[0], hpRange[1]);
  const acRange = getACRange(crNum);
  const ac = randomInt(acRange[0], acRange[1]);
  const atkBonus = profBonus + Math.max(0, Math.floor(crNum * 0.7));
  const isCaster = /wizard|sorcerer|warlock|cleric|druid|bard|mage|priest/i.test(role);
  const speed = rollSpeeds(crNum);
  const abilityScores = rollAbilityScores(crNum, abilityScore, isCaster);
  const hitDice = buildHitDice(crNum, abilityScores.con);
  const actions = buildActions(crNum, isCaster, atkBonus, abilityScore);
  const traits = rollTraits(crNum);

  return {
    armorClass: ac,
    hitPoints: String(hp),
    hitDice: hitDice,
    initiativeBonus: String(Math.floor((abilityScores.dex - 10) / 2)),
    speed,
    abilityScores,
    savingThrowBonuses: {},
    skillBonuses: {},
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    actions,
    traits: traits.length > 0 ? traits.map(t => `**${t.name}.** ${t.description}`).join('\n') : '',
    reactions: '',
  };
}

export async function generateNPC(existingNPCs = []) {
  const [names, traits] = await Promise.all([loadNameData(), loadTraitData()]);

  const race = pickFrom(traits.races, 'races'); // fix#357 x7 site 1/7
  const gender = Math.random() > 0.5 ? 'male' : 'female';

  const raceNames = names[race];
  // Presence+non-empty law (#1180): the old fallback
  // `pick(fallbackNames[gender] || fallbackNames['male'] || [])` short-circuited
  // only on ABSENT keys — a present-but-empty Human gender pool leaked
  // pick([]) === undefined as an unnamed NPC slot (npc.name === undefined then
  // crashes getDefaultFormData consumers via formData.name.trim()). Mirror the
  // same fallback SHAPE race->Human(gender)->Human(male), every arm length-checked;
  // exhausted data is LOUD (#app no-fallbacks), never an undefined leak.
  const humanNames = names['Human'];
  const namePool = firstNonEmpty(
    raceNames && raceNames[gender],
    humanNames && humanNames[gender],
    humanNames && humanNames['male']
  );
  if (!namePool) {
    console.error(`npcGenerator: no non-empty name pool for race '${race}' gender '${gender}' (Human fallback empty or absent)`);
    throw new Error('npcGenerator: name data has no usable pool');
  }
  const name = pick(namePool);

  const classRole = pickFrom(traits.classRoles, 'classRoles'); // fix#357 x7 site 2/7
  const attitude = pickFrom(traits.attitudes, 'attitudes'); // fix#357 x7 site 3/7
  const appearance = pickFrom(traits.appearances, 'appearances'); // fix#357 x7 site 4/7
  const personality = pickFrom(traits.personalities, 'personalities'); // fix#357 x7 site 5/7
  const goals = pickFrom(traits.goals, 'goals'); // fix#357 x7 site 6/7
  const secrets = pickFrom(traits.secrets, 'secrets'); // fix#357 x7 site 7/7
  const numTags = randomInt(1, 3);
  // tags is a pickN site, NOT in the fix#197 x7 pick census. Kept as-is fix#357:
  // absent key TypeErrors at [...undefined] (loud already), present-empty yields ''
  // (zero-is-data honest output) — no ||-chain, nothing to announce.
  const tags = pickN(traits.tags, numTags).join(', ');

  let uniqueName = name;
  let counter = 2;
  const existingNames = existingNPCs.map(n => n.name);
  while (existingNames.includes(uniqueName)) {
    uniqueName = `${name} ${counter}`;
    counter++;
  }

  const includeStatBlock = Math.random() > 0.3;
  const statBlock = includeStatBlock ? generateStatBlock(classRole) : {};

  return {
    name: uniqueName,
    race,
    classRole,
    attitude,
    appearance,
    personality,
    goals,
    secrets,
    tags,
    notes: '',
    ...statBlock,
  };
}
