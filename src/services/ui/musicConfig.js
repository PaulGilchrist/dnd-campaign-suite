/**
 * GM background music — mood catalogue.
 *
 * Each mood maps to one or more YouTube videos (verified public & embeddable
 * at time of writing). The GM can replace any track by pasting a YouTube
 * URL in the sidebar music editor; overrides persist per-campaign in the
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

export function getMood(moodKey) {
  return MOODS.find(m => m.key === moodKey) || null;
}

/**
 * Tracks for a mood — GM overrides (keyed by mood) take precedence over the
 * starter catalogue.
 */
export function getTracksForMood(moodKey, overrides) {
  const override = overrides && overrides[moodKey];
  if (Array.isArray(override) && override.length > 0) return override;
  const mood = getMood(moodKey);
  return mood ? mood.tracks : [];
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
    if (url.hostname.endsWith('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const embed = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed) return embed[1];
    }
  } catch { /* not a URL */ }
  return null;
}
