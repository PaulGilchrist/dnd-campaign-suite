import { useState, useEffect, useCallback, useRef } from 'react';
import { getStore, setRuntimeValue, listeners } from './useRuntimeState.js';

/**
 * Server-first state hook.
 * Replaces useState for any state that should be visible to all clients.
 *
 * Reads from the runtime store on mount, writes via setRuntimeValue (which POSTs to server
 * and broadcasts via SSE to all connected clients).
 *
 * @param {string} characterKey - The runtime store key (usually character name or campaign name)
 * @param {string} propertyName - The property name within the store
 * @param {*} defaultValue - Only used on first mount when no value exists in the store.
 *   A stored `null` value is NOT replaced by defaultValue.
 * @returns {[*, function]} - [value, setValue] tuple identical to useState
 *
 * @example
 * const [pendingDamage, setPendingDamage] = useSyncedState(campaignName, 'pipeline-pause', null);
 * const [healingPool, setHealingPool] = useSyncedState(characterName, 'healingPool', 0);
 */
export function useSyncedState(characterKey, propertyName, defaultValue) {
  const store = getStore(characterKey);
  const hasKey = store.has(propertyName);
  const initialValue = hasKey ? store.get(propertyName) : defaultValue;

  const [value, setValue] = useState(initialValue);
  // eslint-disable-next-line server-first/no-local-game-state
  const currentValueRef = useRef(undefined);

  useEffect(() => {
    if (!characterKey || !propertyName) return;
    const checkForUpdates = () => {
      const newVal = store.has(propertyName) ? store.get(propertyName) : defaultValue;
      if (newVal === currentValueRef.current) return;
      currentValueRef.current = newVal;
      setValue(newVal);
    };

    // Register listener on the store's listener set
    if (!listeners.has(characterKey)) listeners.set(characterKey, new Set());
    const listener = checkForUpdates;
    listeners.get(characterKey).add(listener);
    listener();

    return () => {
      const set = listeners.get(characterKey);
      if (set) set.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterKey, propertyName, store]);

  const setValueSynced = useCallback(
    (newValue) => {
      setRuntimeValue(characterKey, propertyName, newValue, null);
      const store = getStore(characterKey);
      store.set(propertyName, newValue);
      if (newValue === currentValueRef.current) return;
      currentValueRef.current = newValue;
      setValue(newValue);
    },
    [characterKey, propertyName],
  );

  return [value, setValueSynced];
}
