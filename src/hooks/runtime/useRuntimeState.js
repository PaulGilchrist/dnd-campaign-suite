import { useState, useEffect, useRef } from 'react';
import { isCampaignKey } from '../../services/automation/common/campaignKeys.js';

const stores = new Map();
export const listeners = new Map();

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

export function getStore(characterKey) {
    if (!stores.has(characterKey)) {
        stores.set(characterKey, new Map());
    }
    return stores.get(characterKey);
}

export function seedTrackedResources(characterKey, trackedEntries) {
    if (!trackedEntries || typeof trackedEntries !== 'object') return;
    const store = getStore(characterKey);
    const entries = Object.entries(trackedEntries);
    if (entries.length === 0) return;
    let changed = false;
    if (!store.has('pendingExpirations')) {
        store.set('pendingExpirations', []);
        changed = true;
    }
    for (const [key, value] of entries) {
        if (store.get(key) !== value) {
            store.set(key, value);
            changed = true;
        }
    }
    if (changed) {
        notify(characterKey);
    }
}

export function notify(characterKey) {
    const set = listeners.get(characterKey);
    if (set) {
        set.forEach(fn => fn());
    }
}

export function addStorageChangeListener(characterKey, listener) {
    if (!listeners.has(characterKey)) listeners.set(characterKey, new Set());
    const set = listeners.get(characterKey);
    set.add(listener);
    return () => set.delete(listener);
}

export function getRuntimeValue(characterKey, propertyName) {
    if (isCampaignKey(propertyName) && characterKey !== 'campaign') {
        console.error(
            '[getRuntimeValue] Campaign-level key read with wrong characterKey. ' +
            `Key: "${propertyName}", characterKey: "${characterKey}". ` +
            'Should use characterKey = "campaign" for campaign-level data.',
            { characterKey, propertyName, stack: new Error().stack }
        );
    }
    const store = getStore(characterKey);
    const hasKey = store.has(propertyName);
    const value = hasKey ? store.get(propertyName) : null;
    return value;
}

export function setRuntimeValue(characterKey, propertyName, value, campaignName) {
    if (isCampaignKey(propertyName) && characterKey !== 'campaign') {
        console.error(
            '[setRuntimeValue] Campaign-level key written with wrong characterKey. ' +
            `Key: "${propertyName}", characterKey: "${characterKey}". ` +
            'Should use characterKey = "campaign" for campaign-level data.',
            { characterKey, propertyName, value, campaignName, stack: new Error().stack }
        );
    }
    if (campaignName && characterKey === campaignName) {
        console.error(
            '[setRuntimeValue] characterKey === campaignName. A campaign name was used as a creature/character key. ' +
            `characterKey: "${characterKey}", propertyName: "${propertyName}".`,
            { characterKey, propertyName, value, campaignName, stack: new Error().stack }
        );
    }
    const store = getStore(characterKey);
    const existing = store.get(propertyName);
    if (valuesEqual(existing, value)) {
      return;
    }
    store.set(propertyName, value);

   if (!campaignName) {
     console.error('setRuntimeValue called with undefined campaignName', { characterKey, propertyName, value, stack: new Error().stack });
   }

    // Campaign-level keys are stored at the top level of the change data file.
    // POST the individual property directly instead of accumulating into a "campaign" wrapper.
    if (characterKey === 'campaign') {
      const fullUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(propertyName)}`;
      notify(characterKey);
      return fetch(fullUrl, {
        method: 'POST',
        mode: 'cors',
        // Campaign-scoped writes (enforcement/turnState) go through the
        // server validator; authority is localhost-only (GM) when engaged.
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      }).catch((e) => { console.error("[useRuntimeState] Error:", e); });
    }

   const obj = Object.fromEntries(store);

   // When characterKey === propertyName, the server would extract the wrong value
   // from the full store object (it would get value[characterKey] instead of value[propertyName]).
   // Send the value directly in this case.
   const bodyValue = characterKey === propertyName ? { value } : { value: obj };

     fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(characterKey)}`, {
       method: 'POST',
       mode: 'cors',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(bodyValue)
     }).catch((e) => { console.error("[useRuntimeState] Error:", e); });

    notify(characterKey);
}

/**
 * Drain-to-evict companion of setRuntimeValue: DELETEs the key server-side
 * instead of persisting an emptied aggregate bucket as `{}` / `[]` cosmetic
 * dust (backlog 2026-11-03 CJ drained-save-buckets; mirrors the concentration
 * lane, where the last answered `concentrationPrompt-<Target>-<promptId>`
 * key is fully deleted, never written back empty). The wildcard DELETE route
 * (campaigns-changedata.js) removes the key and publishes a null echo, which
 * App.jsx applyStoreUpdate already converts into a local store.remove + notify
 * on every mounted tab (the replace-echo eviction lane, 7cce79493 /
 * 6b1800fa2) — a campaign-key null echo is a REMOVE, never a stored null, so
 * nothing resurrects the key. The local delete + notify mirror immediately so
 * the sender's own consumers see the eviction without waiting for the echo;
 * the has() guard makes double-sweep lanes (createSaveListener's save-result
 * handler + its finally) idempotent — no second DELETE, no honest-404 churn.
 */
