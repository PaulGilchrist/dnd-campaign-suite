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

function generateStatBlock(role) {
  const crRoll = Math.random();
  let cr;
  if (crRoll < 0.25) cr = 0;
  else if (crRoll < 0.45) cr = 0.125;
  else if (crRoll < 0.60) cr = 0.25;
  else if (crRoll < 0.72) cr = 0.5;
  else if (crRoll < 0.82) cr = 1;
  else if (crRoll < 0.89) cr = 2;
  else if (crRoll < 0.94) cr = 3;
  else if (crRoll < 0.97) cr = 4;
  else cr = 5;

  const crNum = cr;
  const profBonus = crNum >= 9 ? 4 : crNum >= 4 ? 3 : 2;
  const abilityScore = 10 + Math.floor(crNum * 1.5) + (Math.random() > 0.5 ? 1 : 0);
  const hpRange = getHPRange(crNum);
  const hp = randomInt(hpRange[0], hpRange[1]);
  const acRange = getACRange(crNum);
  const ac = randomInt(acRange[0], acRange[1]);
  const atkBonus = profBonus + Math.max(0, Math.floor(crNum * 0.7));
  const isCaster = /wizard|sorcerer|warlock|cleric|druid|bard|mage|priest/i.test(role);
  const speed = { walk: '30 ft.' };

  if (crNum >= 2 && Math.random() > 0.75) {
    const extraSpeeds = ['fly', 'swim', 'climb', 'burrow'];
    const extra = pick(extraSpeeds);
    speed[extra] = '30 ft.';
  }

  const primaryAbilities = ['str', 'dex'];
  if (isCaster) primaryAbilities.push('int', 'wis', 'cha');
  const primaryAbility = pick(primaryAbilities);

  const abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  abilityScores[primaryAbility] = abilityScore;
  const others = ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter(a => a !== primaryAbility);
  const secondary = pick(others);
  abilityScores[secondary] = 10 + Math.floor(crNum);
  abilityScores.con = Math.max(abilityScores.con, 10 + Math.floor(crNum * 0.8));

  const hitDiceNum = Math.max(1, Math.floor(crNum * 2) + 1);
  const hitDiceDie = crNum >= 3 ? 8 : 6;
  const conMod = Math.floor((abilityScores.con - 10) / 2);
  const hitDice = `${hitDiceNum}d${hitDiceDie}${conMod > 0 ? '+' + conMod * hitDiceNum : ''}`;

  const actions = [];
  const actionsCount = crNum >= 3 ? 3 : crNum >= 1 ? 2 : 1;
  for (let i = 0; i < actionsCount; i++) {
    const templateRoll = Math.random();
    if (isCaster && templateRoll > 0.4) {
      const template = pick(SPELL_ACTION_TEMPLATES);
      const idx = Math.floor(Math.random() * template.names.length);
      const dice = scaleDamage(template.damageDice[idx], crNum);
      const dmgNum = rollDiceString(dice);
      actions.push({
        name: template.names[idx],
        attack_bonus: '',
        damage_dice_primary: '',
        damage_type_primary: '',
        description: `Spell Attack Roll: +${atkBonus}, range ${crNum >= 2 ? '60 ft.' : '30 ft.'}. Hit: ${dmgNum} (${dice}) ${template.type} damage.`
      });
    } else if (templateRoll > 0.6) {
      const template = pick(RANGED_TEMPLATES);
      const idx = Math.floor(Math.random() * template.names.length);
      const dice = scaleDamage(template.damageDice[idx], crNum);
      const dmgNum = rollDiceString(dice);
      const range = template.names[idx] === 'Longbow' ? '150/600 ft.' : template.names[idx].includes('Heavy') ? '100/400 ft.' : '80/320 ft.';
      actions.push({
        name: template.names[idx],
        attack_bonus: `+${atkBonus}`,
        damage_dice_primary: dice,
        damage_type_primary: template.type,
        description: `Ranged Attack Roll: +${atkBonus}, range ${range}. Hit: ${dmgNum} (${dice}) ${template.type} damage.`
      });
    } else {
      const template = pick(WEAPON_ACTION_TEMPLATES);
      const idx = Math.floor(Math.random() * template.names.length);
      const dice = scaleDamage(template.damageDice[idx], crNum);
      const dmgNum = rollDiceString(dice);
      const primaryMod = Math.floor((abilityScore - 10) / 2);
      const modStr = primaryMod !== 0 ? (primaryMod > 0 ? '+' + primaryMod : String(primaryMod)) : '';
      actions.push({
        name: template.names[idx],
        attack_bonus: `+${atkBonus}`,
        damage_dice_primary: modStr ? `${dice}${modStr}` : dice,
        damage_type_primary: template.type,
        description: `Melee Attack Roll: +${atkBonus}, reach 5 ft. Hit: ${dmgNum} (${dice}${modStr}) ${template.type} damage.`
      });
    }
  }

  const traits = [];
  if (crNum >= 1 && Math.random() > 0.5) {
    traits.push(pick(TRAIT_POOL));
  }

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

  const race = pick(traits.races);
  const gender = Math.random() > 0.5 ? 'male' : 'female';

  let name = '';
  const raceNames = names[race];
  if (raceNames && raceNames[gender] && raceNames[gender].length > 0) {
    name = pick(raceNames[gender]);
  } else {
    const fallbackNames = names['Human'];
    name = pick(fallbackNames[gender] || fallbackNames['male'] || []);
  }

  const classRole = pick(traits.classRoles);
  const attitude = pick(traits.attitudes);
  const appearance = pick(traits.appearances);
  const personality = pick(traits.personalities);
  const goals = pick(traits.goals);
  const secrets = pick(traits.secrets);
  const numTags = randomInt(1, 3);
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
