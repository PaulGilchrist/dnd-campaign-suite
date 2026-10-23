// @maintained-by-ai
// toolValidation SERVICES lane (#2064, trimmed pass #398+): getToolsByCategory units —
// the Skilled-usage computation deferred here by the limits opener (#2061).
// SEAM MAP (siblings cited, never re-pinned here):
// - .limits.test.js (#2061) — getToolLimitsByCategory aggregation, "Skilled pool tracked
//   separately" (pool-vs-usage comparison in validateTools), bg/class/feat fetch lanes.
// - .parsing.test.js (#2063) — regex branches; there normalization flows only through parse
//   outputs. Here normalizeCategory is pinned ONLY through the getToolsByCategory filter —
//   the sole integration pin allowed in this file.
// - .test.js (#2065) — normalizeCategory direct-unit lane.
// - .major-feature.test.js (#2062) — 'Tool: ' row join into limits.
// RETIRED (#dead-export resolution): the computeSkilledToolUsage describe died with its
// export per #2064 REC ("pin dies with the export") — it had ZERO production importers;
// the live Skilled-tool math is skillValidation/skilled-pool.js computeSkilledToolUsageOnly
// (async, formData-driven, limits from bg+class only; pinned in the skillValidation lanes).
// Consumer check (#1916 lane): getToolsByCategory is LIVE (WizardStepTools.jsx + validateTools).
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
} from './toolValidation.js';

const diskEquipment = JSON.parse(readFileSync('public/data/equipment.json', 'utf8'));
const diskTools = diskEquipment.filter(e => e.equipment_category === 'Tools');

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