export function deleteRuntimeKey(characterKey, propertyName, campaignName) {
    const store = getStore(characterKey);
    if (!store.has(propertyName)) return;
    store.delete(propertyName);
    notify(characterKey);
    if (!campaignName) {
        console.error('deleteRuntimeKey called with undefined campaignName', { characterKey, propertyName, stack: new Error().stack });
        return;
    }
    // Fail loudly (bug-visitor-oa-resolution-strands-marker-double-resolve,
    // owner ruling 2026-11-10): a REFUSED eviction (4xx) previously failed
    // silently — the local mirror evicted while the server kept the shared
    // marker, which then replayed (the OA double-resolve strand). Network
    // errors reach the .catch; gate refusals carry an OK transport, so check
    // res.ok explicitly, console.error, and broadcast for a visible toast
    // (Initiative.jsx listens) so no future split gate can strand a marker
    // silently again.
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(propertyName)}`, {
        method: 'DELETE',
    }).then((res) => {
        if (res.ok) return;
        console.error(`deleteRuntimeKey: server refused eviction of "${propertyName}" (HTTP ${res.status}) — the shared key survives server-side`, { campaignName });
        // Visible feedback only for AUTHORITY refusals: a 404 honestly means
        // the key is already gone (a concurrent tab won the evict) — nothing
        // is stranded, so no toast.
        if (res.status === 403) {
            window.dispatchEvent(new CustomEvent('runtime-evict-failed', {
                detail: { key: propertyName, campaignName, status: res.status },
            }));
        }
    }).catch((e) => { console.error("[useRuntimeState] Error:", e); });
}

export function setRuntimeObject(characterKey, fullObject, campaignName, skipSync = false) {
    if (!fullObject || typeof fullObject !== 'object') return;
    if (campaignName && characterKey === campaignName) {
        console.error(
            '[setRuntimeObject] characterKey === campaignName. A campaign name was used as a creature/character key.',
            { characterKey, keys: Object.keys(fullObject), campaignName, stack: new Error().stack }
        );
    }
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
        if (campaignName && !skipSync) {
            fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(characterKey)}`, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: Object.fromEntries(store) })
            }).catch((e) => { console.error("[useRuntimeState] Error:", e); });
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
    // eslint-disable-next-line server-first/no-local-game-state
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

/**
 * SSE-echo adoption for full-bucket stores (character / combatSummary lanes).
 * The server's wildcard POST route (server/routes/campaigns-changedata.js)
 * stores each write as a REPLACE of the whole bucket, so a `change-<campaign>-<key>`
 * echo carries complete server truth: keys absent from the payload no longer
 * exist server-side and MUST be evicted locally too. A merge-only adoption kept
 * mounted tabs enforcing ghost keys after another client dropped them
 * (bug-changedata-key-removal-stale-on-mounted-tab: a removed selectedAllies
 * list silently gated allegiance checks until reload, and the tab's next
 * full-store POST resurrected the ghost server-side).
 * Memory-only — never POSTs (the server already owns this data), mirroring the
 * skipSync=true guarantee of the setRuntimeObject call it replaces in the
 * echo path.
 */
export function replaceRuntimeObject(characterKey, fullObject) {
    if (Array.isArray(fullObject)) {
        console.error('[replaceRuntimeObject] Bucket echo must be an object, got an array — dropped', { characterKey });
        return;
    }
    if (!fullObject || typeof fullObject !== 'object') return;
    const store = getStore(characterKey);
    let changed = false;
    for (const key of Array.from(store.keys())) {
        if (!(key in fullObject)) {
            store.delete(key);
            changed = true;
        }
    }
    for (const [key, value] of Object.entries(fullObject)) {
        if (!valuesEqual(store.get(key), value)) {
            store.set(key, value);
            changed = true;
        }
    }
    if (changed) {
        notify(characterKey);
    }
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
    if (!campaignName) {
        console.error('setRuntimeBatch called with undefined campaignName', { characterKey, properties, stack: new Error().stack });
    }

    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(characterKey)}`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: obj })
    }).catch((e) => { console.error("[useRuntimeState] Error:", e); });

    notify(characterKey);
}

export function clearRuntimeState(characterKey) {
    stores.delete(characterKey);
}

/**
 * Check if a property exists in the runtime store (as opposed to returning null).
 * This is needed because getRuntimeValue returns null for both "key doesn't exist"
 * and "key exists with null value". Use this to distinguish the two cases.
 */
export function hasRuntimeValue(characterKey, propertyName) {
  const store = getStore(characterKey);
  return store.has(propertyName);
}

export function getAllStoreKeys() {
    return Array.from(stores.keys());
}

/**
 * List property names in a character's runtime store matching a prefix.
 * Use instead of scanning localStorage, which never contains runtime-store keys.
 */
export function getRuntimeKeysByPrefix(characterKey, prefix) {
    const store = getStore(characterKey);
    return Array.from(store.keys()).filter(key => key.startsWith(prefix));
}
