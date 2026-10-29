// @maintained-by-ai
// Pure-helper lane (lootGenerator family map #1161/#1162): owns ONLY the four pure exports —
// normalizeCurrency, formatCurrencyString, parseCurrencyFromLootText, calculateEncounterXp.
// The combatSummary→suggestions
// bridge is owned by lootFromCombatSummary.test.js; generation internals (CR tiers, RNG, gems,
// magic items) by lootSuggestions.test.js; the Clear-Combat gate by autoRewardService.test.js
// — cited here, never re-driven.
// The rounding table below is CANONICAL: #1163 deleted lootGenerator-private.test.js as fully
// redundant, its 7 rounding legs certified covered by these rows — half-up 0.005,
// fp-reconstitute 2.55, four-denom 1234.56, zero-fill 100, digit-9 999.99, and honest
// negative/NaN/±Inf coercion #959. Preserve rows verbatim.
// Zero-RNG BY CONSTRUCTION: pure arithmetic, no dice (diceRoller CANON #1072 has nothing to
// pin here), no wall-clock (#app MANDATORY), no store/network reads (runtime tuples #932/#1019
// and store-faithful #1137/#1091 are sibling lanes).
//
// old->new map (34 -> 30 cases, 21 its -> 4 blocks):
//   normalizeCurrency 13 its                -> 13-row it.each rounding table (every input/output
//                                              pair preserved byte-for-byte)
//   formatCurrencyString 9 its (25 asserts) -> 9-row it.each faces; removed 99x99 junk row and
//                                              duplicate zero-skip/plural legs (pinned by the
//                                              full-join and all-negative rows)
//   calculateEncounterXp 12 its            -> invalid-input loop + string TypeError + 7-row
//                                              it.each sum table; removed redundant missing-qty
//                                              dupes (qty undefined === qty missing at runtime),
//                                              qty:null (same || branch as qty:0), qty:1000 junk

import { describe, it, expect } from 'vitest';

import {
  normalizeCurrency,
  formatCurrencyString,
  parseCurrencyFromLootText,
  parsePureCurrencyLine,
  calculateEncounterXp,
  NO_LOOT_SENTINEL,
} from './lootGenerator.js';

describe('normalizeCurrency — canonical rounding table (#1163)', () => {
  it.each([
    ['zero: all denominations 0', 0, { pp: 0, gp: 0, sp: 0, cp: 0 }],
    ['fp-reconstitute: 2.55 survives Math.round', 2.55, { pp: 0, gp: 2, sp: 5, cp: 5 }],
    ['four denominations: 1234.56', 1234.56, { pp: 123, gp: 4, sp: 5, cp: 6 }],
    ['odd CP remainder below 1 gp', 0.07, { pp: 0, gp: 0, sp: 0, cp: 7 }],
    ['sub-1-cp rounds down', 0.004, { pp: 0, gp: 0, sp: 0, cp: 0 }],
    ['exact half rounds up: 0.005 gp -> 1 cp', 0.005, { pp: 0, gp: 0, sp: 0, cp: 1 }],
    ['zero-fill at 100 GP boundary', 100, { pp: 10, gp: 0, sp: 0, cp: 0 }],
    ['carry at 10 GP boundary', 10, { pp: 1, gp: 0, sp: 0, cp: 0 }],
    ['digit-9 across all denominations', 999.99, { pp: 99, gp: 9, sp: 9, cp: 9 }],
    ['negative input stays negative (honest #959)', -5.25, { pp: -1, gp: -6, sp: -3, cp: -5 }],
    ['NaN propagates to all denominations', NaN, { pp: NaN, gp: NaN, sp: NaN, cp: NaN }],
    ['+Infinity: pp Infinity, rest NaN', Infinity, { pp: Infinity, gp: NaN, sp: NaN, cp: NaN }],
    ['-Infinity: pp -Infinity, rest NaN', -Infinity, { pp: -Infinity, gp: NaN, sp: NaN, cp: NaN }],
  ])('%s', (_name, input, expected) => {
    expect(normalizeCurrency(input)).toEqual(expected);
  });
});

describe('formatCurrencyString — faces', () => {
  it.each([
    ['all-zero falls back to the sentinel', { pp: 0, gp: 0, sp: 0, cp: 0 }, '0 platinum pieces'],
    ['missing properties count as zero', {}, '0 platinum pieces'],
    ['full join: pp singular, rest plural', { pp: 1, gp: 3, sp: 2, cp: 5 }, '1 platinum piece, 3 gold pieces, 2 silver coins, 5 copper coins'],
    ['gold singular', { pp: 0, gp: 1, sp: 0, cp: 0 }, '1 gold piece'],
    ['silver singular noun is "coin"', { pp: 0, gp: 0, sp: 1, cp: 0 }, '1 silver coin'],
    ['copper singular noun is "coin"', { pp: 0, gp: 0, sp: 0, cp: 1 }, '1 copper coin'],
    ['zero denominations omitted', { pp: 0, gp: 5, sp: 0, cp: 3 }, '5 gold pieces, 3 copper coins'],
    ['mixed signs; -1 takes plural (honest)', { pp: 1, gp: -1 }, '1 platinum piece, -1 gold pieces'],
    ['negatives included in output', { pp: -1, gp: -2, sp: -3, cp: -4 }, '-1 platinum pieces, -2 gold pieces, -3 silver coins, -4 copper coins'],
  ])('%s', (_name, currency, expected) => {
    expect(formatCurrencyString(currency)).toBe(expected);
  });
});

