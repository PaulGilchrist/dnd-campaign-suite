// @maintained-by-ai
// Lane: CANONICAL owner of getMonsterImageUrl / getMonsterData resolution — the
// custom-vs-bestiary lookup seam (@app invariant: npcs.json is CUSTOM NPCs only;
// pre-made monsters resolve from monsters.json — the two lanes stay byte-distinct #1022).
// Ownership split (do not re-drive here):
//   npcStatBlockUtils.test.js #1159 — findNPCByName + npcToMonsterFormat OUTPUT SHAPE
//     (monsterUtils does NOT export findNPCByName — its matcher is an inline dup of it;
//     that inlined matcher is pinned behaviorally here through the public API only).
//   initiativeService.test.js #1079 — WIRING of resolved imagePath onto combatSummary
//     bytes; encounterToInitiative.test.js #1078 — assembly byte contract.
//   monsterIrvUtils.test.js #1176 — IRV resolution. Consumers (Initiative.jsx,
//   useNpcImageCache.test.js #1010-exact-args) prove call sites, never resolution.
// Transport discipline #1010: loadMonsters fetch counts asserted on the EXACT mock
// instance consumed after vi.resetModules (mocks survive resetModules — references are
// re-acquired per test, no stale-ref theater #1137); zero-fetch proofs on campaign hits.
// No wall-clock #app: monstersCache is seam-free module state, no TTL.
// Old->new map (22 -> 9): URL guard -> U1; URL case/suffix -> U2 (+cache exactly-once);
// URL "not found" + "empty/null/undefined npcs" -> U3 shape table; URL custom-lane
// prefers/skips/first-wins/case+suffix/no-fetch (old #4,#5,#6,#7,#8,#10) -> U4 mega;
// NEW U5 campaign-path prefix branches (were UNTESTED, live via Initiative.jsx:286,
// initiativeService.js:160). DATA guard -> D1; AC coercion 0 vs '15' vs absent
// (old #5,#6) -> D2 table (#959 coercion honesty, #945 zero-is-data); DATA custom lane
// (old #4,#7,#8,#9,#11) -> D3 sentinel-identity mega (npcToMonsterFormat shape is a
// stub sentinel on purpose — shape accuracy owned by #1159, no fake `formatted:true`
// shape theater); DATA bestiary/miss/fallback/fetch (old #2,#3,#10,#12) -> D4 table.
// NEW #1177(b) (10th-11th tests): unified-cache-guard pins — empty monstersCache refetches
// on BOTH lanes (was :35-refetch vs :66-permanent); behavior lives in findBestiaryMonster.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/dataLoader.js', () => ({
  // Bestiary stub: names/indices verbatim from real public/data/monsters.json (#977);
  // only consumed bytes are name + index (#967) — kept minimal, keeps tests offline.
  loadMonsters: vi.fn(() => Promise.resolve([
    { index: 'goblin', name: 'Goblin' },
    { index: 'orc', name: 'Orc' },
    { index: 'tarrasque', name: 'Tarrasque' },
  ])),
}));

vi.mock('../encounters/npcStatBlockUtils.js', () => ({
  // Honest stub: distinct sentinel per call so pass-through identity is provable;
  // real output-shape correctness lives in npcStatBlockUtils.test.js (#1159).
  npcToMonsterFormat: vi.fn((npc) => ({ __customStatBlockFrom: npc.name })),
}));

// Fresh module instance per test resets the module-level monstersCache; imports are
// sequential so loadMonsters/npcToMonsterFormat below are the EXACT instances
// monsterUtils consumes (#1010/#1137), not stale top-level references.
async function fresh() {
  const dataLoader = await import('../ui/dataLoader.js');
  const statBlocks = await import('../encounters/npcStatBlockUtils.js');
  const monsterUtils = await import('./monsterUtils.js');
  return {
    getMonsterImageUrl: monsterUtils.getMonsterImageUrl,
    getMonsterData: monsterUtils.getMonsterData,
    loadMonsters: dataLoader.loadMonsters,
    npcToMonsterFormat: statBlocks.npcToMonsterFormat,
  };
}

const BESTIARY_URL = 'https://paulgilchrist.github.io/dnd-tools/images';

