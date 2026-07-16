import { loadMapData } from '../../maps/mapsService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { isDistanceInRange } from '../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export const CANNOT_ACT_CONDITIONS = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];
export const DEFAULT_AURA_RANGE_FT = 10;
export const EXPANDED_AURA_RANGE_FT = 30;

export function hasAura(playerStats, auraName) {
  return playerStats?.automation?.passives?.some(p => p.name === auraName) ?? false;
}

export function hasAuraOfProtection(playerStats) {
  return hasAura(playerStats, 'Aura of Protection');
}

export function getAuraRangeFromStats(playerStats) {
  if (hasAura(playerStats, 'Aura Expansion')) return EXPANDED_AURA_RANGE_FT;
  return DEFAULT_AURA_RANGE_FT;
}

export function getChaModifier(playerStats) {
  const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
  if (cha?.bonus != null) return cha.bonus;
  if (cha) return Math.floor((cha.baseScore + cha.featIncrease + cha.miscIncrease - 10) / 2);
  return 0;
}

export function hasCannotActCondition(sourceName, _campaignName) {
  try {
    const conditions = getRuntimeValue(sourceName, 'activeConditions');
    if (!Array.isArray(conditions)) return false;
    return conditions.some(c => CANNOT_ACT_CONDITIONS.includes(c));
  } catch {
    return false;
  }
}

export async function isWithinRange(sourceName, targetName, campaignName, activeMapName, computedCharacters) {
  if (!activeMapName) return true;
  try {
    const data = await loadMapData(campaignName, activeMapName);
    if (!data?.players?.length) return true;
    const sourcePlayer = data.players.find(p => p.name === sourceName);
    const targetPlayer = data.players.find(p => p.name === targetName);
    if (!sourcePlayer || !targetPlayer) return true;
    const dist = getDistanceFeet(sourcePlayer, targetPlayer);
    if (dist == null) return true;
    const sourceEntry = computedCharacters?.find(c => c.name === sourceName);
    const range = sourceEntry?.computedStats ? getAuraRangeFromStats(sourceEntry.computedStats) : DEFAULT_AURA_RANGE_FT;
    return isDistanceInRange(dist, range);
  } catch {
    return true;
  }
}

export async function computeAuraBonus({ targetName, characters, campaignName, activeMapName }) {
  let bestBonus = 0;
  let bestSource = null;

  for (const entry of characters) {
    const name = entry.name;
    const stats = entry.computedStats;
    if (!name) continue;
    if (!stats || !hasAuraOfProtection(stats)) continue;
    if (hasCannotActCondition(name, campaignName)) continue;
    const storedAllies = getRuntimeValue(name, 'selectedAllies', campaignName);
    if (Array.isArray(storedAllies) && storedAllies.length > 0) {
      if (!storedAllies.includes(targetName)) continue;
    }
    const chaMod = getChaModifier(stats);
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
