// @maintained-by-ai
// toolValidation SERVICES lane (#2064): getToolsByCategory + computeSkilledToolUsage units —
// the Skilled-usage computation deferred here by the limits opener (#2061).
// SEAM MAP (siblings cited, never re-pinned here):
// - .limits.test.js (#2061) — getToolLimitsByCategory aggregation, "Skilled pool tracked
//   separately" (pool-vs-usage comparison in validateTools), bg/class/feat fetch lanes.
// - .parsing.test.js (#2063) — regex branches; there normalization flows only through parse
//   outputs. Here normalizeCategory is pinned ONLY through the getToolsByCategory filter —
//   the sole integration pin allowed in this file.
// - .test.js (#2065) — normalizeCategory direct-unit lane.
// - .major-feature.test.js (#2062) — 'Tool: ' row join into limits.
// Pins ACTUAL semantics, not book RAW: computeSkilledToolUsage returns the RAW uncovered count
// max(0, non-placeholder selections − Σ_cat min(selected_in_cat, limit)) — it is NOT capped at
// any feat pool size (validateTools compares it against skilledUsesAvailable; owned by #2061).
// Skilled disk rows: 2024 feats.json "any combination of three skills or tools" contributes a
// shared pool with ZERO category limits, so nothing Skilled-specific reaches this unit except via
// the limits Map shape; 5e feats.json Skilled has benefits: [] (verified) — that ruleset never
// even reaches here (getToolLimitsByCategory emits an empty Map → guard).
// Consumer check (#1916 lane): getToolsByCategory is LIVE (WizardStepTools.jsx + validateTools).
// computeSkilledToolUsage has NO production importer — skillValidation/skilled-pool.js carries a
// local duplicate of this exact math as computeSkilledToolUsageOnly. Dead-export flagged to the
// orchestrator (wire-up or delete); fully owned and pinned here meanwhile.
// Disk honesty: equipment.json is the tool-row home (#2061 fact) — the drills fs-read verbatim
// rows ('Flute', 'Dice Set', singular 'Musical Instrument'). The fabricated compact grid and the
// same-name-in-two-categories row are clearly-labeled defensive fixtures for branches disk data
// cannot discriminate (family precedent: parsing.test.js fabricated digit rows).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadEquipment: vi.fn(async () => []),
  fetchBackgroundData: vi.fn(),
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import * as dataLoader from '../ui/dataLoader.js';

import {
  getToolsByCategory,
  computeSkilledToolUsage,
} from './toolValidation.js';

const diskEquipment = JSON.parse(readFileSync('public/data/equipment.json', 'utf8'));
const diskTools = diskEquipment.filter(e => e.equipment_category === 'Tools');

// The wizard's four tool categories — what the real caller (validateTools) passes in.
const TOOL_CATEGORIES = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

describe('toolValidation - getToolsByCategory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Safe default: empty store unless a test loads its own rows.
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([]);
  });

  it.each([null, undefined, ''])('short-circuits %j to [] without touching the equipment store', async (input) => {
    expect(await getToolsByCategory(input)).toEqual([]);
    expect(dataLoader.loadEquipment).not.toHaveBeenCalled();
  });

  it('returns exactly the Tools rows of the normalized category — other categories and non-tool rows excluded', async () => {
    // Fabricated compact grid: an Armor row wearing a matching tool_category proves the
    // compound predicate (equipment_category AND tool_category) actually conjoins.
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Drum', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Dice Set', equipment_category: 'Tools', tool_category: 'Gaming Sets' },
      { name: 'Longsword', equipment_category: 'Weapons', tool_category: null },
      { name: 'Shield', equipment_category: 'Armor', tool_category: 'Musical Instrument' },
    ]);

    // Plural input → 'Musical Instrument' via normalizeCategory-through-filter
    // (the sole integration pin allowed here; .test.js #2065 owns the direct unit).
    const result = await getToolsByCategory('Musical Instruments');
    expect(result.map(t => t.name)).toEqual(['Flute', 'Drum']);

    // Normalization is not a wildcard: an exact-name category still filters precisely.
    expect((await getToolsByCategory('Gaming Sets')).map(t => t.name)).toEqual(['Dice Set']);
  });

  it('passes verbatim equipment.json rows through and plural==singular inputs on real data', async () => {
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue(diskEquipment);

    const plural = await getToolsByCategory('Musical Instruments');
    // Disk anchor: the untouched, whole Flute row survives the filter (disk-vs-fake drill).
    expect(plural).toContainEqual(diskTools.find(t => t.name === 'Flute'));
    // Same set through both spellings — normalization integrated at the filter, not just the map.
    expect(await getToolsByCategory('Musical Instrument')).toEqual(plural);
    // No leakage of other categories/rows into the result.
    expect(plural.every(t => t.equipment_category === 'Tools' && t.tool_category === 'Musical Instrument')).toBe(true);
  });
});

