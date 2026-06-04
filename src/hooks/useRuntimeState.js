import { useState, useEffect } from 'react';

const stores = new Map();
const listeners = new Map();

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

export async function seedStoreFromServer(characterKey, campaignName) {
  if (!stores.has(characterKey)) {
    getStore(characterKey);
  }
  if (!campaignName) return;
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(characterKey)}`);
    if (!response.ok) return;
    const data = await response.json();
    if (data.value && typeof data.value === 'object') {
      const store = stores.get(characterKey);
      for (const [k, v] of Object.entries(data.value)) {
        store.set(k, v);
      }
      notify(characterKey);
    }
  } catch { /* fall through — localStorage already loaded */ }
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
  if (existing === value || (typeof existing === 'number' && typeof value === 'string' && existing === Number(value)) || (typeof existing === 'string' && typeof value === 'number' && Number(existing) === value)) return;
  store.set(propertyName, value);

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

export function setRuntimeObject(characterKey, fullObject, campaignName) {
  if (!fullObject || typeof fullObject !== 'object') return;
  const store = getStore(characterKey);
  let changed = false;
  for (const [key, value] of Object.entries(fullObject)) {
    if (store.get(key) !== value) {
      store.set(key, value);
      changed = true;
    }
  }
  if (changed) {
    try { localStorage.setItem(characterKey, JSON.stringify(Object.fromEntries(store))); } catch { /* ignore */ }

    if (campaignName) {
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

export function useRuntimeValue(characterKey, propertyName, campaignName) {
  const [value, setValue] = useState(() => getRuntimeValue(characterKey, propertyName));

  useEffect(() => {
    if (!characterKey || !propertyName) return;
    if (!listeners.has(characterKey)) listeners.set(characterKey, new Set());
    const listener = () => {
      setValue(getRuntimeValue(characterKey, propertyName));
    };
    listeners.get(characterKey).add(listener);
    listener();
    return () => {
      const set = listeners.get(characterKey);
      if (set) set.delete(listener);
    };
  }, [characterKey, propertyName, campaignName]);

  useEffect(() => {
    seedStoreFromServer(characterKey, campaignName);
  }, [characterKey, campaignName]);

  return value;
}

export function setRuntimeBatch(characterKey, properties, campaignName) {
  if (!properties || typeof properties !== 'object') return;
  const store = getStore(characterKey);
  let changed = false;
  for (const [key, value] of Object.entries(properties)) {
    if (store.get(key) !== value) {
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
