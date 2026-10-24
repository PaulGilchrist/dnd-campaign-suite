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
 * the active map into their LOCAL store with skipSync=true (their grid distances
 * still work) but never POST it — the server already owns '__map__' via the
 * activate route and every client receives it through SSE. A player tab
 * force-posting '__map__' is a read-only client authoring server state
 * (bug-player-clients-clobber-fog-reset) and now also 400'd server-side.
 */
function MapContextSync({ campaignName, activeMapName, isLocalhost = true }) {
  useEffect(() => {
    if (!campaignName) return;
    const mapKey = activeMapName ? activeMapName.replace(/\.json$/, '') : null;
    setRuntimeObject('__campaign__', { campaignName }, campaignName);
    // Force-stamp the server: setRuntimeObject's equality guard would skip
    // re-posting after an admin change-data wipe, leaving other clients blind.
    const stamp = (key, value) => fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(err => console.error(`[MapContextSync] Failed to stamp ${key}:`, err));
    stamp('__campaign__', { campaignName });
    if (mapKey) {
      if (isLocalhost) {
        setRuntimeObject('__map__', { activeMapName: mapKey }, campaignName);
        stamp('__map__', { activeMapName: mapKey });
      } else {
        // Read-only client: local mirror only, zero server writes.
        setRuntimeObject('__map__', { activeMapName: mapKey }, campaignName, true);
      }
    }
  }, [campaignName, activeMapName, isLocalhost]);
  return null;
}

export default MapContextSync;
