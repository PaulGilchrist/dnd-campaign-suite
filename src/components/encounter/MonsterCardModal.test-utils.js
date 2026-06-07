export const defaultConditionEffects = {
  attackAdvantageCount: 0,
  attackDisadvantageCount: 0,
  abilityCheckDisadvantage: false,
  autoFailSaves: [],
  saveDisadvantage: [],
  cannotAct: false,
  speedZero: false,
  concentrationBroken: false,
  targetAdvantageCount: 0,
  targetDisadvantageCount: 0,
  targetAdvantageIfWithin5ft: false,
  targetDisadvantageIfBeyond5ft: false,
  autoCritWithin5ft: false,
  resistantToAll: false,
  poisonImmune: false,
  saveAdvantage: [],
  saveAdvantageCount: 0,
  saveDisadvantageCount: 0,
  autoReroll: false,
  autoRerollCondition: null,
  autoRerollBonus: null,
};

export function makeMonster(overrides = {}) {
  return {
    name: 'Goblin',
    size: 'Small',
    type: 'humanoid',
    subtype: '',
    alignment: 'neutral evil',
    armor_class: 15,
    hit_points: 7,
    hit_dice: '2d6',
    speed: { walk: '30 ft.' },
    ability_scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 10 },
    ability_score_modifiers: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: 0 },
    saving_throws: {},
    skills: {},
    senses: null,
    languages: 'Common',
    damage_vulnerabilities: [],
    damage_resistances: [],
    damage_immunities: [],
    condition_immunities: [],
    challenge_rating: '1/4',
    xp: 25,
    actions: [],
    traits: [],
    reactions: [],
    legendary_actions: [],
    lair_actions: [],
    regional_effects: [],
    desc: null,
    book: null,
    page: null,
    ...overrides,
  };
}

export function makeProps(monster, overrides = {}) {
  return {
    monster,
    onClose: vi.fn(),
    campaignName: 'test-campaign',
    creatures: [],
    creatureName: '',
    mapName: null,
    characters: [],
    ...overrides,
  };
}

export function hasEntries(obj) {
  return obj && Object.keys(obj).length > 0;
}

export function hasSenseEntries(senses) {
  if (!senses) return false;
  return senses.blindsight || senses.darkvision || senses.truesight || senses.tremorsense || senses.passive_perception;
}

export function saveAbilityAbbr(full) {
  const map = { Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON', Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA' };
  return map[full] || full?.substring(0, 3).toUpperCase();
}

export const abilityNameMap = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

export function parseInitiativeBonus(initStr) {
  if (!initStr) return null;
  const match = initStr.match(/^([+-]\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function parseExtraDamageDice(damageStr, excludeFormula) {
  if (!damageStr) return [];
  const re = /(\d+d\d+(?:\s*\+\s*\d+)?)/g;
  const matches = [];
  let m;
  const exclude = (excludeFormula || '').replace(/\s+/g, '');
  while ((m = re.exec(damageStr)) !== null) {
    const formula = m[1].trim();
    if (formula.replace(/\s+/g, '') !== exclude) {
      matches.push(formula);
    }
  }
  return matches;
}

export function formatSenses(senses) {
  const parts = [];
  if (senses.blindsight) parts.push(`blindsight ${senses.blindsight}`);
  if (senses.darkvision) parts.push(`darkvision ${senses.darkvision}`);
  if (senses.truesight) parts.push(`truesight ${senses.truesight}`);
  if (senses.tremorsense) parts.push(`tremorsense ${senses.tremorsense}`);
  if (senses.passive_perception) parts.push(`passive Perception ${senses.passive_perception}`);
  return parts.join(', ');
}
