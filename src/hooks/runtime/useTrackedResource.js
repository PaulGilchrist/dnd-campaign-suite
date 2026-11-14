import React from 'react';
import { getRuntimeValue, setRuntimeValue, addStorageChangeListener, hasRuntimeValue } from './useRuntimeState.js';

// HP-family keys carry their own truth semantics (temp HP, heal overflow) and
// are adjudicated outside this hook (CharHitPoints reads the store directly),
// so a read-clamp here must never touch them.
const CLAMP_EXEMPT_KEYS = ['currentHitPoints', 'hitPoints'];

// A persisted bucket can outlive a shrink of its derived max (DM edits a
// character's level down, class resync): without this clamp the stored value
// rides above max forever — the badge renders an inverted fraction (95/65) and
// the spend lane bills past the class-derived capacity. Clamping on read keeps
// every consumer (sheet row, pool modal) honest, and the commit lanes'
// `safePool - amount` arithmetic rewrites the bucket to a valid value the
// first time it is spent. Non-numeric consumers (boolean latches like
// 'hasInspiration', null-as-armed latches) ride their stored value untouched.
function clampToMax(storageKey, value, maxGetter) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  if (CLAMP_EXEMPT_KEYS.includes(storageKey)) return value;
  const max = maxGetter();
  if (typeof max !== 'number' || !Number.isFinite(max)) return value;
  return Math.min(value, max);
}

function resolveCurrent(storageKey, playerName, playerStats, maxGetter, defaultValue = null) {
  const hasKey = hasRuntimeValue(playerName, storageKey);
  const storedValue = getRuntimeValue(playerName, storageKey);
  if (hasKey && storedValue != null) return clampToMax(storageKey, storedValue, maxGetter);
  if (hasKey && storedValue === null) return maxGetter();
  if (playerStats?._trackedResources?.[storageKey]) {
    return playerStats._trackedResources[storageKey].current;
  }
  return defaultValue !== null ? defaultValue : maxGetter();
}

function useTrackedResource({ storageKey, playerName, maxGetter, deps, campaignName, playerStats, defaultValue = null }) {
  const [current, setCurrent] = React.useState(() =>
    resolveCurrent(storageKey, playerName, playerStats, maxGetter, defaultValue)
  );

  React.useEffect(() => {
    const resolved = resolveCurrent(storageKey, playerName, playerStats, maxGetter, defaultValue);
    setCurrent(resolved);
  }, [deps, maxGetter, playerName, storageKey, campaignName, playerStats, defaultValue]);

  React.useEffect(() => {
    const reReadHandler = () => {
      const resolved = resolveCurrent(storageKey, playerName, playerStats, maxGetter, defaultValue);
      setCurrent(resolved);
    };

    window.addEventListener('focus-points-updated', reReadHandler);
    window.addEventListener('sorcery-points-updated', reReadHandler);
    window.addEventListener('innate-sorcery-updated', reReadHandler);
    const removeListener = addStorageChangeListener(playerName, reReadHandler);

    return () => {
      window.removeEventListener('focus-points-updated', reReadHandler);
      window.removeEventListener('sorcery-points-updated', reReadHandler);
      window.removeEventListener('innate-sorcery-updated', reReadHandler);
      removeListener();
     };
  }, [playerName, storageKey, campaignName, maxGetter, playerStats, defaultValue]);

  const update = async (val) => {
    await setRuntimeValue(playerName, storageKey, val, campaignName);
    setCurrent(val);
  };

  return { current, max: maxGetter(), update };
}

export default useTrackedResource;
