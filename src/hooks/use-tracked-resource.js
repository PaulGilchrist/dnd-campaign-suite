import React from 'react';
import storage from '../services/storage';

function useTrackedResource(storageKey, playerName, maxGetter, deps) {
  const [current, setCurrent] = React.useState(() => {
    const storedValue = storage.getProperty(playerName, storageKey);
    return storedValue != null ? storedValue : maxGetter();
  });

  React.useEffect(() => {
    const storedValue = storage.getProperty(playerName, storageKey);
    if (storedValue != null) {
      setCurrent(storedValue);
    } else {
      setCurrent(maxGetter());
    }
  }, [deps, maxGetter, playerName, storageKey]);

  const update = (val) => {
    storage.setProperty(playerName, storageKey, val);
    setCurrent(val);
  };

  return { current, max: maxGetter(), update };
}

export default useTrackedResource;
