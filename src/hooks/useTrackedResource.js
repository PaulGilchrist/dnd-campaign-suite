import React from 'react';
import { getRuntimeValue, setRuntimeValue } from './useRuntimeState.js';

function useTrackedResource(storageKey, playerName, maxGetter, deps, campaignName) {
  const [current, setCurrent] = React.useState(() => {
    const storedValue = getRuntimeValue(playerName, storageKey);
    return storedValue != null ? storedValue : maxGetter();
   });

  React.useEffect(() => {
    const storedValue = getRuntimeValue(playerName, storageKey);
    if (storedValue != null) {
      setCurrent(storedValue);
     } else {
      setCurrent(maxGetter());
     }
   }, [deps, maxGetter, playerName, storageKey, campaignName]);

  // Listen for external updates to this resource (e.g., monk ki/focus point spend from CharActions)
  React.useEffect(() => {
    const handler = () => {
      const storedValue = getRuntimeValue(playerName, storageKey);
      if (storedValue != null) {
        setCurrent(storedValue);
       } else {
        setCurrent(maxGetter());
       }
     };
    window.addEventListener('focus-points-updated', handler);
    return () => window.removeEventListener('focus-points-updated', handler);
   }, [playerName, storageKey, campaignName]);

  const update = async (val) => {
    await setRuntimeValue(playerName, storageKey, val, campaignName);
    setCurrent(val);
   };

  return { current, max: maxGetter(), update };
}

export default useTrackedResource;
