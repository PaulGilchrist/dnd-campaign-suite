const BASE_URL = '/api/campaigns';

/**
 * Editor overrides PATCH — POSTs { overrides } ONLY, never the transport fields.
 * The server merges and preserves its truth for playing/mood/volume, so saving
 * tracks while the player is stopped cannot flip playing:true and surprise-autoplay
 * other tabs. Play/pause/stop/volume keep writing the full music object through
 * useSyncedState (explicit intent).
 *
 * @param {string} campaignName
 * @param {object} overrides - full desired overrides map ({ [mood]: [{videoId,title}] })
 * @returns {Promise<object|null>} the merged music object stored by the server,
 *   or null on failure (logged, surfaced by the caller as an error toast).
 */
export async function saveMusicOverrides(campaignName, overrides) {
  try {
    const response = await fetch(`${BASE_URL}/${encodeURIComponent(campaignName)}/music`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides })
    });
    if (!response.ok) {
      console.error('[musicService] Failed to save music overrides:', response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    if (!data || typeof data.music !== 'object' || data.music === null) {
      console.error('[musicService] Music save response missing merged music object', data);
      return null;
    }
    return data.music;
  } catch (error) {
    console.error('[musicService] Failed to save music overrides:', error);
    return null;
  }
}