describe('calculateEncounterXp', () => {
  it('falsy and length-less rosters sum to 0; array-like string throws (coercion honest #959)', () => {
    for (const roster of [null, undefined, [], 42, { name: 'Goblin' }]) {
      expect(calculateEncounterXp(roster)).toBe(0);
    }
    expect(() => calculateEncounterXp('goblins')).toThrow(TypeError);
  });

  it.each([
    ['xp x qty', [{ name: 'Goblin', xp: 50, qty: 2 }], 100],
    ['qty 0 coerced to 1 via || (0 monsters still counts 1)', [{ name: 'A', xp: 50, qty: 0 }], 50],
    ['missing qty defaults to 1', [{ name: 'Goblin', xp: 50 }], 50],
    ['missing xp defaults to 0', [{ name: 'Unknown' }], 0],
    ['mixed rosters with and without xp/qty', [
      { name: 'Goblin', xp: 50, qty: 2 },
      { name: 'Skeleton' },
      { name: 'Orc', xp: 200 },
    ], 300],
    ['negative xp subtracts (no validation, honest)', [
      { name: 'Friendly NPC', xp: -50 },
      { name: 'Hostile NPC', xp: 100 },
    ], 50],
    ['negative qty subtracts (honest)', [{ name: 'Negative', xp: 50, qty: -2 }], -100],
  ])('%s', (_name, monsters, expected) => {
    expect(calculateEncounterXp(monsters)).toBe(expected);
  });
});

describe('parseCurrencyFromLootText — pure-currency-line parser', () => {
  it.each([
    ['generator faces: platinum-only line', '70 platinum pieces', { pp: 70, gp: 0, sp: 0, cp: 0 }],
    ['generator full join, all four denominations', '1 platinum piece, 3 gold pieces, 2 silver coins, 5 copper coins', { pp: 1, gp: 3, sp: 2, cp: 5 }],
    ['zero denominations omitted', '5 gold pieces, 3 copper coins', { pp: 0, gp: 5, sp: 0, cp: 3 }],
    ['abbreviations', '50 pp, 12 gp', { pp: 50, gp: 12, sp: 0, cp: 0 }],
    ['thousands separators', '1,000 gp', { pp: 0, gp: 1000, sp: 0, cp: 0 }],
    ['singular gold piece', '1 gold piece', { pp: 0, gp: 1, sp: 0, cp: 0 }],
  ])('%s', (_name, text, expected) => {
    expect(parseCurrencyFromLootText(text)).toEqual(expected);
  });

  it('sums multiple currency lines in one loot session', () => {
    expect(parseCurrencyFromLootText('70 platinum pieces\n25 gold pieces\n10 silver coins')).toEqual({ pp: 70, gp: 25, sp: 10, cp: 0 });
  });

  it('round-trips every formatCurrencyString face back to its currency object', () => {
    const faces = [
      { pp: 1, gp: 3, sp: 2, cp: 5 },
      { pp: 70, gp: 0, sp: 0, cp: 0 },
      { pp: 0, gp: 5, sp: 0, cp: 3 },
      { pp: 123, gp: 4, sp: 5, cp: 6 },
    ];
    for (const currency of faces) {
      expect(parseCurrencyFromLootText(formatCurrencyString(currency))).toEqual(currency);
    }
  });

  it.each([
    ['empty text', ''],
    ['no-loot sentinel', 'No loot for these monsters'],
    ['item-value suffix stays an item, not cash', 'Pearl, 100 gp'],
    ['equipment cost in parens is not cash', 'Scale Mail (15 gp)'],
    ['magic item line', '"Ring of Feather Falling" (Rare, Ring)'],
    ['pouch phrasing is an item line', 'a pouch of 25 gp'],
  ])('%s credits zero', (_name, text) => {
    expect(parseCurrencyFromLootText(text)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });

  it('credits only the pure currency lines of a mixed loot block', () => {
    const text = [
      '70 platinum pieces, 3 gold pieces',
      'Pearl, 100 gp',
      '"Shield +1" (Rare, Shield)',
      'Scale Mail (15 gp)',
      '50 sp',
    ].join('\n');
    expect(parseCurrencyFromLootText(text)).toEqual({ pp: 70, gp: 3, sp: 50, cp: 0 });
  });

  it('falsy input resolves to the zero ledger', () => {
    expect(parseCurrencyFromLootText(null)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
    expect(parseCurrencyFromLootText(undefined)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });

  it('"and"-joined currency line is credited', () => {
    expect(parseCurrencyFromLootText('10 gp and 5 sp')).toEqual({ pp: 0, gp: 10, sp: 5, cp: 0 });
  });
});

// 2026-10-29-AC: shared pure-currency detector behind both the deposit parser
// and the manual-award loot-row gate (currency-only = no duplicate 'loot' row).
describe('parsePureCurrencyLine — single-line cash detector', () => {
  it.each([
    ['generator platinum line', '70 platinum pieces', [['pp', 70]]],
    ['abbreviations with commas', '50 pp, 12 gp', [['pp', 50], ['gp', 12]]],
    ['and-joined', '10 gp and 5 sp', [['gp', 10], ['sp', 5]]],
  ])('%s → amounts', (_name, line, expected) => {
    expect(parsePureCurrencyLine(line)).toEqual(expected);
  });

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['no-loot sentinel', NO_LOOT_SENTINEL],
    ['item-value residue', 'Pearl, 100 gp'],
    ['parens cost residue', 'Scale Mail (15 gp)'],
    ['pouch phrasing', 'a pouch of 25 gp'],
    ['magic item line', '"Shield +1" (Rare, Shield)'],
    ['null', null],
  ])('%s → null (stays an item line)', (_name, line) => {
    expect(parsePureCurrencyLine(line)).toBeNull();
  });
});
