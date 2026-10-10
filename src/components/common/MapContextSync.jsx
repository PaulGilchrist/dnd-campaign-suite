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
 */
function MapContextSync({ campaignName, activeMapName }) {
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
      setRuntimeObject('__map__', { activeMapName: mapKey }, campaignName);
      stamp('__map__', { activeMapName: mapKey });
    }
  }, [campaignName, activeMapName]);
  return null;
}

export default MapContextSync;
