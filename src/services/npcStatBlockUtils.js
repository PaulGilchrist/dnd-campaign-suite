export function findNPCByName(npcName, npcs) {
  if (!npcName || !npcs?.length) return null;
  const baseName = npcName.replace(/\s+\d+$/, '');
  return npcs.find(n => {
    if (!npcHasStatBlock(n)) return false;
    return n.name?.toLowerCase() === baseName.toLowerCase();
  }) || null;
}

export function npcHasStatBlock(npc) {
  return npc && typeof npc.armorClass === 'number';
}

export function calculateAbilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

export function npcToMonsterFormat(npc) {
  if (!npc) return null;
  const abs = npc.abilityScores || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const abMods = {};
  for (const [key, val] of Object.entries(abs)) {
    abMods[key] = calculateAbilityModifier(val);
  }

  const saves = {};
  const saveBonuses = npc.savingThrowBonuses || {};
  for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    const bonus = saveBonuses[ab];
    if (bonus !== undefined && bonus !== null && bonus !== '') {
      saves[ab] = { modifier: Number(bonus) };
    }
  }

  const skills = {};
  const skillBonuses = npc.skillBonuses || {};
  for (const [name, bonus] of Object.entries(skillBonuses)) {
    if (bonus !== undefined && bonus !== null && bonus !== '') {
      skills[name] = { modifier: Number(bonus) };
    }
  }

  let initiativeDetails = null;
  if (npc.initiativeBonus !== undefined && npc.initiativeBonus !== null && npc.initiativeBonus !== '') {
    const bonus = Number(npc.initiativeBonus);
    initiativeDetails = `${bonus >= 0 ? '+' : ''}${bonus}`;
  }

  return {
    name: npc.name || 'Unknown',
    size: npc.size || 'Medium',
    type: npc.classRole || 'NPC',
    subtype: null,
    alignment: 'Unaligned',
    armor_class: npc.armorClass ?? 10,
    hit_points: npc.hitPoints || '',
    hit_dice: npc.hitDice || '',
    speed: npc.speed || { walk: '30 ft.' },
    initiative_details: initiativeDetails,
    ability_scores: abs,
    ability_score_modifiers: abMods,
    saving_throws: saves,
    skills,
    senses: { passive_perception: 10 + (abMods.wis || 0) },
    languages: '',
    damage_vulnerabilities: [],
    damage_resistances: npc.damageResistances || [],
    damage_immunities: npc.damageImmunities || [],
    condition_immunities: npc.conditionImmunities || [],
    challenge_rating: null,
    xp: null,
    legendary_resistance: null,
    traits: npc.traits || [],
    actions: npc.actions || [],
    reactions: npc.reactions || [],
    legendary_actions: [],
    lair_actions: null,
    regional_effects: null,
    desc: null,
   };
}