describe('getMonsterImageUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('resolves %s to null without fetching', async (_label, name) => {
    const { getMonsterImageUrl, loadMonsters } = await fresh();
    await expect(getMonsterImageUrl(name)).resolves.toBeNull();
    expect(loadMonsters).not.toHaveBeenCalled();
  });

  it('resolves bestiary image URLs case-insensitively with query suffix-stripping, fetching exactly once across lookups', async () => {
    const { getMonsterImageUrl, loadMonsters } = await fresh();
    await expect(getMonsterImageUrl('gObLiN')).resolves.toBe(`${BESTIARY_URL}/goblin.jpg`);
    await expect(getMonsterImageUrl('Goblin 1')).resolves.toBe(`${BESTIARY_URL}/goblin.jpg`);
    await expect(getMonsterImageUrl('Orc 42')).resolves.toBe(`${BESTIARY_URL}/orc.jpg`);
    await expect(getMonsterImageUrl('tarrasque')).resolves.toBe(`${BESTIARY_URL}/tarrasque.jpg`);
    expect(loadMonsters).toHaveBeenCalledTimes(1); // cache hit after first fetch #1010
  });

  it.each([
    ['unknown name, npcs omitted', 'Unicorn', undefined, null],
    ['unknown name, empty npcs', 'Unicorn', [], null],
    ['unknown name, non-matching npcs', 'Unicorn', [{ name: 'Goblin', imagePath: '/x.png' }], null],
    ['known name, empty npcs', 'Goblin', [], `${BESTIARY_URL}/goblin.jpg`],
    ['known name, null npcs', 'Goblin', null, `${BESTIARY_URL}/goblin.jpg`],
    ['known name, undefined npcs', 'Goblin', undefined, `${BESTIARY_URL}/goblin.jpg`],
    // Whitespace-only passes the !npcName guard, fetches, matches nothing -> null.
    ['whitespace-only name fetches then misses', '   ', undefined, null],
  ])('custom lane disengages: %s', async (_label, name, npcs, expected) => {
    const { getMonsterImageUrl } = await fresh();
    await expect(getMonsterImageUrl(name, npcs)).resolves.toBe(expected);
  });

  it('takes the first valid campaign avatar over bestiary, skipping invalid entries, matching case-insensitively with query suffix-stripping, without fetching', async () => {
    const { getMonsterImageUrl, loadMonsters } = await fresh();
    const matched = { name: 'GOBLIN', imagePath: 'assets/goblin-avatar.png' };
    const npcs = [
      { name: '', imagePath: '/junk/empty-name.png' }, // skipped: empty name
      { name: 'Orc', imagePath: '' },                   // skipped: falsy imagePath
      matched,                                          // matches 'gObLiN 1' -> 'goblin'
      { name: 'goblin', imagePath: '/custom/second.png' }, // ignored: first valid wins
    ];
    await expect(getMonsterImageUrl('gObLiN 1', npcs)).resolves.toBe('assets/goblin-avatar.png');
    expect(loadMonsters).not.toHaveBeenCalled(); // custom hit short-circuits bestiary
  });

  it.each([
    ['prefixes relative avatar with campaign path', 'assets/g.png', 'Frostfall', 'campaigns/Frostfall/assets/g.png'],
    ['leaves already-campaign-scoped path untouched', 'campaigns/other/assets/g.png', 'Frostfall', 'campaigns/other/assets/g.png'],
    ['returns raw path when campaignName omitted', 'assets/g.png', undefined, 'assets/g.png'],
  ])('campaign-path branch: %s', async (_label, imagePath, campaignName, expected) => {
    const { getMonsterImageUrl } = await fresh();
    const npcs = [{ name: 'Goblin', imagePath }];
    await expect(getMonsterImageUrl('Goblin', npcs, campaignName)).resolves.toBe(expected);
  });
});

