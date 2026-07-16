import { loadMapData } from '../../maps/mapsService.js';
import { getDistanceFeet } from './rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Universal range check — single source of truth.
 * ALL range checks in the codebase must go through this function.
 *
 * @param {string} sourceName
 * @param {string} targetName
 * @param {number|null} inRangeDistance — in feet, null means always in range
 * @returns {Promise<boolean>}
 */
export async function isWithinRange(sourceName, targetName, inRangeDistance) {
  const campaignName = getRuntimeValue('__campaign__', 'campaignName');
  const activeMapName = getRuntimeValue('__map__', 'activeMapName');
  if (!activeMapName) return true;
  if (inRangeDistance == null) return true;
  try {
    const data = await loadMapData(campaignName, activeMapName);
    if (!data) return true;
    const source = data.players?.find(p => p.name === sourceName)
      ?? data.placedItems?.find(p => p.name === sourceName);
    const target = data.players?.find(p => p.name === targetName)
      ?? data.placedItems?.find(p => p.name === targetName);
    if (!source || !target) return true;
    const dist = getDistanceFeet(source, target);
    if (dist == null) return true;
    return dist <= inRangeDistance;
  } catch {
    return true;
  }
}

/**
 * Pure distance comparator — for cases where distance is already computed.
 * Internal use only; prefer isWithinRange for all new code.
 */
export function isDistanceInRange(dist, rangeFt) {
  if (rangeFt == null) return true;
  return dist == null || dist <= rangeFt;
}
