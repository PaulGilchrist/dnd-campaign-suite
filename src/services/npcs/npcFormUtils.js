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
    armorClass: null,
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
  // AC stays null until the GM fills in real combat stats — a defaulted 10
  // would make every NPC look combat-ready and let them enter initiative.
  if (cleaned.armorClass === '' || cleaned.armorClass === undefined) {
    cleaned.armorClass = null;
  } else if (typeof cleaned.armorClass === 'string') {
    const parsed = parseInt(cleaned.armorClass, 10);
    if (Number.isNaN(parsed)) {
      console.error(`[AC] NPC "${cleaned.name}" has invalid AC: ${cleaned.armorClass}. Leaving AC blank.`);
      cleaned.armorClass = null;
    } else {
      cleaned.armorClass = parsed;
    }
  }
  if (cleaned.hitPoints === '') {
    cleaned.hitPoints = null;
  }
  return cleaned;
}

/**
 * Project editor state into the AUTHORED-ROW shape for the AI refine lane
 * (server/services/ai/authoring/entitySchemas.js npcSchema). The CRUD lane
 * legitimately carries the GM-owned avatar upload fields, but npcSchema is
 * additionalProperties:false with integer-typed armorClass/hitPoints — so
 * refine must never send them. Server preflight already strips the
 * server-owned stamps (id/updatedAt/savedAt/draft); initiativeBonus stays a
 * STRING (the schema's type for it), so it needs no coercion here.
 */
export function projectNPCForRefine(data) {
  const projected = cleanNPCData(data);
  for (const field of ['image', 'imageName', 'imagePath']) {
    delete projected[field];
  }
  // cleanNPCData only maps '' → null for HP; the HP input keeps the raw
  // string the GM typed, so numeric-string → integer coercion happens here.
  if (typeof projected.hitPoints === 'string') {
    const parsed = parseInt(projected.hitPoints, 10);
    if (Number.isNaN(parsed)) {
      console.error(`[HP] NPC "${projected.name}" has non-numeric HP: ${projected.hitPoints}. Refining without HP.`);
      projected.hitPoints = null;
    } else {
      projected.hitPoints = parsed;
    }
  }
  return projected;
}

export function getAttitudeStyle(attitude) {
  const colors = ATTITUDE_COLORS[attitude] || ATTITUDE_COLORS.neutral;
  return {
    backgroundColor: colors.bg,
    color: colors.color,
    borderColor: colors.border,
  };
}
