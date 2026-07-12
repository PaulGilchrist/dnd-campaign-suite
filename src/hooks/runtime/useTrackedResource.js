import React from 'react';
import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from './useRuntimeState.js';

function resolveCurrent(storageKey, playerName, playerStats, maxGetter) {
  const storedValue = getRuntimeValue(playerName, storageKey);
  if (storedValue != null) return storedValue;
  if (playerStats?._trackedResources?.[storageKey]) {
    return playerStats._trackedResources[storageKey].current;
  }
  return maxGetter();
}

function useTrackedResource(storageKey, playerName, maxGetter, deps, campaignName, playerStats) {
  const [current, setCurrent] = React.useState(() =>
    resolveCurrent(storageKey, playerName, playerStats, maxGetter)
  );

  React.useEffect(() => {
    const resolved = resolveCurrent(storageKey, playerName, playerStats, maxGetter);
    setCurrent(resolved);
  }, [deps, maxGetter, playerName, storageKey, campaignName, playerStats]);

  React.useEffect(() => {
    const reReadHandler = () => {
      const resolved = resolveCurrent(storageKey, playerName, playerStats, maxGetter);
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
  }, [playerName, storageKey, campaignName, maxGetter, playerStats]);

  const update = async (val) => {
    await setRuntimeValue(playerName, storageKey, val, campaignName);
    setCurrent(val);
  };

  return { current, max: maxGetter(), update };
}

export default useTrackedResource;
