// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as dataLoader from './dataLoader.js';
import {
    loadClassData,
    loadRaceData,
    loadBackgroundData,
    getCachedBackgroundData,
    loadFeatData,
    loadValidationRules,
    getCachedPointBuyCosts,
    fetchClassData,
    fetchRaceData,
    fetchSubraceData,
    fetchBackgroundData,
    fetchFeatData,
    loadAbilityScores,
    loadEquipment,
    loadMonsters,
    loadMagicItems,
    loadFightingStyles,
    loadSpellData,
    loadManeuvers,
    loadSpells,
    loadSkills,
    loadWildMagicSurgeTable,
    clearDataCache,
    getCacheState
} from './dataLoader.js';

// ---------------------------------------------------------------------------
// Disk census (fixture integrity): the routing map is derived from REAL disk
// existence of public/data/ and public/data/2024/, never from memory. The
// fetch stub is URL-aware and serves the actual file bytes (memoized), so a
// route that points at the wrong file returns the wrong bytes and fails.
// Paths absent from disk honestly 404 — no fabricated-disk-bytes (#1462).
// ---------------------------------------------------------------------------
const publicRoot = path.resolve(process.cwd(), 'public'); // vitest cwd = repo root
const dataRoot = path.join(publicRoot, 'data');
const sharedOnDisk = new Set(fs.readdirSync(dataRoot).filter(f => f.endsWith('.json')));
const v2024OnDisk = new Set(fs.readdirSync(path.join(dataRoot, '2024')).filter(f => f.endsWith('.json')));

function existsOnDisk(url) {
    if (url.startsWith('/data/2024/')) return v2024OnDisk.has(url.slice('/data/2024/'.length));
    if (url.startsWith('/data/')) return sharedOnDisk.has(url.slice('/data/'.length));
    return false;
}

const realBytesMemo = new Map();
function realData(url) {
    if (!realBytesMemo.has(url)) {
        realBytesMemo.set(url, JSON.parse(fs.readFileSync(path.join(publicRoot, url), 'utf8')));
    }
    return realBytesMemo.get(url);
}

function jsonResponse(data) {
    return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => data
    };
}

function htmlResponse(status) {
    return {
        ok: false,
        status,
        headers: new Map([['content-type', 'text/html']]),
        json: async () => { throw new Error(`stub refuses to parse non-JSON body for ${status}`); }
    };
}

