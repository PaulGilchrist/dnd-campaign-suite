export function findNPCByName(npcName, npcs) {
  if (!npcName || !npcs?.length) return null;
  const baseName = npcName.replace(/\s+\d+$/, '');
  return npcs.find(n => {
    if (!npcHasStatBlock(n)) return false;
    return n.name?.toLowerCase() === baseName.toLowerCase();
  }) || null;
}

export function npcHasStatBlock(npc) {
  if (!npc) return false;
  // Combat-ready means the tracker can actually run them: numeric AC and positive HP.
  return typeof npc.armorClass === 'number' && Number.isFinite(npc.armorClass)
    && Number.isFinite(Number(npc.hitPoints))
    && Number(npc.hitPoints) > 0;
}

// An attack is an action the NPC can actually swing with: a name plus an
// attack bonus or damage dice. Used to prompt for a weapon before initiative.
export function npcHasAttacks(npc) {
  return (npc?.actions || []).some(a =>
    a?.name?.trim()
    && (String(a.attack_bonus ?? '').trim() !== '' || String(a.damage_dice_primary ?? '').trim() !== '')
  );
}

// Guaranteed fallback so an NPC in combat always has something to do.
export function defaultUnarmedStrike(npc) {
  const strMod = calculateAbilityModifier(npc?.abilityScores?.str ?? 10);
  const fmt = n => `${n >= 0 ? '+' : ''}${n}`;
  return {
    name: 'Unarmed Strike',
    attack_bonus: fmt(strMod),
    damage_dice_primary: String(Math.max(1 + strMod, 1)),
    damage_type_primary: 'bludgeoning',
    damage_dice_secondary: '',
    damage_type_secondary: '',
    description: 'Fallback attack — add a real weapon in the NPC Stats tab to replace it.'
  };
}

export function calculateAbilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const DEFAULT_ABILITY_SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

function hasModifier(value) {
  return value !== undefined && value !== null && value !== '';
}

function buildAbilityModifiers(abs) {
  const mods = {};
  for (const [key, val] of Object.entries(abs)) {
    mods[key] = calculateAbilityModifier(val);
  }
  return mods;
}

function buildSavingThrows(saveBonuses) {
  const saves = {};
  for (const ab of ABILITY_KEYS) {
    if (hasModifier(saveBonuses[ab])) {
      saves[ab] = { modifier: Number(saveBonuses[ab]) };
    }
  }
  return saves;
}

function buildSkillBonuses(skillBonuses) {
  const skills = {};
  for (const [name, bonus] of Object.entries(skillBonuses)) {
    if (hasModifier(bonus)) {
      skills[name] = { modifier: Number(bonus) };
    }
  }
  return skills;
}

function buildInitiativeDetails(initiativeBonus) {
  if (!hasModifier(initiativeBonus)) return null;
  const bonus = Number(initiativeBonus);
  return `${bonus >= 0 ? '+' : ''}${bonus}`;
}

function buildArmorClass(npc) {
  if (typeof npc.armorClass === 'number') return npc.armorClass;
  console.error(`[AC] NPC "${npc.name}" has no armorClass defined. Defaulting to 10.`);
  return 10;
}

function buildDefenseFields(npc) {
  return {
    damage_vulnerabilities: [],
    damage_resistances: npc.damageResistances || [],
    damage_immunities: npc.damageImmunities || [],
    condition_immunities: npc.conditionImmunities || []
  };
}

function buildActionFields(npc) {
  return {
    traits: npc.traits || [],
    // Never let an NPC enter the combat card with nothing to do.
    actions: (npc.actions || []).length ? npc.actions : [defaultUnarmedStrike(npc)],
    reactions: npc.reactions || [],
    legendary_actions: [],
    lair_actions: null,
    regional_effects: null,
    desc: null
  };
}

export function npcToMonsterFormat(npc) {
  if (!npc) return null;
  const abs = npc.abilityScores || DEFAULT_ABILITY_SCORES;
  const abMods = buildAbilityModifiers(abs);

  return {
    name: npc.name || 'Unknown',
    size: npc.size || 'Medium',
    type: npc.classRole || 'NPC',
    subtype: null,
    alignment: 'Unaligned',
    armor_class: buildArmorClass(npc),
    hit_points: npc.hitPoints || '',
    hit_dice: npc.hitDice || '',
    speed: npc.speed || { walk: '30 ft.' },
    initiative_details: buildInitiativeDetails(npc.initiativeBonus),
    ability_scores: abs,
    ability_score_modifiers: abMods,
    saving_throws: buildSavingThrows(npc.savingThrowBonuses || {}),
    skills: buildSkillBonuses(npc.skillBonuses || {}),
    senses: { passive_perception: 10 + (abMods.wis || 0) },
    languages: '',
    ...buildDefenseFields(npc),
    challenge_rating: null,
    xp: null,
    legendary_resistance: null,
    ...buildActionFields(npc)
  };
}
