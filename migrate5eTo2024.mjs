/**
 * One-time migration: convert 5e monsters to 2024 schema and merge into 2024 data.
 *
 * - For 5e-only monsters: full conversion to 2024 schema
 * - For overlapping monsters: fill any missing fields from 5e data (lair_actions, regional_effects, book, desc, page, image)
 * - For all 5e actions: parse desc text to extract attack_bonus, damage_dice, save_dc, save_type
 * - After running: delete public/data/monsters.json (5e file)
 *
 * Usage: node migrate5eTo2024.mjs [--dry-run]
 */

import fs from 'fs';

const DRY_RUN = process.argv.includes('--dry-run');
const FIVE_E_PATH = 'public/data/monsters.json';
const TWENTY_TW_PATH = 'public/data/2024/monsters.json';

const ABILITY_MAP = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };
const FULL_ABILITY = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

function scoreToModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Parse dice expression from description text.
 * Matches patterns like "1d8 + 3", "1d8+3", "2d6", "2d10 + 10"
 */
function parseDiceFromDesc(desc) {
  if (!desc) return null;
  const match = desc.match(/(\d+)d(\d+)\s*\+\s*(\d+)/i);
  if (!match) {
    const simple = desc.match(/(\d+)d(\d+)/i);
    if (!simple) return null;
    return { count: parseInt(simple[1], 10), sides: parseInt(simple[2], 10), modifier: 0 };
  }
  return { count: parseInt(match[1], 10), sides: parseInt(match[2], 10), modifier: parseInt(match[3], 10) };
}

/**
 * Extract attack bonus from description text.
 * Matches "+5 to hit" (5e) or "+5," / "+5" after "Attack Roll:" (2024)
 */
function parseAttackBonus(desc) {
  if (!desc) return null;
  const m2024 = desc.match(/Attack Roll:\s*\+(\d+)/i);
  if (m2024) return parseInt(m2024[1], 10);
  const m5e = desc.match(/\+(\d+)\s+to\s+hit/i);
  if (m5e) return parseInt(m5e[1], 10);
  return null;
}

/**
 * Extract damage dice from description text.
 * Matches "Hit: 7 (1d8 + 3) Bludgeoning" or "Failure: 27 (6d8) Psychic"
 */
function parseDamageDice(desc) {
  if (!desc) return null;
  const match = desc.match(/Hit:\s*\d+\s*\((\d+d\d+\s*\+\s*\d+)\)/);
  if (match) return match[1].replace(/\s/g, '');
  return null;
}

/**
 * Extract save DC from description text.
 * Matches "DC 15" or "spell save DC 13"
 */
