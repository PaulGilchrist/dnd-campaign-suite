import { useState, useEffect, useCallback } from 'react';
import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from '../runtime/useRuntimeState.js';
import { getClassFeatures } from '../../services/character/classFeatures.js';
import utils from '../../services/ui/utils.js';

export function spendSorceryPoints(characterName, amount, campaignName) {
  const current = Number(getRuntimeValue(characterName, 'sorceryPoints') ?? 0);
  const newValue = Math.max(0, current - amount);
  setRuntimeValue(characterName, 'sorceryPoints', newValue, campaignName);
  window.dispatchEvent(new CustomEvent('sorcery-points-updated'));
  return newValue;
}

export function getCurrentSorceryPoints(characterName, fallback = null) {
  const val = getRuntimeValue(characterName, 'sorceryPoints');
  return val != null ? Number(val) : fallback;
}

export function getMaxSorceryPoints(playerStats) {
  const features = getClassFeatures(playerStats);
  return features?.maxSorceryPoints || 0;
}

/**
 * Save the last damage event for a character.
 * Used by reaction features (e.g., Cutting Words) and metamagic (e.g., Empowered Spell)
 * to retrieve the most recent damage roll for rollback / modification.
 * Stored under runtime key 'lastMetamagicDamage' (legacy name — used for all damage events).
 */
export function saveLastDamageEvent(characterName, event, campaignName) {
  setRuntimeValue(characterName, 'lastMetamagicDamage', event, campaignName);
}

/**
 * Retrieve the last damage event for a character.
 * Used by reaction features (e.g., Cutting Words) and metamagic (e.g., Empowered Spell)
 * to retrieve the most recent damage roll for rollback / modification.
 */
export function getLastDamageEvent(characterName) {
  return getRuntimeValue(characterName, 'lastMetamagicDamage');
}

export function clearLastDamageEvent(characterName, campaignName) {
  setRuntimeValue(characterName, 'lastMetamagicDamage', null, campaignName);
}

export function saveLastAttackRoll(characterName, event, campaignName) {
  setRuntimeValue(characterName, 'lastAttackRoll', event, campaignName);
}

export function getLastAttackRoll(characterName) {
  return getRuntimeValue(characterName, 'lastAttackRoll');
}

export function saveLastAbilityCheck(characterName, event, campaignName) {
  setRuntimeValue(characterName, 'lastAbilityCheck', event, campaignName);
}

export function getLastAbilityCheck(characterName) {
  return getRuntimeValue(characterName, 'lastAbilityCheck');
}

export function saveLastSaveRoll(characterName, event, campaignName) {
  setRuntimeValue(characterName, 'lastSaveRoll', event, campaignName);
}

export function getLastSaveRoll(characterName) {
  return getRuntimeValue(characterName, 'lastSaveRoll');
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
    const customEventHandler = () => {
      const stored = getRuntimeValue(characterName, 'sorceryPoints');
      setCurrentSP(stored != null ? Number(stored) : maxSP);
    };

    const storeChangeHandler = () => {
      const stored = getRuntimeValue(characterName, 'sorceryPoints');
      setCurrentSP(stored != null ? Number(stored) : maxSP);
    };

    window.addEventListener('sorcery-points-updated', customEventHandler);
    const removeListener = addStorageChangeListener(characterName, storeChangeHandler);

    return () => {
      window.removeEventListener('sorcery-points-updated', customEventHandler);
      removeListener();
    };
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
    const remaining = spendSorceryPoints(characterName, amount, campaignName, maxSP);
    setCurrentSP(remaining);
    window.dispatchEvent(new CustomEvent('sorcery-points-updated'));
    return remaining;
  }, [characterName, campaignName, maxSP]);

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
