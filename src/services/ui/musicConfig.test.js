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
 * fix#352(c): the catalogue is FROZEN DEEP (rows, tracks arrays, mood
 * objects, MOODS) and getTracksForMood hands back a defensive COPY on the
 * catalogue arm (caller-owned overrides keep pass-through identity, pinned
 * below). Consumer census (MusicPlayer.jsx :45-51/:70-75/:96-97/:104-105/
 * :127-128) is read-only .length/.map — zero persistence-via-mutation abuse,
 * so freeze + copy retire the pollution hole with zero behavior change.
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

  it('FLIPPED quirk pin: fallback returns a defensive COPY — catalogue identity content, never the live array', () => {
    const town = getMood('town').tracks;
    for (const overrides of [null, undefined, {}, { town: [] }]) {
      // fix#352(c): was toBe(town) (live-ref handout); now equal-by-content
      // but NOT the catalogue array itself.
      const result = getTracksForMood('town', overrides);
      expect(result).not.toBe(town);
      expect(result).toEqual(town);
    }
    // Array.isArray guard: truthy non-array overrides must NOT be returned
    // (dropping the guard returns the raw value — MusicPlayer would then
    // crash on .map in selectMood).
    for (const junk of ['q9yaKpYS9qc', { 0: 'x' }, 0, false, '']) {
      expect(getTracksForMood('town', { town: junk })).toEqual(town);
    }
    // fix#352(c): two calls hand back EQUAL but DISTINCT arrays (copy law —
    // the old toBe identity was the pollution surface itself).
    const a = getTracksForMood('town', {});
    const b = getTracksForMood('town', {});
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    expect(a[0]).toBe(b[0]); // rows are frozen shared refs — copy is shallow BY DESIGN, isolation via Object.freeze
    // unknown mood, no override: fresh empty array (blocks selectMood via
    // its length===0 console.error arm).
    expect(getTracksForMood('nope', null)).toEqual([]);
    expect(getTracksForMood('nope', { town: [] })).toEqual([]);
  });
});

describe('frozen config law (fix#352(c)) — mutation throws, copies isolate', () => {
  it('MOODS, mood rows, tracks arrays, and track rows are all Object.frozen', () => {
    expect(Object.isFrozen(MOODS)).toBe(true);
    for (const mood of MOODS) {
      expect(Object.isFrozen(mood)).toBe(true);
      expect(Object.isFrozen(mood.tracks)).toBe(true);
      for (const track of mood.tracks) {
        expect(Object.isFrozen(track)).toBe(true);
      }
    }
  });

  it('mutating the frozen catalogue throws TypeError (strict ES-module scope) — pollution impossible', () => {
    // ES modules are ALWAYS strict mode: a frozen-target write THROWS, it does
    // not silently fail — the throw itself is the enforcement this stamp owed.
    expect(() => MOODS.push({ key: 'x' })).toThrow(TypeError);
    expect(() => MOODS.pop()).toThrow(TypeError);
    expect(() => MOODS[0] = null).toThrow(TypeError);
    expect(() => getMood('town').label = 'LOL').toThrow(TypeError);
    expect(() => getMood('town').tracks.push({ videoId: 'abuseabuse1' })).toThrow(TypeError);
    expect(() => getMood('town').tracks[0].videoId = 'evilid').toThrow(TypeError);
    expect(MOODS).toHaveLength(5); // untouched after every attempted abuse
  });

  it('copy isolation: pushing/splicing the returned array cannot pollute the catalogue, even across many pushes', () => {
    const tracks = getTracksForMood('town', null);
    tracks.push({ videoId: 'abuseabuse1', title: 'pollution attempt' }); // legal on the COPY
    tracks.splice(0, 1); // removes the copy's first element, not the appended abuse row
    expect(tracks.map(t => t.videoId)).toEqual(['o-b5nMCj5hI', 'abuseabuse1']); // local, whatever
    // The catalogue never saw any of it:
    expect(getMood('town').tracks.map(t => t.videoId)).toEqual(['q9yaKpYS9qc', 'o-b5nMCj5hI']);
    const fresh = getTracksForMood('town', null);
    expect(fresh).not.toBe(tracks);
    expect(fresh.map(t => t.videoId)).toEqual(['q9yaKpYS9qc', 'o-b5nMCj5hI']);
    // Writing a row of the copy is still refused — rows are frozen shared refs:
    expect(() => { fresh[0].title = 'rewritten'; }).toThrow(TypeError);
  });

  it('override arm stays caller-owned pass-through (identity) — the copy law covers config only', () => {
    const override = [{ videoId: 'aaaaaaaaaaa', title: 'Custom' }];
    expect(getTracksForMood('town', { town: override })).toBe(override);
    expect(getTracksForMood('nope', { nope: override })).toBe(override);
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

  it('SECURITY (#1544): trust gate is exact host or leading-dot suffix — lookalikes rejected', () => {
    // Fix-pass: :89 previously used bare endsWith('youtube.com'), which
    // accepted glued-label lookalikes. Exploit captured LIVE pre-fix:
    // notyoutube.com / totallynotyoutube.com / evilyoutube.com all
    // returned their ?v= / embed ids through the gate. Now the gate is
    // host === 'youtube.com' || host.endsWith('.youtube.com') (:89-90)
    // plus the exact 'youtu.be' arm (:85).
    // Trusted root and real YouTube subdomains still parse:
    expect(extractVideoId(`https://youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    // Case-insensitive by spec (URL.hostname is lowercased), not by code:
    expect(extractVideoId(`HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`)).toBe(ID);
    // Reject-arm table (#1348 mutually-distinguishable shapes): glued
    // labels, foreign TLD, subdomain-of-attacker, glued youtu.be prefix.
    for (const evil of [
      'notyoutube.com',
      'totallynotyoutube.com',
      'evilyoutube.com',
      'fakeyoutube.com',
      'youtube.com.attacker.net',
      'youtube.com.evil.io',
      'fakeyoutube.co'
    ]) {
      expect(extractVideoId(`https://${evil}/watch?v=${ID}`)).toBeNull();
      expect(extractVideoId(`https://${evil}/embed/${ID}`)).toBeNull();
    }
    expect(extractVideoId(`https://notyoutu.be/${ID}`)).toBeNull();
    expect(extractVideoId(`https://youtu.be.evil.io/${ID}`)).toBeNull();
    // Reject degrades safely: null is the caller's drop signal —
    // MusicPlayer.parseTrackList .filter(Boolean)s it (no track queued).
  });
});
