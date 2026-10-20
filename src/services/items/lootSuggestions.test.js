// @maintained-by-ai
// Generation-internals lane of the loot-generator family (#1161/#1162/#1165 cite this file as
// the loot RNG owner): generateLootSuggestions ONLY — CR-tier gating, treasure-frequency gate,
// the four roll buckets (currency <0.65 / gems 0.65-0.82 / equipment 0.82-0.94 / magic >=0.94),
// equipment eligibility filters, and transport-failure behavior.
// Never re-driven here: normalizeCurrency / formatCurrencyString / calculateEncounterXp are
// pure-helper base #1165 (lootGenerator.test.js); the combatSummary→suggestions bridge is
// #1162 (lootFromCombatSummary.test.js — its 'No loot for these monsters' sentinel is our
// generator's string, honestly owned there); the Clear-Combat gate/award is #1161
// (autoRewardService.test.js).
// RNG discipline (#1072 CANON, #1076 flagship): Math.random is a THROWING decoy by default
// (#1155 loud on any unpinned consumption); each test arms a constant pinned value and the
// consumed-in-order draws are hand-derived ONCE below and pinned as exact tuples (#815) —
// never re-rolled. beforeEach re-arms the decoy (#1057); afterEach restores (#1161:
// clearAllMocks scrubs calls only — fetch is re-fabricated by the router stub every test).
// Zero-RNG proofs (#1035): tier-'none' monsters continue BEFORE the frequency roll, so the
// guard legs provably touch no dice (decoy would throw). Tier boundary coercion honest #959:
// the source loop matches inclusive maxCR first, so CR 1.5 is tier 'none' (skips), CR 3 is
// 'poor', CR 5 is 'moderate' — the real loot gate is CR > 1.5. Fractional strings ('1/4')
// and junk ('invalid' → 0.25) coerce to the same skip. cr<0.5 frequency-0 is UNREACHABLE via
// this entry point (tier 'none' covers it first) — vacuous leg purged #1160.
// Fixtures are BY NAME vs real disk bytes (#977/#993): ogre '2'/450, troll '5'/1800,
// black pudding '4'/1100, Amulet of Health (very rare, wondrous item, requires attunement),
// Chain Shirt 75 gp / Longsword 15 gp. No wall-clock anywhere (#app MANDATORY); no store
// writes (this lane reads no runtime state — zero-write census #1026 is by import: the
// generator's own inputs are the whole world here).
//
// old->new map (13 its -> 11 pinned cases):
//   early returns                     -> t1 (+zero-transport census #1026)
//   CR threshold skip loop          -> t2 (+CR 1.5 boundary row, throwing-decoy zero-RNG proof)
//   CR >= 1.5 includes loot        -> PURGED vacuous: CR 1.5 is tier 'none' (sentinel only);
//                                       real loot gate folded into flagship t4
//   qty multiplies XP / qty 0 -> 1  -> folded: XP arithmetic is pure-lane #1165 (never
//                                       re-drive); qty's LOCAL effect (numEntries cap 4) is
//                                       pinned in the gem row t5 (qty 2 -> 4 entries)
//   multiple monsters aggregate XP   -> folded into flagship t4 (exact combined tuple)
//   mixed valid/invalid CR          -> folded into t2 (invalid-coercion row is the same branch)
//   treasure freq CR<0.5 -> 0      -> PURGED vacuous #1160: unreachable (tier 'none' short-
//                                       circuits before getTreasureFrequency is consulted)
//   treasure freq CR>=0.5 pass      -> strengthened: freq table t3 with strict-> boundary row
//                                       (roll == freq passes) and exact currency tuple
//   currency / gem / equipment / magic buckets -> exact-entry it.each table t5 (was
//                                       find()+toBeDefined); flagship covers currency end-to-end
//   equipment exclusions            -> t6: +Material category and cost-window floor, exact
//                                       sentinel pin (was weak not.toContain on 2 categories)
//   fetch errors / 404s             -> t7: RNG was UNPINNED (violated #1076); now pinned with
//                                       exact loot output both legs (loot survives data-down)
//
// Hand-derived RNG traces (#815 — constant Math.random = r, consumed in call order):
//   flagship r=0.2: ogre freq(0.3)pass -> entries randInt(1,3)=1 -> bucket 0.2 currency
//     -> weighted pick total 1.0 roll 0.2 -> gp -> rollQty(50)=randInt(10,50)=18 gp
//     troll(qty2) freq(1)pass -> randInt(1,4)=1 -> currency -> gp (0.6 wt)
//     -> rollQty(112.5)=randInt(22,112)=40 gp  => 58 gp => '5 platinum pieces, 8 gold pieces'
//   boundary r=0.30 CR2: pass -> 1 entry -> sp (0.4 wt beat by 0.30-0.25>0) -> randInt(100,500)=220 sp
//   gem r=0.75 qty2: entries=4 -> value 125 (pool [50,75,100,125,150] idx3) -> Malachite (idx9)
//     -> adj 'green banded ' -> jewelry 0.75<0.35 false   => 4x 'green banded Malachite, 125 gp'
//   equip r=0.85: 3 entries -> eligible only Chain Shirt (75 in [20,187.5]; Longsword 15 < 20)
//   magic r=0.95: 3 entries -> weighted 0.95*100=95 -> 40+35+17=92<95<=98 -> very rare -> Amulet
//   data-down r=0.5 CR5 qty1: entries randInt(1,3)=2, currency share 112.5/2=56.25 each
//     -> gp -> randInt(11,56)=34 gp x2 = 68 gp

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { generateLootSuggestions } from './lootGenerator.js';
import { clearDataCache } from '../ui/dataLoader.js';

