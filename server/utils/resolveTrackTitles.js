// @maintained-by-ai: 2026-11-25
/**
 * Resolve human-readable track titles for music overrides at save time
 * (backlog 2026-10-24: editor parseTrackList stamps title = raw video ID;
 * Item 3 2026-11-25 canonicalized rows to { kind, src, title }).
 *
 * Runs server-side in the POST /api/campaigns/:campaign/music save path —
 * the browser cannot CORS-hit YouTube oEmbed. Each lookup is a bounded
 * network fetch (AbortSignal, 5s/video — the permitted timer category, same
 * idiom as server/services/ai/providers/localProvider.js) and all lookups
 * for one save resolve in parallel.
 *
 * Only kind:'youtube' rows are resolved — a kind:'local' row's title is the
 * uploaded filename, stamped by the upload route, and passes through
 * untouched (an offline table may not reach oEmbed at all).
 *
 * Failure is graceful and NEVER rejects: a timeout / non-200 / title-less
 * oEmbed response logs console.error and keeps the raw video ID as the
 * track title, so the save itself always completes.
 */

const OEMBED_BASE = 'https://www.youtube.com/oembed';
const FETCH_TIMEOUT_MS = 5000; // bounded per-video network fetch timeout

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

// The lane only ever enriches canonical YouTube rows; local rows are
// already titled by their filename and any other shape passes through.
function isYoutubeRow(track) {
    return !!track && track.kind === 'youtube' && typeof track.src === 'string' && track.src !== '';
}

function hasRealTitle(track) {
    return typeof track.title === 'string' && track.title.trim() !== '' && track.title !== track.src;
}

/**
 * Real title for one YouTube video via oEmbed. Throws on timeout,
 * non-200, or missing/empty title — callers own the fallback.
 */
export async function fetchVideoTitle(videoId) {
    const url = `${OEMBED_BASE}?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`oEmbed HTTP ${res.status} for video ${videoId}`);
    const data = await res.json();
    const title = typeof data?.title === 'string' ? data.title.trim() : '';
    if (!title) throw new Error(`oEmbed returned no title for video ${videoId}`);
    return title;
}

// videoId -> already-resolved title across every stored mood (same video
// keeps one readable name everywhere). Titles equal to the raw ID are
// unresolved and do not seed the index.
function indexStoredTitles(storedOverrides) {
    const known = new Map();
    if (!isPlainObject(storedOverrides)) return known;
    for (const tracks of Object.values(storedOverrides)) {
        if (!Array.isArray(tracks)) continue;
        for (const track of tracks) {
            if (isYoutubeRow(track) && hasRealTitle(track)) {
                known.set(track.src, track.title);
            }
        }
    }
    return known;
}

// Apply fn to every track row of an overrides map, passing through
// anything that isn't a well-formed mood -> tracks array untouched.
function mapOverrideTracks(overrides, fn) {
    const out = {};
    for (const [mood, tracks] of Object.entries(overrides)) {
        out[mood] = Array.isArray(tracks) ? tracks.map(fn) : tracks;
    }
    return out;
}

/**
 * Fetch titles for a set of unique ids in parallel. Per-id failures log and
 * fall back to the raw id (failed ids stay absent from the returned Map,
 * which keeps the track's existing id-as-title); never rejects.
 */
async function fetchTitles(videoIds) {
    const fetched = new Map();
    await Promise.all([...videoIds].map(async (videoId) => {
        try {
            fetched.set(videoId, await fetchVideoTitle(videoId));
        } catch (error) {
            console.error(`[resolveTrackTitles] oEmbed lookup failed for ${videoId}; keeping raw video id as title:`, error?.message || error);
        }
    }));
    return fetched;
}

/**
 * Return a NEW overrides map ({ [mood]: [{kind,src,title}] }) with every
 * raw-ID title on a kind:'youtube' row replaced by the real YouTube title
 * where resolvable; kind:'local' rows pass through untouched.
 *
 * Stampede guard: a videoId whose STORED overrides already carry a resolved
 * title is reused without re-fetching (re-saving the same mood must not
 * stampede YouTube); ids duplicated within one save are fetched once.
 *
 * @param {object} overrides - incoming editor overrides (titles may be raw IDs)
 * @param {object} [storedOverrides] - currently stored overrides, for skip-reuse
 * @returns {Promise<object>} new overrides map; raw ids kept as fallback titles
 */
export async function resolveOverrideTitles(overrides, storedOverrides = {}) {
    if (!isPlainObject(overrides)) return overrides;
    const known = indexStoredTitles(storedOverrides);
    const need = new Set();

    const resolveTrack = (track) => {
        if (!isYoutubeRow(track)) return track;
        if (hasRealTitle(track)) return track;
        if (known.has(track.src)) return { ...track, title: known.get(track.src) };
        need.add(track.src);
        return { ...track };
    };

    const staged = mapOverrideTracks(overrides, resolveTrack);
    const fetched = await fetchTitles(need);
    return mapOverrideTracks(staged, (track) => (
        isYoutubeRow(track) && fetched.has(track.src)
            ? { ...track, title: fetched.get(track.src) }
            : track
    ));
}
