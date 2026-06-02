import { loadMapData } from './mapsService.js';
import { getDistanceFeet } from './rangeValidation.js';
import { getRuntimeValue } from '../hooks/useRuntimeState.js';

const CANNOT_ACT_CONDITIONS = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];
const DEFAULT_AURA_RANGE_FT = 10;
const EXPANDED_AURA_RANGE_FT = 30;

function hasAuraOfProtection(character) {
  const cls = character?.class;
  if (!cls || !character.level) return false;

  if (cls.class_levels) {
    for (const lvl of cls.class_levels) {
      if (lvl.level > character.level) break;
      if (lvl.class_specific?.aura_range >= 10) return true;
    }
    return false;
  }

  return cls.name === 'Paladin' && character.level >= 6;
}

function getAuraRange(character) {
  const cls = character?.class;
  if (!cls || !character.level) return DEFAULT_AURA_RANGE_FT;

  if (cls.class_levels) {
    const idx = Math.min(character.level, cls.class_levels.length) - 1;
    const entry = cls.class_levels[Math.max(0, idx)];
    const range = entry?.class_specific?.aura_range;
    if (range >= 30) return EXPANDED_AURA_RANGE_FT;
    return DEFAULT_AURA_RANGE_FT;
  }

  return character.level >= 18 ? EXPANDED_AURA_RANGE_FT : DEFAULT_AURA_RANGE_FT;
}

function getChaModifier(character) {
  const cha = character.abilities?.find(a => a.name === 'Charisma');
  if (cha?.bonus != null) return cha.bonus;
  if (cha) return Math.floor((cha.baseScore + cha.abilityImprovements + cha.miscBonus - 10) / 2);
  return 0;
}

function hasCannotActCondition(sourceName, campaignName) {
  try {
    const conditions = getRuntimeValue(sourceName, 'activeConditions');
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
    const range = sourceChar ? getAuraRange(sourceChar) : DEFAULT_AURA_RANGE_FT;
    return dist <= range;
  } catch {
    return true;
  }
}

export async function computeAuraBonus({ targetName, characters, campaignName, activeMapName }) {
  let bestBonus = 0;
  let bestSource = null;

  for (const character of characters) {
    const name = character.name;
    if (!name || name === targetName) continue;
    if (!hasAuraOfProtection(character)) continue;
    if (hasCannotActCondition(name, campaignName)) continue;
    const chaMod = getChaModifier(character);
    const bonus = Math.max(1, chaMod);
    const inRange = await isWithinRange(name, targetName, campaignName, activeMapName, characters);
    if (!inRange) continue;
    if (bonus > bestBonus) {
      bestBonus = bonus;
      bestSource = name;
    }
  }

  return { bonus: bestBonus, sourceName: bestSource };
}