function parseSaveDc(desc) {
  if (!desc) return null;
  const match = desc.match(/DC\s+(\d+)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Extract save type from description text.
 * Matches "Wisdom Saving Throw", "DEX save", "CON save"
 */
function parseSaveType(desc) {
  if (!desc) return null;
  const fullMatch = desc.match(/^(\w+)\s+Saving Throw:/i);
  if (fullMatch) {
    const word = fullMatch[1].toLowerCase();
    const map = { strength: 'Strength', dexterity: 'Dexterity', constitution: 'Constitution', intelligence: 'Intelligence', wisdom: 'Wisdom', charisma: 'Charisma' };
    return map[word] || word;
  }
  const abbrMatch = desc.match(/^([A-Z][A-Za-z]*)\s+saving throw/i);
  if (abbrMatch) return abbrMatch[1];
  return null;
}

/**
 * Extract reach and range from description text.
 */
function parseReach(desc) {
  if (!desc) return null;
  const match = desc.match(/reach\s+([\d\s/]+ft\.)/i);
  if (match) return match[1].trim();
  return null;
}

function parseRange(desc) {
  if (!desc) return null;
  const match = desc.match(/range\s+([\d/]+ft\.)/i);
  if (match) return match[1].trim();
  return null;
}

/**
 * Extract the numeric damage value before the dice in parentheses.
 * E.g. "Hit: 7 (1d8 + 3)" → 7
 */
function parseDamageValue(desc) {
  if (!desc) return null;
  const match = desc.match(/Hit:\s*(\d+)\s*\(/);
  if (match) return parseInt(match[1], 10);
  const failMatch = desc.match(/Failure:\s*(\d+)\s*\(/);
  if (failMatch) return parseInt(failMatch[1], 10);
  return null;
}

function normalizeProficiencies(proficiencies) {
  const savingThrows = {};
  const skills = {};
  if (proficiencies) {
    for (const prof of proficiencies) {
      if (prof.name.startsWith('Saving Throw:')) {
        const abilityName = prof.name.substring(14, 17).toLowerCase();
        const abilityKey = ABILITY_MAP[abilityName] ? ABILITY_MAP[abilityName] :
          abilityName === 'str' ? 'str' : abilityName === 'dex' ? 'dex' :
            abilityName === 'con' ? 'con' : abilityName === 'int' ? 'int' :
              abilityName === 'wis' ? 'wis' : 'cha';
        savingThrows[abilityKey] = { modifier: prof.value };
      } else if (prof.name.startsWith('Skill:')) {
        const skillName = prof.name.substring(7);
        skills[skillName] = { modifier: prof.value };
      }
    }
  }
  return { savingThrows, skills };
}

function convertActions(actions, version) {
  return (actions || []).map(action => {
    const descKey = action.description ? 'description' : 'desc';
    const desc = action[descKey] || '';
    const attackBonus = action.attack_bonus ?? parseAttackBonus(desc);
    const damageDice = action.damage_dice ?? parseDamageDice(desc);
    const saveDc = action.save_dc ?? parseSaveDc(desc);
    const saveType = action.save_type ?? parseSaveType(desc);
    const damageValue = action.damage_value ?? parseDamageValue(desc);
    const reach = action.reach ?? parseReach(desc);
    const range = action.range ?? parseRange(desc);

    return {
      name: action.name,
      description: desc,
      ...(attackBonus !== null && { attack_bonus: attackBonus }),
      ...(reach && { reach }),
      ...(range && { range }),
      ...(damageDice && { damage_dice: damageDice }),
      ...(damageValue !== null && { damage_value: damageValue }),
      ...(saveDc !== null && { save_dc: saveDc }),
      ...(saveType && { save_type: saveType }),
      ...(action.usage && { usage: action.usage }),
    };
  });
}

function convertLairActions(lairActions) {
  if (!lairActions) return [];
  if (Array.isArray(lairActions)) {
    return lairActions.map(a => typeof a === 'string' ? a : a.description || a.desc || '');
  }
  if (typeof lairActions === 'object') {
    const actions = (lairActions.actions || []).map(a => {
      if (typeof a === 'string') return a;
      return a.desc || a.description || '';
    });
    const result = { actions };
    if (lairActions.summary) result.summary = lairActions.summary;
    if (lairActions.usage) result.usage = lairActions.usage;
  }
  return [];
}

function convertRegionalEffects(regionalEffects) {
  if (!regionalEffects) return {};
  if (Array.isArray(regionalEffects)) return { effects: regionalEffects };
  const effects = (regionalEffects.effects || []).map(e => {
    if (typeof e === 'string') return e;
    return e.description || '';
  });
  const result = { effects };
  if (regionalEffects.summary) result.summary = regionalEffects.summary;
  return result;
}

function convertMonster5eTo2024(m) {
  const { savingThrows, skills } = normalizeProficiencies(m.proficiencies);

  const abilityScores = {
    str: m.strength,
    dex: m.dexterity,
    con: m.constitution,
    int: m.intelligence,
    wis: m.wisdom,
    cha: m.charisma
  };

  const abilityScoreModifiers = {
    str: scoreToModifier(m.strength),
    dex: scoreToModifier(m.dexterity),
    con: scoreToModifier(m.constitution),
    int: scoreToModifier(m.intelligence),
    wis: scoreToModifier(m.wisdom),
    cha: scoreToModifier(m.charisma)
  };

  const actions = convertActions(m.actions, '5e');
  const traits = (m.special_abilities || []).map(a => ({
    name: a.name,
    description: a.desc,
    ...(a.usage && { usage: a.usage }),
    ...(a.recharge && { recharge: a.recharge }),
  }));

  const reactions = (m.reactions || []).map(a => ({
    name: a.name,
    description: a.desc,
    ...(a.usage && { usage: a.usage }),
  }));

  const legendaryActions = (m.legendary_actions || []).map(a => ({
    name: a.name,
    description: a.desc,
    ...(a.usage && { usage: a.usage }),
  }));

  const lairActions = convertLairActions(m.lair_actions);
  const regionalEffects = convertRegionalEffects(m.regional_effects);

  const speed = m.speed || {};

  return {
    index: m.index,
    name: m.name,
    size: m.size,
    type: m.type,
    subtype: m.subtype || null,
    alignment: m.alignment,
    initiative: null,
    initiative_details: null,
    armor_class: m.armor_class,
    armor_class_details: null,
    hit_points: m.hit_points,
    hit_dice: m.hit_dice,
    speed,
    ability_scores: abilityScores,
    ability_score_modifiers: abilityScoreModifiers,
    saving_throws: savingThrows,
    skills,
    senses: m.senses || {},
    immunities: [],
    damage_immunities: m.damage_immunities || [],
    damage_resistances: m.damage_resistances || [],
    damage_vulnerabilities: m.damage_vulnerabilities || [],
    condition_immunities: m.condition_immunities || [],
    languages: m.languages,
    environments: m.environments || [],
    allies: m.allies || null,
    enemies: m.enemies || null,
    challenge_rating: String(m.challenge_rating),
    xp: m.xp,
    proficiency_bonus: null,
    legendary_resistance: null,
    equipment: null,
    habitat: null,
    treasure: null,
    actions,
    traits,
    reactions,
    legendary_actions: legendaryActions,
    lair_actions: lairActions,
    regional_effects: regionalEffects,
    book: m.book || null,
    page: m.page || null,
    desc: m.desc || null,
    image: m.image || null,
  };
}

function main() {
  const fivee = JSON.parse(fs.readFileSync(FIVE_E_PATH, 'utf8'));
  const twentytw = JSON.parse(fs.readFileSync(TWENTY_TW_PATH, 'utf8'));

  const twentytwMap = new Map(twentytw.map(m => [m.index, m]));
  const fiveeMap = new Map(fivee.map(m => [m.index, m]));

  let converted = 0;
  let filled = 0;
  const convertedNames = [];

  for (const [idx, f] of fiveeMap) {
    const existing = twentytwMap.get(idx);
    if (existing) {
      // Fill missing fields from 5e data
      let changed = false;

      if (!existing.book && f.book) { existing.book = f.book; changed = true; }
      if (!existing.page && f.page) { existing.page = f.page; changed = true; }
      if (!existing.desc && f.desc) { existing.desc = f.desc; changed = true; }
      if (!existing.image && f.image) { existing.image = f.image; changed = true; }

      // 5e has more lair_actions/regional_effects — fill from 5e
      if (f.lair_actions && existing.lair_actions) {
        const existingLair = Array.isArray(existing.lair_actions) ? existing.lair_actions : (existing.lair_actions.actions || []);
        const fiveeLair = Array.isArray(f.lair_actions) ? f.lair_actions : (f.lair_actions.actions || []);
        if (fiveeLair.length > existingLair.length) {
          existing.lair_actions = fiveeLair;
          changed = true;
        }
      } else if (f.lair_actions && !existing.lair_actions) {
        const converted = convertLairActions(f.lair_actions);
        existing.lair_actions = converted;
        changed = true;
      }

      if (f.regional_effects && !existing.regional_effects) {
        const converted = convertRegionalEffects(f.regional_effects);
        existing.regional_effects = converted;
        changed = true;
      }

      // Enrich 5e actions with parsed dice data if 2024 actions are missing fields
      if (f.actions && existing.actions) {
        for (let i = 0; i < existing.actions.length && i < f.actions.length; i++) {
          const existingAction = existing.actions[i];
          const fiveeAction = f.actions[i];
          if (!existingAction.attack_bonus && fiveeAction.attack_bonus) {
            existingAction.attack_bonus = fiveeAction.attack_bonus;
          }
        }
      }

      if (changed) filled++;
    } else {
      // Convert 5e-only monster to 2024
      const converted2024 = convertMonster5eTo2024(f);
      twentytwMap.set(idx, converted2024);
      twentytw.push(converted2024);
      converted++;
      convertedNames.push(f.name);
    }
  }

  // Sort by name (alphabetical, case-insensitive)
  twentytw.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  console.log(`Migration results:`);
  console.log(`  - 5e-only monsters converted to 2024: ${converted}`);
  console.log(`  - 2024 monsters enriched from 5e:    ${filled}`);
  console.log(`  - Total monsters after migration:     ${twentytw.length}`);
  console.log(`  - Names added:`);
  convertedNames.forEach(n => console.log(`      ${n}`));

  if (!DRY_RUN) {
    fs.writeFileSync(TWENTY_TW_PATH, JSON.stringify(twentytw, null, 2) + '\n');
    console.log(`\nWrote updated 2024 data to ${TWENTY_TW_PATH}`);
    console.log(`\nNext: delete ${FIVE_E_PATH} (the 5e file is no longer needed)`);
  } else {
    console.log(`\nDRY RUN - no files modified`);
  }
}

main();
