export const ABILITY_ABBR = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

export const ATTITUDE_OPTIONS = [
  { value: 'deep bonds', label: 'Deep Bonds' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'extreme opposition', label: 'Extreme Opposition' },
];

export const ATTITUDE_COLORS = {
  'deep bonds': { bg: '#1a472a', color: '#90ee90', border: '#2d6a4f' },
  positive: { bg: '#1b4332', color: '#b7e4c7', border: '#40916c' },
  neutral: { bg: '#4a4a4a', color: '#e0e0e0', border: '#6b6b6b' },
  negative: { bg: '#7b241c', color: '#f4a0a0', border: '#a43330' },
  'extreme opposition': { bg: '#5c030e', color: '#ff6b6b', border: '#8b0000' },
};

export function getDefaultFormData(overrides = {}) {
  return {
    name: '',
    race: '',
    classRole: '',
    appearance: '',
    personality: '',
    goals: '',
    secrets: '',
    notes: '',
    tags: '',
    attitude: 'neutral',
    image: '',
    imageName: '',
    imagePath: '',
    armorClass: 10,
    hitPoints: '',
    hitDice: '',
    initiativeBonus: '',
    speed: { walk: '30 ft.' },
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrowBonuses: {},
    skillBonuses: {},
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    actions: [],
    traits: '',
    reactions: '',
    ...overrides,
  };
}

export function cleanNPCData(data) {
  const cleaned = { ...data };
  if (cleaned.armorClass === null || cleaned.armorClass === undefined || cleaned.armorClass === '') {
    cleaned.armorClass = 10;
  }
  if (typeof cleaned.armorClass !== 'number') {
    console.error(`[AC] NPC "${cleaned.name}" has invalid AC: ${cleaned.armorClass}. Defaulting to 10.`);
    cleaned.armorClass = 10;
  }
  return cleaned;
}

export function getAttitudeStyle(attitude) {
  const colors = ATTITUDE_COLORS[attitude] || ATTITUDE_COLORS.neutral;
  return {
    backgroundColor: colors.bg,
    color: colors.color,
    borderColor: colors.border,
  };
}
