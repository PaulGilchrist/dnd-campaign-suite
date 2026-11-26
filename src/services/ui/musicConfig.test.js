// @maintained-by-ai 2026-10-22
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
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as musicConfig from './musicConfig.js';
import { MOODS, DEFAULT_VOLUME, getMood, getTracksForMood, extractVideoId, buildMoodList, makeCategoryKey, CATEGORY_ICONS, DEFAULT_CUSTOM_ICON } from './musicConfig.js';

const ID = 'q9yaKpYS9qc'; // real town-track id, also the fixture for URL parsing

describe('musicConfig export surface', () => {
  it('exports exactly the nine live symbols, correct arity, volume default 0.6', () => {
    // all consumed by MusicPlayer.jsx / tests — census: zero dead exports
    // (2026-11-07: +buildMoodList/+makeCategoryKey/+CATEGORY_ICONS/
    // +DEFAULT_CUSTOM_ICON for campaign-specific categories)
    expect(Object.keys(musicConfig).sort()).toEqual([
      'CATEGORY_ICONS', 'DEFAULT_CUSTOM_ICON', 'DEFAULT_VOLUME', 'MOODS',
      'buildMoodList', 'extractVideoId', 'getMood', 'getTracksForMood', 'makeCategoryKey'
    ]);
    expect(getMood.length).toBe(1);
    expect(getTracksForMood.length).toBe(2);
    expect(extractVideoId.length).toBe(1);
    expect(buildMoodList.length).toBe(1);
    expect(makeCategoryKey.length).toBe(1); // existingKeys default arg → declared arity 1
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
          { kind: 'local', src: '/audio/town-theme.mp3', title: 'Town Theme | Harps & Recorders (Cynic Music, CC0)' },
          { kind: 'local', src: '/audio/fishing-village.mp3', title: 'Fishing Village | Warm Atmosphere (Man of Steel, CC0)' },
          { kind: 'youtube', src: 'q9yaKpYS9qc', title: 'Village | D&D/TTRPG Ambience (Bardify)' },
          { kind: 'youtube', src: 'o-b5nMCj5hI', title: 'Medieval City Sounds | Market Day (Danny Fortress Fantasy Music)' }
        ]
      },
      {
        key: 'outdoors',
        label: 'Outdoors',
        icon: 'fa-tree',
        tracks: [
          { kind: 'local', src: '/audio/birds-wind.mp3', title: 'Birds & Wind | Long Ambient Bed (Spring-Spring, CC0)' },
          { kind: 'local', src: '/audio/forest-ambience.mp3', title: 'Forest Ambience | Seamless Loop (Tiny Worlds, CC0)' },
          { kind: 'youtube', src: '6Em9tLXbhfo', title: 'D&D Ambience - Forest Daytime (Sword Coast Soundscapes)' },
          { kind: 'youtube', src: '4Y6n-1XQSfE', title: 'Mysterious Forest | D&D/TTRPG Music (Bardify)' }
        ]
      },
      {
        key: 'combat',
        label: 'Combat',
        icon: 'fa-khanda',
        tracks: [
          { kind: 'local', src: '/audio/battle-theme.mp3', title: 'Battle Theme | Orchestral Tension (Wolfgang, CC0)' },
          { kind: 'local', src: '/audio/determined-pursuit.mp3', title: 'Determined Pursuit | Loopable Battle Cue (Emma Ma, CC0)' },
          { kind: 'youtube', src: 't3B802PIuB0', title: 'D&D/RPG Combat Music Mix (Travis Savoie)' },
          { kind: 'youtube', src: 'rfC3wkZ43Jg', title: 'Born For This | Epic Orchestral Battle Music (Epic Music Mix)' }
        ]
      },
      {
        key: 'dungeon',
        label: 'Dungeon',
        icon: 'fa-dungeon',
        tracks: [
          { kind: 'local', src: '/audio/dungeon-ambient.mp3', title: 'Dungeon Ambience | Wind & Drips (Jaggedstone, CC0)' },
          { kind: 'local', src: '/audio/forgotten-tomb.mp3', title: 'Forgotten Tomb | Dark Ambience (Kindland, CC0)' },
          { kind: 'youtube', src: 'bxoRRobHtGM', title: 'Dark Dungeon Ambience (AMBIENT METHOD)' },
          { kind: 'youtube', src: 'W2NAblVD70Q', title: 'Dungeon of the Dark Pyramid (Soundscapes & Ambience)' }
        ]
      },
      {
        key: 'tavern',
        label: 'Tavern',
        icon: 'fa-beer-mug-empty',
        tracks: [
          { kind: 'local', src: '/audio/old-tower-inn.mp3', title: 'The Old Tower Inn | Medieval Tavern (Randommind, CC0)' },
          { kind: 'youtube', src: 'vyg5jJrZ42s', title: 'Medieval Fantasy Tavern (Daydreaming of Persephone)' },
          { kind: 'youtube', src: '2P8J7Cx1plA', title: 'Medieval Tavern Ambience (Fantasy Music Studio)' }
        ]
      }
    ]);
  });

  // Item 3b bundled-bed law: every starter mood OPENS with at least one
  // root-absolute /audio/ local bed (an offline table's first-boot autoplay
  // lands on a bundled file), and every bundled src exists on disk next to
  // its CREDITS.md provenance record.
  it('bundled CC0 beds head every mood and exist on disk', () => {
    const BUNDLED_SRC = /^\/audio\/[a-z0-9][a-z0-9-]*\.mp3$/;
    for (const mood of MOODS) {
      expect(mood.tracks[0].kind, mood.key).toBe('local');
      const bundled = mood.tracks.filter(t => t.kind === 'local');
      expect(bundled.length, mood.key).toBeGreaterThan(0);
      for (const track of bundled) {
        expect(track.src, mood.key).toMatch(BUNDLED_SRC);
        expect(
          fs.existsSync(path.join(process.cwd(), 'public', track.src)),
          `bundled bed ${track.src} must be committed under public/`
        ).toBe(true);
      }
    }
    expect(fs.existsSync(path.join(process.cwd(), 'public/audio/CREDITS.md'))).toBe(true);
  });

  it('every catalogue id survives the player paste/queue path (extractVideoId round-trip)', () => {
    // MusicPlayer feeds ids through extractVideoId in parseTrackList and
    // queues tracks.map(t => t.src) — a catalogue id that failed the
    // 11-char law would silently vanish from playback. Local rows skip the
    // parser (they ride the <audio> arm) and must be well-formed /audio/ srcs.
    const ids = [];
    for (const mood of MOODS) {
      ids.push(...mood.tracks.map(t => t.src));
      for (const track of mood.tracks) {
        if (track.kind === 'youtube') {
          expect(extractVideoId(track.src)).toBe(track.src);
        } else {
          expect(track.src).toMatch(/^\/audio\/[a-z0-9][a-z0-9-]*\.mp3$/);
        }
      }
    }
    expect(new Set(ids).size).toBe(ids.length); // no duplicate sources
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
    const override = [{ kind: 'youtube', src: 'aaaaaaaaaaa', title: 'Custom' }];
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
    expect(() => getMood('town').tracks.push({ kind: 'youtube', src: 'abuseabuse1' })).toThrow(TypeError);
    expect(() => getMood('town').tracks[0].videoId = 'evilid').toThrow(TypeError);
    expect(MOODS).toHaveLength(5); // untouched after every attempted abuse
  });

  it('copy isolation: pushing/splicing the returned array cannot pollute the catalogue, even across many pushes', () => {
    const tracks = getTracksForMood('town', null);
    tracks.push({ kind: 'youtube', src: 'abuseabuse1', title: 'pollution attempt' }); // legal on the COPY
    tracks.splice(0, 1); // removes the copy's first element, not the appended abuse row
    expect(tracks.map(t => t.src)).toEqual(['/audio/fishing-village.mp3', 'q9yaKpYS9qc', 'o-b5nMCj5hI', 'abuseabuse1']); // local, whatever
    // The catalogue never saw any of it:
    expect(getMood('town').tracks.map(t => t.src)).toEqual(['/audio/town-theme.mp3', '/audio/fishing-village.mp3', 'q9yaKpYS9qc', 'o-b5nMCj5hI']);
    const fresh = getTracksForMood('town', null);
    expect(fresh).not.toBe(tracks);
    expect(fresh.map(t => t.src)).toEqual(['/audio/town-theme.mp3', '/audio/fishing-village.mp3', 'q9yaKpYS9qc', 'o-b5nMCj5hI']);
    // Writing a row of the copy is still refused — rows are frozen shared refs:
    expect(() => { fresh[0].title = 'rewritten'; }).toThrow(TypeError);
  });

  it('override arm stays caller-owned pass-through (identity) — the copy law covers config only', () => {
    const override = [{ kind: 'youtube', src: 'aaaaaaaaaaa', title: 'Custom' }];
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

/* Campaign-specific categories (improve 2026-11-07) — merged catalogue
 * builder and collision-safe key slugger. */
describe('buildMoodList — merged starter + campaign catalogue', () => {
  afterEach(() => vi.restoreAllMocks());

  it('icon picker preset is frozen and defaults to its first entry', () => {
    expect(Object.isFrozen(CATEGORY_ICONS)).toBe(true);
    expect(CATEGORY_ICONS[0]).toBe(DEFAULT_CUSTOM_ICON);
    expect(CATEGORY_ICONS.every(i => /^fa-[a-z-]+$/.test(i))).toBe(true);
  });

  it('no custom categories: the five built-ins, marked custom:false, NEW array', () => {
    for (const input of [undefined, null, {}, 'junk', 0]) {
      const list = buildMoodList(input);
      expect(list).toHaveLength(5);
      expect(list).not.toBe(MOODS);
      expect(list.map(m => m.key)).toEqual(MOODS.map(m => m.key));
      expect(list.every(m => m.custom === false)).toBe(true);
    }
  });

  it('appends custom entries with label/icon and custom:true', () => {
    const list = buildMoodList({ 'custom-crypt': { label: 'Crypt', icon: 'fa-skull' } });
    expect(list).toHaveLength(6);
    expect(list[5]).toEqual({ key: 'custom-crypt', label: 'Crypt', icon: 'fa-skull', custom: true });
  });

  it('missing/blank icon falls back to DEFAULT_CUSTOM_ICON; label is trimmed', () => {
    const list = buildMoodList({ 'custom-x': { label: '  Underdark  ' } });
    expect(list[5]).toEqual({ key: 'custom-x', label: 'Underdark', icon: DEFAULT_CUSTOM_ICON, custom: true });
  });

  it('built-in keys win — a shadowing custom entry is skipped with console.error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const list = buildMoodList({ town: { label: 'My Town', icon: 'fa-skull' } });
    expect(list).toHaveLength(5);
    expect(list.find(m => m.key === 'town').label).toBe('Town');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('town'));
  });

  it('corrupt entries (non-object, blank label) are skipped with console.error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const list = buildMoodList({
      'custom-a': null,
      'custom-b': { label: '   ' },
      'custom-c': 'nope',
      'custom-ok': { label: 'Keeper' }
    });
    expect(list).toHaveLength(6);
    expect(list[5].key).toBe('custom-ok');
    expect(consoleError).toHaveBeenCalledTimes(3);
  });
});

