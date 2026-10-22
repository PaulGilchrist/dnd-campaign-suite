// @maintained-by-ai
/**
 * musicConfig lane — GM ambient-music mood catalogue (INLINE literal config;
 * no disk JSON: nothing under public/ named music/audio, so the shipped
 * bytes below ARE the law, pinned verbatim).
 *
 * Domain boundary (server-first): this is a UI-presentation/config surface,
 * NOT game state. Per repo mandate, server-first applies to gameplay data
 * only — and this module honors even that: zero timers, zero localStorage,
 * zero fetch (grep-clean); persistence of overrides/volume lives in the
 * CALLER (MusicPlayer.jsx writes runtime-store key 'music' via
 * useSyncedState, which MusicPlayer.test.jsx covers at the UI lane). This
 * file pins only the config contract the player consumes: catalogue bytes,
 * mood lookup, override precedence, YouTube-id extraction (paste editor),
 * and the volume default. No audio-timing constants exist here, so the
 * no-timers guard has nothing to allowlist for this module.
 *
 * Config objects are NOT frozen and getTracksForMood returns the SAME
 * MOODS.tracks reference (shared-config identity, pinned below; mutation
 * by a consumer would leak across clients-in-process — noted, not fixed).
 */
import { describe, it, expect } from 'vitest';
import * as musicConfig from './musicConfig.js';
import { MOODS, DEFAULT_VOLUME, getMood, getTracksForMood, extractVideoId } from './musicConfig.js';

const ID = 'q9yaKpYS9qc'; // real town-track id, also the fixture for URL parsing

describe('musicConfig export surface', () => {
  it('exports exactly the five live symbols, correct arity, volume default 0.6', () => {
    // all five consumed by MusicPlayer.jsx — census: zero dead exports
    expect(Object.keys(musicConfig).sort()).toEqual(
      ['DEFAULT_VOLUME', 'MOODS', 'extractVideoId', 'getMood', 'getTracksForMood']
    );
    expect(getMood.length).toBe(1);
    expect(getTracksForMood.length).toBe(2);
    expect(extractVideoId.length).toBe(1);
    // DEFAULT_VOLUME seeds MusicPlayer's DEFAULT_MUSIC.volume and the range
    // slider's initial position — the player test derives it, so pin it here.
    expect(DEFAULT_VOLUME).toBe(0.6);
  });
});

describe('MOODS catalogue — shipped inline bytes verbatim', () => {
  it('is exactly the five-mood starter catalogue', () => {
    expect(MOODS).toStrictEqual([
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
    ]);
  });

  it('every catalogue id survives the player paste/queue path (extractVideoId round-trip)', () => {
    // MusicPlayer feeds ids through extractVideoId in parseTrackList and
    // queues tracks.map(t => t.videoId) — a catalogue id that failed the
    // 11-char law would silently vanish from playback.
    const ids = [];
    for (const mood of MOODS) {
      ids.push(...mood.tracks.map(t => t.videoId));
      for (const track of mood.tracks) {
        expect(extractVideoId(track.videoId)).toBe(track.videoId);
      }
    }
    expect(new Set(ids).size).toBe(ids.length); // no duplicate videos
  });
});

describe('getMood', () => {
  it('returns the exact catalogue object, null for misses (case-sensitive, falsy-safe)', () => {
    expect(getMood('town')).toBe(MOODS[0]);
    expect(getMood('tavern')).toBe(MOODS[4]);
    expect(getMood('Town')).toBeNull(); // keys are lowercase; no fold
    expect(getMood('nope')).toBeNull();
    expect(getMood('')).toBeNull();
    expect(getMood(null)).toBeNull();
    expect(getMood(undefined)).toBeNull();
    expect(getMood(0)).toBeNull();
  });
});

describe('getTracksForMood — override precedence law', () => {
  it('override arrays win by identity, even for keys outside the catalogue', () => {
    const override = [{ videoId: 'aaaaaaaaaaa', title: 'Custom' }];
    expect(getTracksForMood('town', { town: override })).toBe(override); // not copied
    // quirk pinned: overrides are consulted BEFORE catalogue lookup, so a
    // fabricated mood key with a non-empty array still resolves.
    expect(getTracksForMood('nope', { nope: override })).toBe(override);
  });

  it('falls back to starter reference for absent/empty/non-array overrides; unknown mood gets []', () => {
    const town = getMood('town').tracks;
    for (const overrides of [null, undefined, {}, { town: [] }]) {
      expect(getTracksForMood('town', overrides)).toBe(town);
    }
    // Array.isArray guard: truthy non-array overrides must NOT be returned
    // (dropping the guard returns the raw value — MusicPlayer would then
    // crash on .map in selectMood).
    for (const junk of ['q9yaKpYS9qc', { 0: 'x' }, 0, false, '']) {
      expect(getTracksForMood('town', { town: junk })).toBe(town);
    }
    // shared-config identity + purity: two calls hand back the SAME array.
    expect(getTracksForMood('town', {})).toBe(getTracksForMood('town', {}));
    // unknown mood, no override: fresh empty array (blocks selectMood via
    // its length===0 console.error arm).
    expect(getTracksForMood('nope', null)).toEqual([]);
    expect(getTracksForMood('nope', { town: [] })).toEqual([]);
  });
});

describe('extractVideoId — GM paste-editor parser', () => {
  it('accepts raw ids and every supported YouTube URL shape', () => {
    expect(extractVideoId(ID)).toBe(ID);
    expect(extractVideoId(`  ${ID}  `)).toBe(ID); // trim arm
    expect(extractVideoId('Q9yaKpYS9qc')).toBe('Q9yaKpYS9qc'); // case preserved
    expect(extractVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractVideoId(`https://www.youtube.com/watch?v=${ID}&list=PL123`)).toBe(ID);
    expect(extractVideoId(`https://youtu.be/${ID}?si=abc`)).toBe(ID);
    expect(extractVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(extractVideoId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('rejects non-strings, malformed ids, trailing-path junk, and foreign hosts', () => {
    for (const junk of [null, undefined, '', 0, false, NaN, {}, [], 42]) {
      expect(extractVideoId(junk)).toBeNull();
    }
    expect(extractVideoId('q9yaKpYS9q')).toBeNull(); // 10 chars
    expect(extractVideoId(`${ID}!`)).toBeNull(); // 12 chars / illegal char
    expect(extractVideoId('not a url')).toBeNull(); // unparseable, guarded (no throw)
    expect(extractVideoId('https://example.com/watch?v=q9yaKpYS9qc')).toBeNull();
    expect(extractVideoId('https://youtube.com.example.net/watch?v=q9yaKpYS9qc')).toBeNull();
    expect(extractVideoId('https://youtu.be/')).toBeNull();
    expect(extractVideoId(`https://youtu.be/${ID}/extra`)).toBeNull(); // pathname not exact-match
    expect(extractVideoId(`https://www.youtube.com/watch?v=sh0rt`)).toBeNull();
    expect(extractVideoId('https://www.youtube.com/embed/short')).toBeNull();
  });

  it('quirk pinned: ANY hostname ending in youtube.com is trusted (endsWith, not exact)', () => {
    // 'totallynotyoutube.com'.endsWith('youtube.com') === true, so its
    // ?v= id parses. Paste-editor-only blast radius (GM input, localhost
    // UI), so behavior pinned as-is; source fix would tighten hostname to
    // /^(www\.|m\.|music\.)?youtube\.com$/ — reported, not changed here.
    expect(extractVideoId(`https://totallynotyoutube.com/watch?v=${ID}`)).toBe(ID);
  });
});