const NO_LOOT = 'No loot for these monsters';

// BY NAME vs real monsters.json disk bytes (#977)
const OGRE = { name: 'Ogre', xp: 450, challenge_rating: '2' };
const BLACK_PUDDING = { name: 'Black Pudding', xp: 1100, challenge_rating: '4' };
const TROLL = { name: 'Troll', xp: 1800, challenge_rating: '5' };

const EQUIPMENT = [
  { name: 'Chain Shirt', cost: { quantity: 75, unit: 'gp' }, equipment_category: 'Armor' },
  { name: 'Longsword', cost: { quantity: 15, unit: 'gp' }, equipment_category: 'Melee Weapons' },
];

const INELIGIBLE_EQUIPMENT = [
  { name: 'Caravan', cost: { quantity: 5000, unit: 'gp' }, equipment_category: 'Property' },
  { name: 'Warhorse', cost: { quantity: 75, unit: 'gp' }, equipment_category: 'Mounts and Vehicles' },
  { name: 'Incense (Block)', cost: { quantity: 2, unit: 'gp' }, equipment_category: 'Material' },
  { name: 'Longsword', cost: { quantity: 15, unit: 'gp' }, equipment_category: 'Melee Weapons' }, // in-category, under the moderate-window floor (20 gp)
];

const MAGIC_ITEMS = [
  { name: 'Wand of Fireballs', rarity: 'rare', type: 'wand', requiresAttunement: true },
  { name: 'Amulet of Health', rarity: 'very rare', type: 'wondrous item', requiresAttunement: true },
];

// Exact rendered entries per the header traces (3 or 4 identical repeats: constant RNG makes
// every numEntries roll land the same bucket and pick the same item).
const GEM_ENTRY = 'green banded Malachite, 125 gp';
const CHAIN_SHIRT_ENTRY = 'Chain Shirt (75 gp)';
const AMULET_ENTRY = '"Amulet of Health" (Very rare, wondrous item, requires attunement)';
const AMULET_ENTRY_3 = [AMULET_ENTRY, AMULET_ENTRY, AMULET_ENTRY];

