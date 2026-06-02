import { loadMapData } from './mapsService.js';
import { getDistanceFeet } from './rangeValidation.js';
import storage from './storage.js';

const CANNOT_ACT_CONDITIONS = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];
const DEFAULT_AURA_RANGE_FT = 10;
const EXPANDED_AURA_RANGE_FT = 30;

let classesCache = null;

async function getClasses(rules) {
  if (!classesCache) {
    try {
      const [e5, r2024] = await Promise.all([
        fetch('/data/classes.json').then(r => r.json()),
        fetch('/data/2024/classes.json').then(r => r.json()),
      ]);
      classesCache = { '5e': e5, '2024': r2024 };
    } catch {
      classesCache = { '5e': [], '2024': [] };
    }
  }
  return classesCache[rules || '5e'] || [];
}

function getChaModifier(character) {
  const cha = character.abilities?.find(a => a.name === 'Charisma');
  return cha?.bonus || 0;
}

function hasAuraFeature(classData, level) {
  if (!classData?.class_levels) return false;
  for (const lvl of classData.class_levels) {
    if (lvl.level > level) break;
    if (lvl.class_specific?.aura_range >= 10) return true;
  }
  return false;
}

function getAuraRangeFromClass(classData, level) {
  if (!classData?.class_levels) return DEFAULT_AURA_RANGE_FT;
  const entry = classData.class_levels.find(cl => cl.level === Math.min(level, classData.class_levels.length));
  const range = entry?.class_specific?.aura_range;
  if (range >= 30) return EXPANDED_AURA_RANGE_FT;
  if (range >= 10) return DEFAULT_AURA_RANGE_FT;
  return DEFAULT_AURA_RANGE_FT;
}

async function hasAuraOfProtection(character) {
  if (!character?.class?.name || !character.level) {
    console.log('[Aura] Missing class.name or level:', character?.name, character?.class?.name, character?.level);
    return false;
  }
  if (character.class?.class_levels) {
    return hasAuraFeature(character.class, character.level);
  }
  const classes = await getClasses(character.rules);
  const classData = classes.find(c => c.name === character.class.name);
  if (!classData) {
    console.log('[Aura] Class not found in JSON:', character.class.name, 'rules:', character.rules);
    return false;
  }
  const result = hasAuraFeature(classData, character.level);
  console.log('[Aura] hasAuraOfProtection:', character.name, character.class.name, 'level', character.level, '=>', result);
  return result;
}

async function getAuraRange(character) {
  if (!character?.class?.name || !character.level) return DEFAULT_AURA_RANGE_FT;
  if (character.class?.class_levels) {
    return getAuraRangeFromClass(character.class, character.level);
  }
  const classes = await getClasses(character.rules);
  const classData = classes.find(c => c.name === character.class.name);
  if (!classData) return character.level >= 18 ? EXPANDED_AURA_RANGE_FT : DEFAULT_AURA_RANGE_FT;
  return getAuraRangeFromClass(classData, character.level);
}

function hasCannotActCondition(sourceName, campaignName) {
  try {
    const conditions = storage.getProperty(sourceName, 'activeConditions', campaignName);
    if (!Array.isArray(conditions)) return false;
    return conditions.some(c => CANNOT_ACT_CONDITIONS.includes(c));
  } catch {
    return false;
  }
}

async function isWithinRange(sourceName, targetName, campaignName, activeMapName, characters) {
  if (!activeMapName) return true;
  try {
    const data = await loadMapData(campaignName, activeMapName);
    if (!data?.players?.length) return true;
    const sourcePlayer = data.players.find(p => p.name === sourceName);
    const targetPlayer = data.players.find(p => p.name === targetName);
    if (!sourcePlayer || !targetPlayer) return true;
    const dist = getDistanceFeet(sourcePlayer, targetPlayer);
    if (dist == null) return true;
    const sourceChar = characters?.find(c => c.name === sourceName);
    const range = await (sourceChar ? getAuraRange(sourceChar) : Promise.resolve(DEFAULT_AURA_RANGE_FT));
    return dist <= range;
  } catch {
    return true;
  }
}

export async function computeAuraBonus({ targetName, characters, campaignName, activeMapName }) {
  await Promise.all([getClasses('5e'), getClasses('2024')]);

  let bestBonus = 0;
  let bestSource = null;

  console.log('[Aura] computeAuraBonus called:', { targetName, characterCount: characters?.length, campaignName, activeMapName });
  for (const character of characters) {
    const name = character.name;
    if (!name || name === targetName) continue;
    if (!(await hasAuraOfProtection(character))) continue;
    console.log('[Aura] Found aura granter:', name);
    if (hasCannotActCondition(name, campaignName)) continue;
    const chaMod = getChaModifier(character);
    const bonus = Math.max(1, chaMod);
    console.log('[Aura] CHA mod for', name, ':', chaMod, 'bonus:', bonus);
    const inRange = await isWithinRange(name, targetName, campaignName, activeMapName, characters);
    if (!inRange) continue;
    if (bonus > bestBonus) {
      bestBonus = bonus;
      bestSource = name;
    }
  }

  console.log('[Aura] Result:', { bonus: bestBonus, sourceName: bestSource });
  return { bonus: bestBonus, sourceName: bestSource };
}
