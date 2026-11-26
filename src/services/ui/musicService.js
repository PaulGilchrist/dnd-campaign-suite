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
 * @param {object} overrides - full desired overrides map ({ [mood]: [{kind,src,title}] })
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

/**
 * Offline-ambience lane (backlog Item 3, 2026-11-25): locally-hosted audio
 * files ride the campaign's own uploads — GM-only server route
 * (server/routes/campaign-audio.js mirrors the token-art upload doctrine),
 * bytes live under public/campaigns/<campaign>/audio/ and come back through
 * the plain express.static lane. Client-side pre-checks mirror the server
 * guards so an obvious mismatch never pays the base64 read; the server stays
 * the enforcement point (rejections name the offender verbatim).
 */
export const LOCAL_AUDIO_EXTENSIONS = Object.freeze(['.mp3', '.ogg', '.oga', '.m4a', '.wav']);
// The route answers 413 above the 5 MB JSON body cap; base64 inflates bytes
// ~4/3, so files past ~3.5 MB cannot fit the transport — say so up front.
export const MAX_LOCAL_AUDIO_BYTES = 3.5 * 1024 * 1024;

export function localAudioFileError(file) {
  const name = typeof file?.name === 'string' ? file.name : '';
  const ext = (name.match(/\.[^.]+$/) || ['.'])[0].toLowerCase();
  if (!LOCAL_AUDIO_EXTENSIONS.includes(ext)) {
    return `"${name}" is not a supported audio file — upload mp3, ogg, oga, m4a or wav audio`;
  }
  if (file.size > MAX_LOCAL_AUDIO_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `"${name}" is ${sizeMb} MB — audio uploads must stay under 3.5 MB so they fit the 5 MB request limit`;
  }
  return null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload one audio file into the campaign's audio/ folder.
 * @returns {Promise<{ row?: {kind:'local', src, title}, error?: string }>}
 *   a canonical local track row on success, or the server's/client's named
 *   refusal.
 */
export async function uploadCampaignAudio(campaignName, file) {
  const preError = localAudioFileError(file);
  if (preError) return { error: preError };
  try {
    const audio = await readFileAsDataUrl(file);
    const response = await fetch(`${BASE_URL}/${encodeURIComponent(campaignName)}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio, fileName: file.name })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: data?.error || `Audio upload failed (HTTP ${response.status})` };
    }
    if (!data || typeof data.src !== 'string') {
      return { error: 'Audio upload response was missing the stored file path' };
    }
    return { row: { kind: 'local', src: data.src, title: data.title } };
  } catch (error) {
    console.error('[musicService] Audio upload failed:', error);
    return { error: `Audio upload failed: ${error?.message || error}` };
  }
}

/**
 * Unlink a campaign audio upload (GM-only route). Used to sweep uploads that
 * were added to an editor draft but never saved (discarded close) — files a
 * SAVE removes are pruned server-side by the POST /music supersede diff.
 */
export async function deleteCampaignAudio(campaignName, src) {
  const file = src.split('/').pop();
  try {
    const response = await fetch(
      `${BASE_URL}/${encodeURIComponent(campaignName)}/audio/${encodeURIComponent(file)}`,
      { method: 'DELETE' }
    );
    // 404 is fine — the file was already gone (e.g. the save-prune raced us).
    if (!response.ok && response.status !== 404) {
      console.error('[musicService] Failed to delete campaign audio:', src, response.status, response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[musicService] Failed to delete campaign audio:', src, error);
    return false;
  }
}
