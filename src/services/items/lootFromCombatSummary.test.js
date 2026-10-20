// @maintained-by-ai
// Bridge lane (#976 adjudication): owns ONLY the combatSummary → generateLootSuggestions
// seam — null-roster guard, the campaign 'targetEffects' summon filter (party-source
// exclude, GM / unknown-source / non-npc / no-index keeps), roster→{index,qty}
// aggregation, and XP enrichment against the REAL /data/monsters.json bytes BY NAME
// (#1086/#1094/#977 — disk bytes via the exact transport, #1010).
// Generation internals (currency, CR tiers, RNG entries) are owned by
// lootSuggestions.test.js; pure helpers by lootGenerator.test.js + lootGenerator-private
// .test.js; the Clear-Combat gate/refusals/award by autoRewardService.test.js
// (#1161 family map — cited here, never re-driven).
// Determinism: every full-result pin uses CR ≤ 1.5 survivors ⇒ tier 'none' consumes no
// RNG, so the exact 'No loot' sentinel is stable; XP pins are RNG-free BY NAME literals
// (disk drift fails loudly). No wall-clock, game state is gesture-derived (#app MANDATORY).
//
// old->new map (14 -> 7):
//   null/missing summary guard          -> guard test (+ zero-transport census #1026)
//   excludes player-summoned npc        \
//   excludes multiple (same caster)      |
//   includes GM-summoned                 |-> tripwire flagship #1099 (one whole roster:
//   includes unknown-source summon       |   exact result 250 XP + sentinel, real bytes,
//   includes no-summon-record npc      |   runtime tuple #932, transport #1010)
//   aggregates XP same type            |
//   aggregates XP multi type           |
//   no-index "even when summoned" x2  /
//   non-npc summoned bypasses filter   \
//   ignores non-summoned effects        |-> it.each filter branch table #903
//   characters empty/undefined          |
//   no targetEffects in store          |
//   missing monster data -> 0 XP      /
import realMonsters from '../../../public/data/monsters.json';

const REAL_BYTES = JSON.stringify(realMonsters);

const store = vi.hoisted(() => ({}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((who, key) => store[`${who}::${key}`] ?? null),
}));

import { generateLootFromCombatSummary } from './lootGenerator.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { clearDataCache } from '../ui/dataLoader.js';

const CN = 'test-campaign';
const npc = (name, monsterIndex) => ({ name, type: 'npc', ...(monsterIndex ? { monsterIndex } : {}) });
const te = (target, source, effect = 'summoned') => ({ target, source, effect });

beforeEach(() => {
  clearDataCache(); // #180: force the dataLoader fetch transport to actually run
  // URL-router transport: the bridge loads the REAL monsters.json bytes BY NAME;
  // magic-items/equipment are lootSuggestions' lane — stubbed empty, never asserted.
  global.fetch = vi.fn(async (url) => new Response(
    url === '/data/monsters.json' ? REAL_BYTES : '[]',
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
});

afterEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.clearAllMocks(); // scrub calls only; getRuntimeValue factory impl survives (#1007/#1161)
});

describe('generateLootFromCombatSummary — combat roster → loot bridge', () => {
  it('null/missing roster: empty contract, zero transport, zero runtime reads (#1026 census)', async () => {
    for (const roster of [null, undefined, {}, { creatures: null }]) {
      expect(await generateLootFromCombatSummary(roster, [], CN))
        .toEqual({ lootEntries: [], totalEncounterXp: 0 });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('flagship tripwire #1099: summon filter, qty aggregation, real monsters.json pricing', async () => {
    store['campaign::targetEffects'] = [
      te('Goblin 1', 'Druid'),          // party summon -> excluded
      te('Wolf 1', 'Druid'),            // same caster, second summon -> excluded
      te('Orc 1', 'GM'),                // GM summon -> kept
      te('Skeleton 1', 'Zephyrus'),     // non-party source -> kept
      te('Goblin 2', 'Druid', 'slowed'), // non-summoned effect is inert
    ];
    const roster = {
      creatures: [
        npc('Goblin 1', 'goblin'),
        npc('Wolf 1', 'wolf'),
        npc('Orc 1', 'orc'),
        npc('Skeleton 1', 'skeleton'),
        npc('Goblin 2', 'goblin'),      // plain duplicates -> qty aggregation
        npc('Goblin 3', 'goblin'),
        npc('Custom', undefined),       // no monsterIndex: survives filter, priced 0 XP
      ],
    };

    const result = await generateLootFromCombatSummary(roster, [{ name: 'Druid' }], CN);

    // BY NAME vs real monsters.json disk bytes: goblin 50 XP ×2 + orc 100 + skeleton 50 = 250
    // (excluded: wolf 50, summon-only goblin). All kept CRs ≤ 1.5 ⇒ tier 'none' ⇒
    // exact sentinel, no RNG consumed — full result contract pinned.
    expect(result).toEqual({ lootEntries: ['No loot for these monsters'], totalEncounterXp: 250 });
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects'); // #932 tuple
    expect(fetch).toHaveBeenCalledWith('/data/monsters.json'); // #1010 transport exact-if-fetch
  });

  it.each([
    ['non-npc summoned by a party member bypasses the filter — real fire elemental', [{ name: 'Fire Elemental', type: 'elemental', monsterIndex: 'fire-elemental' }], [te('Fire Elemental', 'Druid')], [{ name: 'Druid' }], 1800],
    ['non-summoned targetEffects never exclude — goblin still pays', [npc('Goblin 1', 'goblin')], [te('Goblin 1', 'Druid', 'slowed'), te('Goblin 1', 'Cleric', 'blessed')], [{ name: 'Druid' }], 50],
    ['characters undefined: nobody counts as a summoner', [npc('Goblin 1', 'goblin')], [te('Goblin 1', 'Druid')], undefined, 50],
    ['empty characters roster: summons stay on the bill', [npc('Goblin 1', 'goblin')], [te('Goblin 1', 'Druid')], [], 50],
    ['no targetEffects in store: nothing is excluded', [npc('Goblin 1', 'goblin')], null, [{ name: 'Druid' }], 50],
    ['index missing from registry pays 0 XP (#945 honest miss)', [npc('Unknown', 'nonexistent')], null, [], 0],
  ])('%# — %s', async (_title, creatures, effects, characters, xp) => {
    if (effects) store['campaign::targetEffects'] = effects;
    const result = await generateLootFromCombatSummary({ creatures }, characters, CN);
    expect(result.totalEncounterXp).toBe(xp);
  });
});
