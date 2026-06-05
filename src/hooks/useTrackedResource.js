import React from 'react';
import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from './useRuntimeState.js';

function useTrackedResource(storageKey, playerName, maxGetter, deps, campaignName) {
  const [current, setCurrent] = React.useState(() => {
    const storedValue = getRuntimeValue(playerName, storageKey);
    return storedValue != null ? storedValue : maxGetter();
  });

  // Re-sync when any dependency changes (e.g., player level changed)
  React.useEffect(() => {
    const storedValue = getRuntimeValue(playerName, storageKey);
    if (storedValue != null) {
      setCurrent(storedValue);
    } else {
      setCurrent(maxGetter());
    }
  }, [deps, maxGetter, playerName, storageKey, campaignName]);

  // Listen for external updates to this resource from any source:
  // - Long Rest / Short Rest (setRuntimeBatch resets resources to null)
  // - Point spending via DOM custom events (focus-points-updated, sorcery-points-updated)
  React.useEffect(() => {
    const reReadHandler = () => {
      const storedValue = getRuntimeValue(playerName, storageKey);
      if (storedValue != null) {
        setCurrent(storedValue);
      } else {
        setCurrent(maxGetter());
      }
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
  }, [playerName, storageKey, campaignName, maxGetter]);

  const update = async (val) => {
    await setRuntimeValue(playerName, storageKey, val, campaignName);
    setCurrent(val);
  };

  return { current, max: maxGetter(), update };
}

export default useTrackedResource;