describe('makeCategoryKey — slug + custom- prefix + collision suffixes', () => {
  it('slugifies the label under a custom- prefix', () => {
    expect(makeCategoryKey('Crypt Keeper')).toBe('custom-crypt-keeper');
    expect(makeCategoryKey('  Boss Fight!! ')).toBe('custom-boss-fight');
    expect(makeCategoryKey('The Under-dar_k')).toBe('custom-the-under-dar-k');
    expect(makeCategoryKey('café')).toBe('custom-caf'); // accents are non-alnum → separator
  });

  it('custom- prefix makes built-in collision impossible by construction', () => {
    expect(makeCategoryKey('Town', [])).toBe('custom-town');
    expect(makeCategoryKey('Town', ['town', 'custom-town']).startsWith('custom-')).toBe(true);
    expect(makeCategoryKey('Town', ['town', 'custom-town'])).toBe('custom-town-2');
  });

  it('collisions with existing keys gain -2/-3/… suffixes', () => {
    expect(makeCategoryKey('crypt', ['custom-crypt'])).toBe('custom-crypt-2');
    expect(makeCategoryKey('crypt', ['custom-crypt', 'custom-crypt-2'])).toBe('custom-crypt-3');
  });

  it('returns null for non-strings and labels that slug to nothing', () => {
    for (const junk of [null, undefined, 42, {}, []]) {
      expect(makeCategoryKey(junk)).toBeNull();
    }
    expect(makeCategoryKey('   ')).toBeNull();
    expect(makeCategoryKey('!!!')).toBeNull();
  });
});
