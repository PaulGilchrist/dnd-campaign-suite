const BASE_URL = '/api/campaigns';

/**
 * Shared intent-split PATCH poster: sends ONLY the keys in `patch` (never
 * transport fields), so the server merges and preserves its truth for
 * playing/mood/volume. Play/pause/stop/volume keep writing the full music
 * object through useSyncedState (explicit intent).
 *
 * @returns {Promise<object|null>} the merged music object stored by the
 *   server, or null on failure (logged, surfaced by the caller as an error
 *   toast).
 */
async function postMusicPatch(campaignName, patch, what) {
  try {
    const response = await fetch(`${BASE_URL}/${encodeURIComponent(campaignName)}/music`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!response.ok) {
      console.error(`[musicService] Failed to save ${what}:`, response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    if (!data || typeof data.music !== 'object' || data.music === null) {
      console.error(`[musicService] Music save response missing merged music object`, data);
      return null;
    }
    return data.music;
  } catch (error) {
    console.error(`[musicService] Failed to save ${what}:`, error);
    return null;
  }
}

/**
 * Editor overrides PATCH — POSTs { overrides } ONLY, never the transport fields.
 * The server merges and preserves its truth for playing/mood/volume, so saving
 * tracks while the player is stopped cannot flip playing:true and surprise-autoplay
 * other tabs.
 *
 * @param {string} campaignName
 * @param {object} overrides - full desired overrides map ({ [mood]: [{videoId,title}] })
 * @returns {Promise<object|null>} the merged music object stored by the server,
 *   or null on failure (logged, surfaced by the caller as an error toast).
 */
export async function saveMusicOverrides(campaignName, overrides) {
  return postMusicPatch(campaignName, { overrides }, 'music overrides');
}

/**
 * Category create/delete PATCH — POSTs { customCategories } (the full desired
 * map: create = entry added, delete = entry absent) and, when deleting, the
 * pruned { overrides } map in the SAME request so the category and its
 * tracks go atomically. Transport fields are never sent (same intent-split
 * doctrine as saveMusicOverrides).
 *
 * @param {string} campaignName
 * @param {object} customCategories - full desired map ({ [key]: {label,icon} })
 * @param {object} [overrides] - full desired overrides map (omit when unchanged)
 * @returns {Promise<object|null>} merged music object or null on failure.
 */
export async function saveMusicCategories(campaignName, customCategories, overrides) {
  const patch = { customCategories };
  if (overrides !== undefined) patch.overrides = overrides;
  return postMusicPatch(campaignName, patch, 'music categories');
}