describe('getMonsterData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('resolves %s to null without fetching', async (_label, name) => {
    const { getMonsterData, loadMonsters } = await fresh();
    await expect(getMonsterData(name)).resolves.toBeNull();
    expect(loadMonsters).not.toHaveBeenCalled();
  });

  it.each([
    // Zero-is-data #945: armorClass 0 is a number -> custom lane engages.
    ['numeric AC 0 is valid stat block data', 0, { name: 'Orc', armorClass: 0 }],
    ['string AC is rejected', '15', { name: 'Orc', armorClass: '15' }],
    ['absent AC is rejected', undefined, { name: 'Orc' }],
    ['null AC is rejected', null, { name: 'Orc', armorClass: null }],
  ])('AC coercion (#959 typeof-number gate): %s', async (_label, _ac, npc) => {
    const { getMonsterData, npcToMonsterFormat } = await fresh();
    const result = await getMonsterData('Orc', [npc]);
    const engaged = typeof npc.armorClass === 'number';
    if (engaged) {
      expect(npcToMonsterFormat).toHaveBeenCalledTimes(1);
      expect(npcToMonsterFormat).toHaveBeenCalledWith(npc); // exact bytes of the match
    } else {
      expect(npcToMonsterFormat).not.toHaveBeenCalled();
      expect(result).toEqual({ index: 'orc', name: 'Orc' }); // fell through to bestiary
    }
  });

  it('passes the first valid campaign NPC verbatim to npcToMonsterFormat over bestiary, skipping invalid entries, without fetching', async () => {
    const { getMonsterData, loadMonsters, npcToMonsterFormat } = await fresh();
    const matched = { name: 'GOBLIN', armorClass: 15 };
    const sentinel = { __sentinel: 'custom-statblock' };
    npcToMonsterFormat.mockReturnValueOnce(sentinel);
    const npcs = [
      { name: '', armorClass: 10 },              // skipped: empty name
      { name: 'goblin', armorClass: '10' },     // skipped: non-numeric AC
      matched,                                   // matches 'goblin 1' -> 'goblin'
      { name: 'goblin', armorClass: 20 },       // ignored: first valid wins
    ];
    await expect(getMonsterData('goblin 1', npcs)).resolves.toBe(sentinel); // verbatim pass-through
    expect(npcToMonsterFormat).toHaveBeenCalledTimes(1);
    expect(npcToMonsterFormat).toHaveBeenCalledWith(matched);
    expect(loadMonsters).not.toHaveBeenCalled();
  });

  it('resolves raw bestiary bytes case-insensitively with suffix-stripping, null on miss, across falsy npcs shapes, fetching once', async () => {
    const { getMonsterData, npcToMonsterFormat, loadMonsters } = await fresh();
    await expect(getMonsterData('tArRaSqUe 2')).resolves.toEqual({ index: 'tarrasque', name: 'Tarrasque' });
    await expect(getMonsterData('Goblin', [])).resolves.toEqual({ index: 'goblin', name: 'Goblin' });
    await expect(getMonsterData('Goblin', null)).resolves.toEqual({ index: 'goblin', name: 'Goblin' });
    await expect(getMonsterData('Unicorn', [{ name: 'Goblin', armorClass: 15 }])).resolves.toBeNull();
    await expect(getMonsterData('   ')).resolves.toBeNull(); // passes guard, matches nothing
    expect(npcToMonsterFormat).not.toHaveBeenCalled(); // bestiary lane returns raw bytes
    expect(loadMonsters).toHaveBeenCalledTimes(1);
  });
});

describe('unified cache guard (#1177(b))', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('treats an empty bestiary cache as not-loaded on the data lane — refetch self-heals', async () => {
    const { getMonsterData, loadMonsters } = await fresh();
    // Simulate loadMonsters' sole failure exit (dataLoader.js:370): resolves [] once.
    loadMonsters.mockResolvedValueOnce([]);
    await expect(getMonsterData('Goblin')).resolves.toBeNull(); // poisoned-empty cached
    expect(loadMonsters).toHaveBeenCalledTimes(1);
    // Old :66 guard would stay cached-permanent and answer null forever; unified
    // guard sees length 0, refetches, and resolves the real bestiary entry.
    await expect(getMonsterData('Goblin')).resolves.toEqual({ index: 'goblin', name: 'Goblin' });
    // Image lane shares the same guard (findBestiaryMonster) — proven in the
    // sibling test below with its own fresh module/cache (fresh() without a
    // resetModules re-returns the same healed-cache instance).
    expect(loadMonsters).toHaveBeenCalledTimes(2);
  });

  it('empty-cache refetch self-heals the image lane through the same guard', async () => {
    const { getMonsterImageUrl, loadMonsters } = await fresh();
    loadMonsters.mockResolvedValueOnce([]); // dataLoader.js:370 failure shape
    await expect(getMonsterImageUrl('Orc')).resolves.toBeNull(); // refetched [] cached
    await expect(getMonsterImageUrl('Orc')).resolves.toBe(`${BESTIARY_URL}/orc.jpg`); // healed
    expect(loadMonsters).toHaveBeenCalledTimes(2);
  });
});
