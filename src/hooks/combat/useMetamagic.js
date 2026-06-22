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
  }).catch((e) => { console.error("[useMetamagic] Error:", e); throw e; });
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

  return {
    currentSP,
    maxSP,
    spendSorceryPoints: spend,
    logMetamagic: logUse,
  };
}