// URL-router transport (#1010 exact-if-fetch): fresh Response body per call, keyed by URL —
// immune to load-order assumptions the old mockResolvedValueOnce chain made.
function stubFetch(routes = {}) {
  global.fetch = vi.fn(async (url) => new Response(
    JSON.stringify(routes[url] ?? []),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
}

const realRandom = Math.random;

beforeEach(() => {
  clearDataCache(); // #180: force the dataLoader transport to actually run
  stubFetch();
  Math.random = () => { throw new Error('Unpinned RNG consumed — every leg must pin Math.random (#1076/#1155)'); };
});

afterEach(() => {
  Math.random = realRandom; // re-arm decoy for next test happens in beforeEach (#1057)
  vi.clearAllMocks(); // scrub calls only; fetch is re-fabricated by stubFetch (#1161)
});

describe('generateLootSuggestions — RNG-owned generation internals', () => {
  it('empty roster: empty contract, zero transport (#1026 census), zero RNG', async () => {
    for (const roster of [null, undefined, []]) {
      expect(await generateLootSuggestions(roster)).toEqual({ lootEntries: [], totalEncounterXp: 0 });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('CR <= 1.5 is tier none — skipped BEFORE any frequency roll (decoy proves zero RNG #1035)', async () => {
    const skips = [
      ['fractional string', { ...OGRE, name: 'Sprite', xp: 25, challenge_rating: '1/4' }],
      ['CR 0', { name: 'Rat', xp: 0, challenge_rating: 0 }],
      ['missing CR field coerces to 0.25', { name: 'Mystery', xp: 50 }],
      ['junk CR coerces to 0.25 (honest #959)', { name: 'Garbage', xp: 75, challenge_rating: 'invalid' }],
      ['boundary: inclusive maxCR makes CR 1.5 itself none', { ...BLACK_PUDDING, xp: 100, challenge_rating: 1.5 }],
    ];
    for (const [, monster] of skips) {
      // Math.random stays the throwing decoy: none-tier continues first, so no roll is legal.
      expect(await generateLootSuggestions([monster])).toEqual({
        lootEntries: [NO_LOOT],
        totalEncounterXp: monster.xp,
      });
    }
  });

  it.each([
    ['CR 2 denied: roll 0.31 > frequency 0.30', { ...OGRE }, 0.31, [NO_LOOT]],
    ['CR 4 denied: roll 0.51 > frequency 0.50', { ...BLACK_PUDDING }, 0.51, [NO_LOOT]],
    ['CR 2 boundary: roll == frequency passes (check is strict >)', { ...OGRE }, 0.30, ['2 platinum pieces, 2 gold pieces']],
  ])('frequency gate #903 — %s', async (_title, monster, random, lootEntries) => {
    Math.random = () => random;
    expect(await generateLootSuggestions([monster])).toEqual({
      lootEntries,
      totalEncounterXp: monster.xp,
    });
  });

  it('flagship #1076 consumed-in-order pin — ogre+troll(qty2), r=0.2, exact combined tuple', async () => {
    Math.random = () => 0.2;
    const result = await generateLootSuggestions([OGRE, { ...TROLL, qty: 2 }]);
    // 10 draws, in order: 2x freq, 2x numEntries, 2x bucket, 2x weighted-unit-pick, 2x rollQty
    // => 18 gp + 40 gp = 58 gp (see header trace). XP rides the contract as literals.
    expect(result).toEqual({
      lootEntries: ['5 platinum pieces, 8 gold pieces'],
      totalEncounterXp: 4050,
    });
  });

  it.each([
    ['gems 0.65-0.82 — qty 2 raises numEntries to its cap of 4', 0.75, 2, {}, Array(4).fill(GEM_ENTRY), 3600],
    ['equipment 0.82-0.94 — Longsword 15 gp under window floor 20 gp', 0.85, 1, { '/data/equipment.json': EQUIPMENT }, [CHAIN_SHIRT_ENTRY, CHAIN_SHIRT_ENTRY, CHAIN_SHIRT_ENTRY], 1800],
    ['magic items >= 0.94 — weighted pick 95 lands very rare; format incl. attunement', 0.95, 1, { '/data/magic-items.json': MAGIC_ITEMS }, AMULET_ENTRY_3, 1800],
  ])('roll bucket table #903 — %s', async (_title, random, qty, routes, lootEntries, totalEncounterXp) => {
    stubFetch(routes);
    Math.random = () => random;
    expect(await generateLootSuggestions([{ ...TROLL, qty }])).toEqual({
      lootEntries,
      totalEncounterXp,
    });
  });

  it('equipment bucket with every candidate ineligible (Property/Mounts/Material categories + sub-window cost) -> sentinel', async () => {
    stubFetch({ '/data/equipment.json': INELIGIBLE_EQUIPMENT });
    Math.random = () => 0.85;
    expect(await generateLootSuggestions([TROLL])).toEqual({
      lootEntries: [NO_LOOT],
      totalEncounterXp: 1800,
    });
  });

  it('data-down legs (network reject and HTTP 404): contract intact, loot unaffected', async () => {
    // Currency bucket needs no datasets — exact output proves graceful degradation, no throw.
    Math.random = () => 0.5;
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    expect(await generateLootSuggestions([TROLL])).toEqual({
      lootEntries: ['6 platinum pieces, 8 gold pieces'],
      totalEncounterXp: 1800,
    });

    global.fetch = vi.fn(async () => new Response('', { status: 404 }));
    expect(await generateLootSuggestions([TROLL])).toEqual({
      lootEntries: ['6 platinum pieces, 8 gold pieces'],
      totalEncounterXp: 1800,
    });
  });
});
