/**
 * Shared background music — mood catalogue (ambience duty is delegable to players).
 *
 * Each mood maps to one or more YouTube videos (verified public & embeddable
 * at time of writing). Any DJ (GM or player) can replace a track by pasting a
 * YouTube URL in the Music view editor; overrides persist per-campaign in the
 * runtime store key 'music'.
 */

export const MOODS = [
  {
    key: 'town',
    label: 'Town',
    icon: 'fa-house-chimney',
    tracks: [
      { videoId: 'q9yaKpYS9qc', title: 'Village | D&D/TTRPG Ambience (Bardify)' },
      { videoId: 'o-b5nMCj5hI', title: 'Medieval City Sounds | Market Day (Danny Fortress Fantasy Music)' }
    ]
  },
  {
    key: 'outdoors',
    label: 'Outdoors',
    icon: 'fa-tree',
    tracks: [
      { videoId: '6Em9tLXbhfo', title: 'D&D Ambience - Forest Daytime (Sword Coast Soundscapes)' },
      { videoId: '4Y6n-1XQSfE', title: 'Mysterious Forest | D&D/TTRPG Music (Bardify)' }
    ]
  },
  {
    key: 'combat',
    label: 'Combat',
    icon: 'fa-khanda',
    tracks: [
      { videoId: 't3B802PIuB0', title: 'D&D/RPG Combat Music Mix (Travis Savoie)' },
      { videoId: 'rfC3wkZ43Jg', title: 'Born For This | Epic Orchestral Battle Music (Epic Music Mix)' }
    ]
  },
  {
    key: 'dungeon',
    label: 'Dungeon',
    icon: 'fa-dungeon',
    tracks: [
      { videoId: 'bxoRRobHtGM', title: 'Dark Dungeon Ambience (AMBIENT METHOD)' },
      { videoId: 'W2NAblVD70Q', title: 'Dungeon of the Dark Pyramid (Soundscapes & Ambience)' }
    ]
  },
  {
    key: 'tavern',
    label: 'Tavern',
    icon: 'fa-beer-mug-empty',
    tracks: [
      { videoId: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern (Daydreaming of Persephone)' },
      { videoId: '2P8J7Cx1plA', title: 'Medieval Tavern Ambience (Fantasy Music Studio)' }
    ]
  }
];

export const DEFAULT_VOLUME = 0.6;

// Campaign-specific categories (improve 2026-11-07): DJs (GM or delegated
// player) can add custom moods per campaign. Only the DEFINITION (label +
// icon) lives in the shared 'music' key's `customCategories` map — the
// category's tracks keep living in `overrides[key]`, so the editor save,
// oEmbed title resolution, and playback lanes are reused untouched. An
// empty category = entry in customCategories with no overrides row.
export const DEFAULT_CUSTOM_ICON = 'fa-music';

// Small Font Awesome preset for the create-form icon picker — a curated
// subset beats a free-text icon field (no class-name injection, no missing
// glyphs), and fa-* classes are already loaded globally via main.jsx.
export const CATEGORY_ICONS = Object.freeze([
  'fa-music',
  'fa-skull',
  'fa-fort', // FA7 renamed the castle glyph (fa-castle does not exist in free 7.x)
  'fa-fire',
  'fa-water',
  'fa-moon',
  'fa-dragon',
  'fa-ghost',
  'fa-bell'
]);

// fix#352(c): the shipped starter catalogue is immutable config — frozen deep
// (track rows, tracks arrays, mood rows, then the MOODS array) so a consumer
// mutation throws TypeError in strict ES-module scope instead of polluting the
// catalogue for the whole session (stamp: catalogue entries are byte-law; the
// only sanctioned personalization path is the per-campaign 'music' overrides
// store, which builds NEW arrays via parseTrackList — consumer census:
// MusicPlayer.jsx :45-51/:70-75/:96-97/:104-105/:127-128 are all read-only
// .length/.map on getTracksForMood results; zero push/splice/index-write
// sites repo-wide on returned arrays).
for (const mood of MOODS) {
  for (const track of mood.tracks) Object.freeze(track);
  Object.freeze(mood.tracks);
  Object.freeze(mood);
}
Object.freeze(MOODS);
// DEFAULT_VOLUME is a primitive number — already immutable; no freeze needed.

export function getMood(moodKey) {
  return MOODS.find(m => m.key === moodKey) || null;
}

/**
 * Merged sidebar list: the frozen starter catalogue (marked custom:false)
 * plus the campaign's customCategories entries (marked custom:true).
 * Built-in keys always win — a custom entry attempting to shadow one is
 * skipped with console.error (no silent fallback). Corrupt entries (missing
 * label, non-object) are skipped the same way. Returns a NEW array of NEW
 * rows; the caller may sort/freeze freely.
 */
export function buildMoodList(customCategories) {
  const moods = MOODS.map(({ key, label, icon }) => ({ key, label, icon, custom: false }));
  if (!customCategories || typeof customCategories !== 'object') return moods;
  const taken = new Set(moods.map(m => m.key));
  for (const [key, entry] of Object.entries(customCategories)) {
    if (taken.has(key)) {
      console.error(`[musicConfig] customCategories entry "${key}" shadows a built-in mood — ignored`);
      continue;
    }
    if (!entry || typeof entry !== 'object' || typeof entry.label !== 'string' || entry.label.trim() === '') {
      console.error(`[musicConfig] customCategories entry "${key}" has no label — ignored`);
      continue;
    }
    taken.add(key);
    moods.push({
      key,
      label: entry.label.trim(),
      icon: typeof entry.icon === 'string' && entry.icon.trim() !== '' ? entry.icon.trim() : DEFAULT_CUSTOM_ICON,
      custom: true
    });
  }
  return moods;
}

/**
 * Slug key for a new category: lowercase, non-alphanumerics collapsed to
 * '-', prefixed `custom-` so built-in keys can never collide by construction.
 * Returns null when the label slugs to nothing (pure punctuation/blank).
 * Collisions with existingKeys gain a -2/-3/… suffix.
 */
export function makeCategoryKey(label, existingKeys = []) {
  if (typeof label !== 'string') return null;
  const slug = label.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return null;
  const taken = new Set(existingKeys);
  let key = `custom-${slug}`;
  let suffix = 2;
  while (taken.has(key)) {
    key = `custom-${slug}-${suffix}`;
    suffix += 1;
  }
  return key;
}

/**
 * Tracks for a mood — saved overrides (keyed by mood) take precedence over the
 * starter catalogue.
 */
export function getTracksForMood(moodKey, overrides) {
  const override = overrides && overrides[moodKey];
  // Overrides are CALLER-owned runtime-store data: pass-through identity is
  // pinned (musicConfig.test.js 'override arrays win by identity').
  if (Array.isArray(override) && override.length > 0) return override;
  const mood = getMood(moodKey);
  // fix#352(c): defensive COPY ([...spread] per the file/consumer idiom —
  // MusicPlayer.jsx:114/:124 builds new arrays/spreads for every persist).
  // Track rows are deep-frozen above, so the shallow copy is full isolation:
  // neither the array nor its rows can be mutated through the returned ref.
  return mood ? [...mood.tracks] : [];
}

/**
 * Extract a YouTube video id from a full URL (watch?v=, youtu.be/, embed/)
 * or return the raw 11-char id unchanged. Returns null when unparseable.
 */
export function extractVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    // SECURITY (#1544): exact host or leading-dot suffix — bare
    // endsWith('youtube.com') accepted glued-label lookalikes
    // (notyoutube.com, evilyoutube.com). URL.hostname is lowercased
    // by spec, so no case-folding is needed here.
    const host = url.hostname;
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const embed = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed) return embed[1];
    }
  } catch { /* not a URL */ }
  return null;
}
