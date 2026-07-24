import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export function getActiveBuffs(playerName, campaignName) {
  const buffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
  return Array.isArray(buffs) ? buffs : [];
}

export function isInnateSorceryActive(playerName, campaignName) {
  const buffs = getActiveBuffs(playerName, campaignName);
  return buffs.some(b => b.name === 'Innate Sorcery');
}

export function getInnateSorceryBonus(playerName, campaignName) {
  const active = isInnateSorceryActive(playerName, campaignName);
  return {
      saveDcBonus: active ? 1 : 0,
      spellAdvantage: active
    };
}

export function setInnateSorceryActive(playerName, isActive, campaignName) {
  const buffs = getActiveBuffs(playerName, campaignName);
  let newBuffs;
  if (isActive) {
      const exists = buffs.some(b => b.name === 'Innate Sorcery');
      if (!exists) {
          newBuffs = [...buffs, { name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' }];
        } else {
          newBuffs = buffs;
        }
    } else {
      newBuffs = buffs.filter(b => b.name !== 'Innate Sorcery');
      }
  setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
}
