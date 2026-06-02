import { getRuntimeValue } from '../../../hooks/useRuntimeState.js';

export function getActiveBuffs(playerName, campaignName) {
  void campaignName;
  const buffs = getRuntimeValue(playerName, 'activeBuffs');
  return Array.isArray(buffs) ? buffs : [];
}
