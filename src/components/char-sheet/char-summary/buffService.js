import storage from '../../../services/storage.js';

export function getActiveBuffs(playerName, campaignName) {
  const buffs = storage.getProperty(playerName, 'activeBuffs', campaignName);
  return Array.isArray(buffs) ? buffs : [];
}
