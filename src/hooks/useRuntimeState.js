import { useState, useEffect, useRef } from 'react';

const stores = new Map();
const listeners = new Map();

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => valuesEqual(a[k], b[k]));
  }
  return false;
}

function getStore(characterKey) {
  if (!stores.has(characterKey)) {
    try {
      const stored = localStorage.getItem(characterKey);
      stores.set(characterKey, stored ? new Map(Object.entries(JSON.parse(stored))) : new Map());
    } catch {
      stores.set(characterKey, new Map());
    }
  }
  return stores.get(characterKey);
}

export function seedTrackedResources(characterKey, trackedEntries) {
  if (!trackedEntries || typeof trackedEntries !== 'object') return;
  const store = getStore(characterKey);
  let changed = false;
  for (const [key, value] of Object.entries(trackedEntries)) {
    if (store.get(key) !== value) {
      store.set(key, value);
      changed = true;
    }
  }
  if (changed) {
    try { localStorage.setItem(characterKey, JSON.stringify(Object.fromEntries(store))); } catch { /* ignore */ }
    notify(characterKey);
  }
}

function notify(characterKey) {
  const set = listeners.get(characterKey);
  if (set) set.forEach(fn => fn());
}

export function addStorageChangeListener(characterKey, listener) {
    if (!listeners.has(characterKey)) listeners.set(characterKey, new Set());
    const set = listeners.get(characterKey);
    set.add(listener);
    return () => set.delete(listener);
}

export function getRuntimeValue(characterKey, propertyName) {
  const store = getStore(characterKey);
  return store.has(propertyName) ? store.get(propertyName) : null;
}

export function setRuntimeValue(characterKey, propertyName, value, campaignName) {
  const store = getStore(characterKey);
  const existing = store.get(propertyName);
  if (valuesEqual(existing, value)) {
    return;
  }
  store.set(propertyName, value);
  console.log(`[SSE] setRuntimeValue ${characterKey}.${propertyName}:`, existing, '->', value);

  const obj = Object.fromEntries(store);
  try { localStorage.setItem(characterKey, JSON.stringify(obj)); } catch { /* ignore */ }

  if (!campaignName) {
    console.error('setRuntimeValue called with undefined campaignName', { characterKey, propertyName, value, stack: new Error().stack });
  }

  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(characterKey)}`, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: obj })
  }).catch(() => {});

  notify(characterKey);
}

export function setRuntimeObject(characterKey, fullObject, campaignName, skipSync = false) {
  if (!fullObject || typeof fullObject !== 'object') return;
  const store = getStore(characterKey);
  let changed = false;
  const changedKeys = [];
  for (const [key, value] of Object.entries(fullObject)) {
    if (!valuesEqual(store.get(key), value)) {
      store.set(key, value);
      changed = true;
      changedKeys.push(key);
    }
  }
  if (changed) {
    console.log(`[SSE] setRuntimeObject ${characterKey}: keys [${changedKeys.join(', ')}] changed`);
    try { localStorage.setItem(characterKey, JSON.stringify(Object.fromEntries(store))); } catch { /* ignore */ }

    if (campaignName && !skipSync) {
      fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(characterKey)}`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: Object.fromEntries(store) })
      }).catch(() => {});
    }

    notify(characterKey);
  }
}

/**
 * WARNING: SSE re-render loop risk
 * The listener below is invoked whenever any property in the same runtime store
 * changes.  If we call `setValue` for every notification we trigger unnecessary
 * re-renders which can cascade into infinite loops when effects also fire.
 * Use a ref-based equality guard to only re-render when this specific property changed.
 */
export function useRuntimeValue(characterKey, propertyName, campaignName) {
  const [value, setValue] = useState(() => getRuntimeValue(characterKey, propertyName));
  const currentValueRef = useRef(undefined);

  useEffect(() => {
    if (!characterKey || !propertyName) return;
    if (!listeners.has(characterKey)) listeners.set(characterKey, new Set());
    const listener = () => {
      const newVal = getRuntimeValue(characterKey, propertyName);
      if (valuesEqual(currentValueRef.current, newVal)) return;
      currentValueRef.current = newVal;
      setValue(newVal);
     };
    listeners.get(characterKey).add(listener);
    listener();
    return () => {
      const set = listeners.get(characterKey);
      if (set) set.delete(listener);
     };
   }, [characterKey, propertyName, campaignName]);

  return value;
}

export function setRuntimeBatch(characterKey, properties, campaignName) {
  if (!properties || typeof properties !== 'object') return;
  const store = getStore(characterKey);
  let changed = false;
  for (const [key, value] of Object.entries(properties)) {
    if (!valuesEqual(store.get(key), value)) {
      store.set(key, value);
      changed = true;
    }
  }
  if (!changed) return;

  const obj = Object.fromEntries(store);
  try { localStorage.setItem(characterKey, JSON.stringify(obj)); } catch { /* ignore */ }

  if (!campaignName) {
    console.error('setRuntimeBatch called with undefined campaignName', { characterKey, properties, stack: new Error().stack });
  }

  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(characterKey)}`, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: obj })
  }).catch(() => {});

  notify(characterKey);
}

export function clearRuntimeState(characterKey) {
  stores.delete(characterKey);
}
