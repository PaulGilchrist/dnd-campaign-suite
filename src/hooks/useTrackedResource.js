import React from 'react';
import storage from '../services/storage.js';

function useTrackedResource(storageKey, playerName, maxGetter, deps, campaignName) {
  const [current, setCurrent] = React.useState(() => {
    const storedValue = storage.getProperty(playerName, storageKey, campaignName);
    return storedValue != null ? storedValue : maxGetter();
  });

  React.useEffect(() => {
    const storedValue = storage.getProperty(playerName, storageKey, campaignName);
    if (storedValue != null) {
      setCurrent(storedValue);
    } else {
      setCurrent(maxGetter());
    }
  }, [deps, maxGetter, playerName, storageKey]);

  const update = (val) => {
    storage.setProperty(playerName, storageKey, val, campaignName);
    setCurrent(val);
  };

  return { current, max: maxGetter(), update };
}

export default useTrackedResource;