describe('toolValidation - computeSkilledToolUsage', () => {
  // Fabricated compact grid (membership via the _category adapter shape callers build from
  // equipment rows); disk names used verbatim where they exist ('Dice Set', not 'Dice').
  const allTools = [
    { name: "Alchemist's Supplies", _category: "Artisan's Tools" },
    { name: "Brewer's Supplies", _category: "Artisan's Tools" },
    { name: "Carver's Tools", _category: "Artisan's Tools" },
    { name: 'Dice Set', _category: 'Gaming Sets' },
    { name: 'Playing Card Set', _category: 'Gaming Sets' },
    { name: 'Flute', _category: 'Musical Instrument' },
  ];

  it('returns 0 without computing when there are no category limits or no selections', () => {
    const limits = new Map([["Artisan's Tools", 2]]);
    // Empty Map is the 5e path (5e Skilled disk row: benefits: [] — nothing to limit).
    for (const [l, sel] of [
      [null, ['Flute']],
      [new Map(), ['Flute']],
      [limits, null],
      [limits, undefined],
      [limits, []],
    ]) {
      expect(computeSkilledToolUsage(l, sel, allTools, TOOL_CATEGORIES)).toBe(0);
    }
  });

  it.each([
    ['exact fit: limits fully satisfied consume zero Skilled',
      new Map([["Artisan's Tools", 2], ['Gaming Sets', 1]]),
      ["Alchemist's Supplies", "Brewer's Supplies", 'Dice Set'],
      0],
    ['single-category over-pick: only the excess is uncovered (coverage clamps at the limit)',
      new Map([["Artisan's Tools", 1]]),
      ["Alchemist's Supplies", "Brewer's Supplies", "Carver's Tools"],
      2],
    ['category absent from the limits map is entirely uncovered',
      new Map([["Artisan's Tools", 2]]),
      ["Alchemist's Supplies", 'Flute'],
      1],
    ['selection missing from every category set is uncovered',
      new Map([["Artisan's Tools", 2]]),
      ['Nonexistent Tool'],
      1],
    ['placeholder excluded and limits satisfied -> 0',
      new Map([["Artisan's Tools", 1]]),
      ['2 from: Artisan\'s Tools', "Alchemist's Supplies"],
      0],
    ['placeholder excluded from the numerator too: only real over-pick counts',
      new Map([['Gaming Sets', 1]]),
      ['3 from: Gaming Sets', 'Dice Set', 'Playing Card Set'],
      1],
    ['disjoint pools with partial overflow in both + one unlimited category -> exact raw total',
      new Map([["Artisan's Tools", 1], ['Gaming Sets', 1]]),
      ["Alchemist's Supplies", "Brewer's Supplies", 'Dice Set', 'Playing Card Set', 'Flute'],
      3],
    ['DEFENSIVE (fabricated): same tool named in two category sets — coverage can exceed the ' +
      'single numerator and max(0, ...) clamps it, never negative',
      new Map([["Artisan's Tools", 1], ['Gaming Sets', 1]]),
      ['Dice Set'],
      0],
  ])('%s', (_label, limits, selectedTools, expected) => {
    expect(computeSkilledToolUsage(limits, selectedTools, allTools, TOOL_CATEGORIES)).toBe(expected);
  });

  it('disk-anchored exact math: unlimited over-pick of real instruments returns the raw uncovered count', () => {
    // Limits sourced from disk string Bard 2024 "Choose 3 Musical Instruments (see chapter 6)"
    // (parse pinned #2063, aggregation #2061). Skilled's 2024 disk row grants a pool of 3 with
    // NO category limits — pool-vs-usage comparison is validateTools' job (#2061). This unit
    // returns the RAW count, uncapped at the pool size: pins actual, not book.
    const diskInstruments = diskTools
      .filter(t => t.tool_category === 'Musical Instrument')
      .map(t => ({ name: t.name, _category: t.tool_category }));
    const allDiskTools = diskTools.map(t => ({ name: t.name, _category: t.tool_category }));
    const selected = [...diskInstruments.map(t => t.name), 'Dice Set'];

    expect(diskInstruments.map(t => t.name)).toContain('Flute'); // verbatim disk anchor
    // 11 selected − min(10 instruments, limit 3) = 8 — deliberately > any single feat's pool.
    expect(computeSkilledToolUsage(new Map([['Musical Instrument', 3]]), selected, allDiskTools, TOOL_CATEGORIES)).toBe(8);
  });
});