describe('dataLoader', () => {
    let fetchMock;

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // URL-aware stub: exact-bytes-per-path, honest 404s off the disk census.
        fetchMock = vi.fn(async (url) => (existsOnDisk(url) ? jsonResponse(realData(url)) : htmlResponse(404)));
        vi.stubGlobal('fetch', fetchMock);
        clearDataCache();
    });

    afterEach(() => {
        clearDataCache(); // protect sibling lanes from leaked disk-byte caches
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('exports exactly the 24 loader/cache functions this service owns', () => {
        expect(Object.keys(dataLoader).sort()).toStrictEqual([
            'clearDataCache',
            'fetchBackgroundData',
            'fetchClassData',
            'fetchFeatData',
            'fetchRaceData',
            'fetchSubraceData',
            'getCachedBackgroundData',
            'getCachedPointBuyCosts',
            'getCacheState',
            'loadAbilityScores',
            'loadBackgroundData',
            'loadClassData',
            'loadEquipment',
            'loadFightingStyles',
            'loadFeatData',
            'loadMagicItems',
            'loadManeuvers',
            'loadMonsters',
            'loadRaceData',
            'loadSkills',
            'loadSpellData',
            'loadSpells',
            'loadValidationRules',
            'loadWildMagicSurgeTable'
        ].sort());
    });

    describe('routing law (getDataPath + fixed shared paths)', () => {
        // Every routed filename is disk-existence-proven; per-URL bytes are
        // distinguishable because each path serves only its own real file.
        const ROUTE_TABLE = [
            ['loadClassData() default ruleset', () => loadClassData(), '/data/classes.json'],
            ['loadClassData("2024")', () => loadClassData('2024'), '/data/2024/classes.json'],
            ['loadRaceData("5e")', () => loadRaceData('5e'), '/data/races.json'],
            ['loadRaceData("2024")', () => loadRaceData('2024'), '/data/2024/races.json'],
            ['loadFeatData("5e")', () => loadFeatData('5e'), '/data/feats.json'],
            ['loadFeatData("2024")', () => loadFeatData('2024'), '/data/2024/feats.json'],
            ['loadSpells("5e")', () => loadSpells('5e'), '/data/spells.json'],
            ['loadSpells("2024")', () => loadSpells('2024'), '/data/2024/spells.json'],
            ['loadBackgroundData("2024")', () => loadBackgroundData('2024'), '/data/2024/backgrounds.json'],
            ['loadManeuvers("2024")', () => loadManeuvers('2024'), '/data/2024/maneuvers.json'],
            ['loadAbilityScores()', () => loadAbilityScores(), '/data/ability-scores.json'],
            ['loadEquipment() shared-only', () => loadEquipment(), '/data/equipment.json'],
            ['loadMonsters() shared-only', () => loadMonsters(), '/data/monsters.json'],
            ['loadMagicItems() shared-only', () => loadMagicItems(), '/data/magic-items.json'],
            ['loadFightingStyles() shared-only', () => loadFightingStyles(), '/data/fighting-styles.json']
        ];

        it.each(ROUTE_TABLE)('%s requests its exact disk-proven URL and returns that file bytes', async (_label, call, url) => {
            expect(existsOnDisk(url), `${url} must exist on disk`).toBe(true);
            const result = await call();
            expect(result).toBe(realData(url));
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith(url);
            clearDataCache(); // next row must fetch its own path
            fetchMock.mockClear();
        });

        it('loadValidationRules unwraps the version-keyed wrapper file for each ruleset', async () => {
            // Disk census: BOTH rules-validation.json files are top-keyed by ruleset.
            const raw5e = realData('/data/rules-validation.json');
            const raw24 = realData('/data/2024/rules-validation.json');
            expect(Object.keys(raw5e).sort()).toStrictEqual(['2024', '5e']);
            expect(Object.keys(raw24)).toStrictEqual(['2024']);

            const v5e = await loadValidationRules('5e');
            expect(v5e).toBe(raw5e['5e']); // unwrapped identity, not the raw wrapper
            expect(v5e).not.toBe(raw5e);
            expect(Object.keys(v5e).sort()).toStrictEqual(['ability_score_max', 'background_languages', 'feats', 'level_range', 'point_buy']);

            const v24 = await loadValidationRules('2024');
            expect(v24).toBe(raw24['2024']);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock.mock.calls.map(c => c[0])).toStrictEqual(['/data/rules-validation.json', '/data/2024/rules-validation.json']);
        });

        it('loadWildMagicSurgeTable parses real disk ranges to numbers (leading zeros) and caches the parse', async () => {
            const raw = realData('/data/wild-magic-surge.json');
            const table = await loadWildMagicSurgeTable();
            expect(table).toHaveLength(raw.length);
            // Disk head row is "01-04" -> Number coercion strips the leading zero.
            expect(table[0]).toStrictEqual({ min: 1, max: 4, effect: raw[0].effect });
            expect(table.every(e => typeof e.min === 'number' && typeof e.max === 'number' && typeof e.effect === 'string')).toBe(true);
            expect(await loadWildMagicSurgeTable()).toBe(table); // cached shared reference
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('collapses undefined / unknown / trailing-slash versions onto the 5e route via one cache entry', async () => {
            const disk = realData('/data/classes.json');
            expect(await loadClassData()).toBe(disk);           // undefined -> guard -> 5e
            expect(await loadClassData('invalid')).toBe(disk);  // unknown version -> guard -> 5e
            expect(await loadClassData('2024/')).toBe(disk);    // "2024/" !== "2024" -> guard -> 5e
            expect(fetchMock).toHaveBeenCalledTimes(1);            // all three share the one 5e cache entry
            expect(fetchMock).toHaveBeenCalledWith('/data/classes.json');
        });

        it('loadSpells/loadManeuvers guard unknown versions loudly (mirrors the loadData :69 sibling) and refuse with []', async () => {
            // Fixed #1542 crash-twins asymmetry: loadData() guards !versionCache at :69;
            // loadSpells/loadManeuvers now mirror that guard — unknown versions are
            // INVALID input, so they log loudly and return an honest [] without fetching.
            await expect(loadSpells('invalid')).resolves.toStrictEqual([]);
            await expect(loadSpells('2024/')).resolves.toStrictEqual([]);
            await expect(loadManeuvers('invalid')).resolves.toStrictEqual([]);
            expect(fetchMock).not.toHaveBeenCalled();
            expect(console.error.mock.calls.map(c => c[0])).toStrictEqual([
                '[dataLoader] Unknown ruleset version "invalid" passed to loadSpells — refusing with []',
                '[dataLoader] Unknown ruleset version "2024/" passed to loadSpells — refusing with []',
                '[dataLoader] Unknown ruleset version "invalid" passed to loadManeuvers — refusing with []'
            ]);
            // maneuvers.json exists only in /data/2024/: the default '5e' route 404s
            // (cache key exists so the guard stays silent) and resolves [] WITHOUT caching -> refetch.
            expect(existsOnDisk('/data/maneuvers.json')).toBe(false);
            expect(await loadManeuvers()).toStrictEqual([]);
            expect(await loadManeuvers()).toStrictEqual([]);
            expect(fetchMock.mock.calls.map(c => c[0])).toStrictEqual(['/data/maneuvers.json', '/data/maneuvers.json']);
            expect(console.error).toHaveBeenCalledTimes(3); // 404--but-not-thrown lane adds no log
            await expect(loadClassData('invalid')).resolves.toBe(realData('/data/classes.json')); // contrast: loadData delegates to 5e
        });
    });

    describe('cache law', () => {
        it('successful loads cache by shared reference: repeat calls fetch zero times and return the identical object', async () => {
            const classes = await loadClassData('5e');
            expect(classes).toBe(realData('/data/classes.json'));
            expect(await loadClassData('5e')).toBe(classes);

            const equipment = await loadEquipment();
            expect(await loadEquipment()).toBe(equipment);

            const monsters = await loadMonsters();
            expect(await loadMonsters()).toBe(monsters);

            expect(fetchMock.mock.calls.map(c => c[0])).toStrictEqual([
                '/data/classes.json',
                '/data/equipment.json',
                '/data/monsters.json'
            ]);
        });

        it('pins the in-flight dedupe law: loadData double-fetches concurrent callers; spells dedupes per version', async () => {
            // #1509 double-load: the dataPromises slot is nulled synchronously
            // before the fetch resolves, so the dedupe check can never hit.
            const [a, b] = await Promise.all([loadClassData('5e'), loadClassData('5e')]);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(a).toBe(b);

            fetchMock.mockClear();
            const [s1, s2] = await Promise.all([loadSpells('5e'), loadSpells('5e')]);
            expect(fetchMock).toHaveBeenCalledTimes(1); // live version-tagged dedupe here
            expect(s1).toBe(s2);
            expect(s1).toBe(realData('/data/spells.json'));

            clearDataCache();
            fetchMock.mockClear();
            const [v5, v24] = await Promise.all([loadSpells('5e'), loadSpells('2024')]);
            expect(fetchMock.mock.calls.map(c => c[0])).toStrictEqual(['/data/spells.json', '/data/2024/spells.json']);
            expect(v5).toBe(realData('/data/spells.json'));       // no wrong-file bleed
            expect(v24).toBe(realData('/data/2024/spells.json'));
            const [c5, c24] = await Promise.all([loadSpells('5e'), loadSpells('2024')]);
            expect(c5).toBe(v5);
            expect(c24).toBe(v24);
            expect(fetchMock).toHaveBeenCalledTimes(2); // both versions cached independently
        });

        it('clearDataCache resets the exact versioned shape and every lane refetches; getCacheState is a fresh deep clone', async () => {
            await loadClassData('5e');
            await loadSpells('2024');
            await loadEquipment();

            const versionKeys = ['classes', 'races', 'backgrounds', 'feats', 'rules-validation', 'spells', 'maneuvers'];
            const before = getCacheState();
            // NB: '2024' is an integer-like key — JS enumerates it before '5e' regardless of insertion order.
            expect(Object.keys(before).sort()).toStrictEqual(['2024', '5e']);
            expect(Object.keys(before['5e'])).toStrictEqual(versionKeys);
            expect(Object.keys(before['2024'])).toStrictEqual(versionKeys);
            expect(before['5e'].classes).not.toBeNull();
            expect(before['2024'].spells).not.toBeNull();

            before['5e'].classes = 'POISON'; // mutating the clone must not poison the cache
            expect(getCacheState()['5e'].classes).not.toBe('POISON');

            clearDataCache();
            const after = getCacheState();
            expect(after['5e']).toStrictEqual(Object.fromEntries(versionKeys.map(k => [k, null])));
            expect(after['2024']).toStrictEqual(Object.fromEntries(versionKeys.map(k => [k, null])));

            fetchMock.mockClear();
            expect(await loadClassData('5e')).toBe(realData('/data/classes.json'));
            expect(await loadSpells('2024')).toBe(realData('/data/2024/spells.json'));
            expect(await loadEquipment()).toBe(realData('/data/equipment.json'));
            expect(await loadAbilityScores()).toBe(realData('/data/ability-scores.json'));
            expect(fetchMock.mock.calls.map(c => c[0])).toStrictEqual([
                '/data/classes.json',
                '/data/2024/spells.json',
                '/data/equipment.json',
                '/data/ability-scores.json'
            ]);
        });
    });

    describe('failure arms', () => {
        it('non-optional HTTP 500: logs the exact failure bytes, resolves [], and never caches the failure', async () => {
            fetchMock.mockImplementation(async () => htmlResponse(500));
            expect(await loadClassData('5e')).toStrictEqual([]);
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error.mock.calls[0][0]).toBe('Error loading 5e classes.json:');
            expect(console.error.mock.calls[0][1]).toBeInstanceOf(Error);
            expect(console.error.mock.calls[0][1].message).toBe('Failed to load 5e classes.json from /data/classes.json');
            expect(await loadClassData('5e')).toStrictEqual([]);
            expect(fetchMock).toHaveBeenCalledTimes(2); // failure is a cache miss by law
        });

        it('network reject is logged verbatim and swallowed to [] — the loader promise never rejects', async () => {
            const boom = new Error('network down');
            fetchMock.mockImplementation(async () => { throw boom; });
            await expect(loadClassData('5e')).resolves.toStrictEqual([]);
            expect(console.error).toHaveBeenCalledWith('Error loading 5e classes.json:', boom);
        });

        it('optional backgrounds: real 404 for /data/backgrounds.json caches [] silently; HTTP 500 stays uncached', async () => {
            expect(existsOnDisk('/data/backgrounds.json')).toBe(false); // disk census proof of the optional lane
            const r1 = await loadBackgroundData('5e');
            expect(r1).toStrictEqual([]);
            expect(console.error).not.toHaveBeenCalled();
            const r2 = await loadBackgroundData('5e');
            expect(r2).toStrictEqual([]); // [] cached by VALUE (fresh literal each miss), proven only by fetch count
            expect(fetchMock).toHaveBeenCalledTimes(1); // second call: cache hit, zero fetches

            fetchMock.mockImplementation(async () => htmlResponse(500));
            expect(await loadBackgroundData('2024')).toStrictEqual([]);
            expect(console.error).toHaveBeenCalledWith('Error loading 2024 backgrounds.json:', expect.anything());
            expect(await loadBackgroundData('2024')).toStrictEqual([]);
            expect(fetchMock).toHaveBeenCalledTimes(3); // optional 500 not cached: refetch each call
        });

        it('Vite-style ok:true text/html: non-optional throws to [] uncached; optional caches []', async () => {
            fetchMock.mockImplementation(async () => ({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'text/html']]),
                json: async () => { throw new Error('must never parse html body'); }
            }));

            expect(await loadClassData('5e')).toStrictEqual([]);
            expect(console.error.mock.calls[0][0]).toBe('Error loading 5e classes.json:');
            expect(console.error.mock.calls[0][1].message).toBe('Expected JSON but got text/html for 5e classes.json');
            await loadClassData('5e');
            expect(fetchMock).toHaveBeenCalledTimes(2); // non-optional HTML is not cached

            fetchMock.mockClear();
            console.error.mockClear();
            const b1 = await loadBackgroundData('2024'); // optional lane caches [] on non-JSON
            expect(b1).toStrictEqual([]);
            expect(await loadBackgroundData('2024')).toStrictEqual([]); // cached by value; hit proven by fetch count
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('loadAbilityScores failure arm returns the full six-entry constant fallback fresh each refetch', async () => {
            const boom = new Error('net down');
            fetchMock.mockImplementation(async () => { throw boom; });
            const r1 = await loadAbilityScores();
            expect(r1).toStrictEqual([
                { full_name: 'Strength', skills: ['Athletics'] },
                { full_name: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
                { full_name: 'Constitution', skills: [] },
                { full_name: 'Intelligence', skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'] },
                { full_name: 'Wisdom', skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] },
                { full_name: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] }
            ]);
            expect(console.error).toHaveBeenCalledWith('Error loading ability scores:', boom);
            const r2 = await loadAbilityScores();
            expect(r2).not.toBe(r1); // failure never enters sharedDataCache: distinct array
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('entity lookups', () => {
        const LOOKUPS = [
            ['fetchClassData', fetchClassData, '/data/classes.json', '5e'],
            ['fetchRaceData', fetchRaceData, '/data/races.json', '5e'],
            ['fetchFeatData', fetchFeatData, '/data/feats.json', '5e'],
            ['fetchBackgroundData', fetchBackgroundData, '/data/2024/backgrounds.json', '2024']
        ];

        it.each(LOOKUPS)('%s matches by exact name then by index, misses to null, empty arg fetches nothing', async (label, fn, url, version) => {
            const entries = realData(url);
            expect(await fn(entries[0].name, version)).toBe(entries[0]);   // name arm
            expect(await fn(entries[1].index, version)).toBe(entries[1]);  // index arm (lowercase lookup string)
            expect(await fn('NotAnEntityAtAll', version)).toBeNull();      // miss arm
            const callsBefore = fetchMock.mock.calls.length;
            expect(await fn('', version)).toBeNull();                        // falsy-name guard
            expect(fetchMock).toHaveBeenCalledTimes(callsBefore);            // guard issued no fetch
        });

        it('fetchSubraceData searches nested 2024 subraces vs flat 5e top-level entries', async () => {
            const r24 = realData('/data/2024/races.json');
            const parent = r24.find(r => Array.isArray(r.subraces) && r.subraces.length > 0);
            expect(parent, 'disk census: 2024 races must nest subraces').toBeTruthy();
            expect(await fetchSubraceData(parent.subraces[0].name, '2024')).toBe(parent.subraces[0]); // nested arm
            expect(await fetchSubraceData('NotASubrace', '2024')).toBeNull();                          // nested miss

            const r5 = realData('/data/races.json');
            expect(await fetchSubraceData(r5[0].name, '5e')).toBe(r5[0]);                              // flat arm: top-level find
            expect(await fetchSubraceData('NotASubrace', '5e')).toBeNull();                            // flat miss
            expect(await fetchSubraceData('', '2024')).toBeNull();                                     // falsy guard

            expect(fetchMock.mock.calls.map(c => c[0])).toStrictEqual(['/data/2024/races.json', '/data/races.json']);
        });

        it('loadSpellData routes from playerStats.rules with a 5e default (falsy-map arms)', async () => {
            expect(await loadSpellData({ rules: '2024' })).toBe(realData('/data/2024/spells.json'));
            expect(await loadSpellData({})).toBe(realData('/data/spells.json'));        // rules undefined -> 5e
            expect(await loadSpellData(undefined)).toBe(realData('/data/spells.json')); // ?. guard -> 5e
            expect(await loadSpellData({ rules: '2024' })).toBe(realData('/data/2024/spells.json')); // cache hit
            expect(fetchMock.mock.calls.map(c => c[0])).toStrictEqual(['/data/2024/spells.json', '/data/spells.json']);
        });
    });

    describe('sync cache getters', () => {
        it('getCachedBackgroundData: null before load, disk bytes after 2024 load, [] passthrough after optional 404', async () => {
            expect(getCachedBackgroundData('2024')).toBeNull(); // unloaded
            expect(getCachedBackgroundData('bogus')).toBeNull(); // unknown version guard

            const notFound = await loadBackgroundData('5e'); // real 404 lane caches []
            expect(notFound).toStrictEqual([]);
            expect(getCachedBackgroundData('5e')).toStrictEqual([]); // cached [] is a distinct literal from the returned one

            await loadBackgroundData('2024');
            expect(getCachedBackgroundData('2024')).toBe(realData('/data/2024/backgrounds.json'));
        });

        it('getCachedPointBuyCosts unwraps the version-keyed cache to reach the real disk costs', async () => {
            expect(getCachedPointBuyCosts()).toBeNull(); // default arg, unloaded
            const raw = realData('/data/rules-validation.json');
            await loadValidationRules('5e'); // populates the RAW (version-keyed) cache
            // Fixed #1542: the cache stores the wrapper top-keyed by ruleset, so the
            // getter reads cached[version].point_buy.costs — the real disk costs now
            // reach consumers (src/config/utils.js getPointBuyCostsSync) instead of
            // silently serving DEFAULT_POINT_BUY_COSTS.
            expect(raw.point_buy).toBeUndefined();
            expect(raw['5e'].point_buy.costs).toStrictEqual({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 });
            expect(getCachedPointBuyCosts('5e')).toBe(raw['5e'].point_buy.costs); // cached identity, zero fetches
            expect(getCachedPointBuyCosts('bogus')).toBeNull(); // unknown version guard
            expect(fetchMock).toHaveBeenCalledTimes(1); // only the one loadValidationRules fetch

            // 2024 lane: /data/2024/rules-validation.json is single-keyed by '2024'.
            const raw24 = realData('/data/2024/rules-validation.json');
            await loadValidationRules('2024');
            expect(getCachedPointBuyCosts('2024')).toBe(raw24['2024'].point_buy.costs);
            // Consumer byte-parity: today's disk costs equal the config/utils.js:11
            // DEFAULT_POINT_BUY_COSTS fallback, so getPointBuyCostsSync behavior is
            // unchanged; future disk edits now propagate instead of being masked.
            expect(getCachedPointBuyCosts('5e')).toStrictEqual({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('loadSkills derives pairs from real ability bytes and from the constant fallback on network failure', async () => {
            const derived = await loadSkills();
            // Disk ability-scores.json opens with Strength:[Athletics] — head bytes
            // distinguish the derived path from the alphabetical fallback head.
            expect(derived[0]).toStrictEqual({ name: 'Athletics', ability: 'Strength' });
            expect(derived.every(s => Object.keys(s).sort().join(',') === 'ability,name')).toBe(true);
            expect(await loadSkills()).toBe(derived); // cached shared reference
            expect(fetchMock).toHaveBeenCalledTimes(1);

            // Reject lane: loadAbilityScores swallows to its constant fallback and
            // loadSkills still derives normally (its own catch stays unreachable).
            clearDataCache(); // drop the byte caches so the reject actually hits fetch
            fetchMock.mockImplementation(async () => { throw new Error('net down'); });
            const offline = await loadSkills();
            expect(offline).toHaveLength(18);
            expect(offline[0]).toStrictEqual({ name: 'Athletics', ability: 'Strength' }); // derived from the constant ability fallback
            expect(offline).not.toBe(derived); // freshly derived, not the cleared cache
            expect(fetchMock).toHaveBeenCalledTimes(2); // 1 online ability fetch + 1 genuine rejected attempt
        });
    });
});
