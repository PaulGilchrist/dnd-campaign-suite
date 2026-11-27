// @maintained-by-ai 2026-11-27 improve-and-trim: short-circuit null leg deleted (indistinguishable undefined twin); fabricated-grid + disk legs raised to full-shape whole-row toEqual; disk leg gains exact 10-row Musical Instrument census (old one-way every() check could not fail on omissions); added rejecting-mock propagates-not-swallowed pin; stale header claims corrected (quickBuildService consumer, removed same-name-row fiction, sibling seam re-verified).
// toolValidation SERVICES lane (#2064): getToolsByCategory units — the dataLoader-backed
// category filter (short-circuit guard, compound predicate, verbatim pass-through, error face).
// SEAM MAP (siblings cited, never re-pinned here; all three re-swept 2026-11-27):
// - .limits.test.js (#2061) — getToolLimitsByCategory aggregation, Skilled pool vs usage in
//   validateTools, bg/class/feat fetch lanes, lowercase-index feat lookup (:168 sole pin).
// - .parsing.test.js (#2063) — regex branches + full normalization table through parse outputs
//   (unknown 'Gaming Tool' verbatim pass-through owned THERE — not restated here). Here
//   normalizeCategory is pinned ONLY through the getToolsByCategory filter (plural→singular):
//   the sole integration pin allowed in this file.
// - .test.js (#2065) — normalizeCategory direct-unit lane.
// - .major-feature.test.js (#2062) — Fighter majors 'Tool: ' row join into limits.
// RETIRED (#dead-export resolution): the computeSkilledToolUsage describe died with its
// export per #2064 REC ("pin dies with the export") — re-verified against current bytes:
// toolValidation.js exports no computeSkilledToolUsage; the live Skilled-tool math is
// skillValidation/skilled-pool.js computeSkilledToolUsageOnly (pinned in the skillValidation lanes).
// Consumer check (re-verified vs disk): getToolsByCategory is LIVE — WizardStepTools.jsx:61,
// quickBuildService.js:186, and validateTools (toolValidation.js:266).
// Disk honesty: equipment.json is the tool-row home — disk legs fs-read verbatim rows. The only
// fabricated fixture is the compact compound-predicate grid (an Armor row wearing tool_category):
// disk has ZERO non-Tools rows carrying tool_category, so disk data cannot discriminate that
// branch (family precedent: parsing.test.js fabricated digit rows).
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
} from './toolValidation.js';

const diskEquipment = JSON.parse(readFileSync('public/data/equipment.json', 'utf8'));
const diskTools = diskEquipment.filter(e => e.equipment_category === 'Tools');

describe('toolValidation - getToolsByCategory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Safe default: empty store unless a test loads its own rows.
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([]);
  });

  // null dropped: same `!category` guard, outcome indistinguishable from undefined (cosmetic twin).
  it.each([[undefined], ['']])('short-circuits %j to [] without touching the equipment store', async (input) => {
    expect(await getToolsByCategory(input)).toEqual([]);
    expect(dataLoader.loadEquipment).not.toHaveBeenCalled();
  });

  it('conjoins equipment_category AND tool_category — whole rows pass, every other row excluded', async () => {
    // Fabricated compact grid: an Armor row wearing a matching tool_category proves the
    // compound predicate (equipment_category AND tool_category) actually conjoins — disk
    // has zero non-Tools rows carrying tool_category, so disk cannot discriminate this.
    const flute = { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' };
    const drum = { name: 'Drum', equipment_category: 'Tools', tool_category: 'Musical Instrument' };
    const diceSet = { name: 'Dice Set', equipment_category: 'Tools', tool_category: 'Gaming Sets' };
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      flute,
      drum,
      diceSet,
      { name: 'Longsword', equipment_category: 'Weapons', tool_category: null },
      { name: 'Shield', equipment_category: 'Armor', tool_category: 'Musical Instrument' },
    ]);

    // Plural input → 'Musical Instrument' via normalizeCategory-through-filter
    // (the sole integration pin allowed here; .test.js #2065 owns the direct unit).
    // Full-shape: exact set, order, and whole unmutated rows.
    expect(await getToolsByCategory('Musical Instruments')).toEqual([flute, drum]);

    // Normalization is not a wildcard: an exact-name category still filters precisely
    // (requesting Gaming Sets must not leak the Musical Instrument rows).
    expect(await getToolsByCategory('Gaming Sets')).toEqual([diceSet]);
  });

  it('returns exactly the disk Musical Instrument rows, verbatim, plural==singular', async () => {
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue(diskEquipment);

    const plural = await getToolsByCategory('Musical Instruments');
    // Disk census (equipment.json order): exact set + order, so both omission AND
    // cross-category leakage fail (replaces the one-way every() check that passed on omissions).
    expect(plural.map(t => t.name)).toEqual([
      'Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Horn', 'Lute', 'Lyre', 'Pan flute', 'Shawm', 'Viol',
    ]);
    // Disk anchor: the untouched, whole Flute row survives the filter (disk-vs-fake drill).
    expect(plural).toContainEqual(diskTools.find(t => t.name === 'Flute'));
    // Same result through both spellings — normalization integrated at the filter, not just the map.
    expect(await getToolsByCategory('Musical Instrument')).toEqual(plural);
  });

  it('does not swallow a failing equipment load', async () => {
    // throw-vs-return exact: the service has no try/catch here — rejection propagates.
    vi.mocked(dataLoader.loadEquipment).mockRejectedValue(new Error('equipment fetch failed'));
    await expect(getToolsByCategory('Musical Instrument')).rejects.toThrow('equipment fetch failed');
  });
});

