import { useEffect } from 'react';
import { setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

/**
 * Server-first seam: mirrors the campaign name and active map name into the
 * runtime store ('__campaign__' / '__map__') so rangeCheck.js — and every
 * "within X ft" gate that routes through it — can enforce real grid distances.
 *
 * Only non-null map names are stamped: a freshly-mounted tab has local
 * activeMapName = null until the server's active-map fetch resolves, and
 * force-stamping null there clobbered the server-authoritative '__map__'
 * (the activate route owns that key server-side).
 *
 * The '__map__' POST is GM (localhost) only. Read-only (network) clients mirror
 * the active map into their LOCAL store (their grid distances still work) but
 * never POST it — the server already owns '__map__' via the activate route and
 * every client receives it through SSE. A player tab force-posting '__map__' is
 * a read-only client authoring server state (bug-player-clients-clobber-fog-reset)
 * and now also 400'd server-side.
 *
 * Single server writer per key (improvement-map-open-double-writes): the local
 * mirror always runs with skipSync=true, so the unconditional force-stamp below
 * is the ONLY lane that POSTs. Previously the GM branch also let setRuntimeObject
 * POST the same bucket, emitting a same-tick IDENTICAL pair (guarded store POST +
 * force-stamp) on every map open — pure network/save chatter. The force-stamp
 * lane is the one that must survive (its guard-free POST re-seeds the server
 * after an admin change-data wipe), so it absorbs the deduped writes.
 */
function MapContextSync({ campaignName, activeMapName, isLocalhost = true }) {
  useEffect(() => {
    if (!campaignName) return;
    const mapKey = activeMapName ? activeMapName.replace(/\.json$/, '') : null;
    // skipSync=true: local mirror + notify only; stamp() owns the server write.
    setRuntimeObject('__campaign__', { campaignName }, campaignName, true);
    // Force-stamp the server: setRuntimeObject's equality guard would skip
    // re-posting after an admin change-data wipe, leaving other clients blind.
    const stamp = (key, value) => fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(err => console.error(`[MapContextSync] Failed to stamp ${key}:`, err));
    stamp('__campaign__', { campaignName });
    if (mapKey) {
      setRuntimeObject('__map__', { activeMapName: mapKey }, campaignName, true);
      // Read-only clients mirror locally only (zero server writes).
      if (isLocalhost) {
        stamp('__map__', { activeMapName: mapKey });
      }
    }
  }, [campaignName, activeMapName, isLocalhost]);
  return null;
}

export default MapContextSync;
