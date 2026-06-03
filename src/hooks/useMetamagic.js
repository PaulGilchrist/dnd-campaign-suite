import { useState, useEffect, useCallback } from 'react';
import { getRuntimeValue, setRuntimeValue } from './useRuntimeState.js';
import { getClassFeatures } from '../services/classFeatures.js';
import utils from '../services/utils.js';

export function spendSorceryPoints(characterName, amount, campaignName) {
  const current = Number(getRuntimeValue(characterName, 'sorceryPoints')) || 0;
  const newValue = Math.max(0, current - amount);
  setRuntimeValue(characterName, 'sorceryPoints', newValue, campaignName);
  window.dispatchEvent(new CustomEvent('sorcery-points-updated'));
  return newValue;
}

export function getCurrentSorceryPoints(characterName, fallback = 0) {
  const val = getRuntimeValue(characterName, 'sorceryPoints');
  return val != null ? Number(val) : fallback;
}

export function getMaxSorceryPoints(playerStats) {
  const features = getClassFeatures(playerStats);
  return features?.maxSorceryPoints || 0;
}

export function saveLastDamageEvent(characterName, event, campaignName) {
  setRuntimeValue(characterName, 'lastMetamagicDamage', event, campaignName);
}

export function getLastDamageEvent(characterName) {
  return getRuntimeValue(characterName, 'lastMetamagicDamage');
}

export function clearLastDamageEvent(characterName, campaignName) {
  setRuntimeValue(characterName, 'lastMetamagicDamage', null, campaignName);
}

export function logMetamagicUse(campaignName, characterName, spellName, options, spCost) {
  const remaining = getCurrentSorceryPoints(characterName);
  const entry = {
    type: 'metamagic_use',
    characterName,
    spellName,
    options: Array.isArray(options) ? options : [options],
    sorceryPointsSpent: spCost,
    remainingSorceryPoints: remaining,
    timestamp: Date.now(),
    id: utils.guid(),
  };
  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

export default function useMetamagic(playerStats, campaignName) {
  const characterName = playerStats?.name || '';
  const maxSP = getMaxSorceryPoints(playerStats);

  const [currentSP, setCurrentSP] = useState(() => {
    const stored = getRuntimeValue(characterName, 'sorceryPoints');
    return stored != null ? Number(stored) : maxSP;
  });

  useEffect(() => {
    const handler = () => {
      const stored = getRuntimeValue(characterName, 'sorceryPoints');
      setCurrentSP(stored != null ? Number(stored) : maxSP);
    };
    window.addEventListener('sorcery-points-updated', handler);
    return () => window.removeEventListener('sorcery-points-updated', handler);
  }, [characterName, maxSP]);

  useEffect(() => {
    const stored = getRuntimeValue(characterName, 'sorceryPoints');
    if (stored != null) {
      setCurrentSP(Number(stored));
    } else {
      setCurrentSP(maxSP);
    }
  }, [characterName, maxSP, playerStats]);

  const spend = useCallback((amount) => {
    const remaining = spendSorceryPoints(characterName, amount, campaignName);
    setCurrentSP(remaining);
    window.dispatchEvent(new CustomEvent('sorcery-points-updated'));
    return remaining;
  }, [characterName, campaignName]);

  const logUse = useCallback((spellName, options, spCost) => {
    logMetamagicUse(campaignName, characterName, spellName, options, spCost);
  }, [campaignName, characterName]);

  const saveDamage = useCallback((event) => {
    saveLastDamageEvent(characterName, event, campaignName);
  }, [characterName, campaignName]);

  const getLastDamage = useCallback(() => {
    return getLastDamageEvent(characterName);
  }, [characterName]);

  const clearDamage = useCallback(() => {
    clearLastDamageEvent(characterName, campaignName);
  }, [characterName, campaignName]);

  return {
    currentSP,
    maxSP,
    spendSorceryPoints: spend,
    logMetamagic: logUse,
    saveLastDamageEvent: saveDamage,
    getLastDamageEvent: getLastDamage,
    clearLastDamageEvent: clearDamage,
  };
}
