// @maintained-by-ai 2026-11-27 improve-and-trim: defensive major join converted to 2-row it.each (mixed-category error leg + filter(Boolean) unknown-drop positive leg, previously unpinned), defensive lane result now full-shape toEqual per limits #1883 bar.
// toolValidation MAJOR-feature lane (#2062): Fighter majors "Tool: " row extraction in
// applyMajorFeatureGrants — the join where getMajorFeatureProficiencyChoices rows become
// category limits (via equipment.json tool→category lookup) and flow into validateTools.
// Cited, not re-pinned here (PAIR SEAM MAP from limits opener #2061):
// - majorFeatureChoices.test.js — upstream extraction contract: level gate (lv2→[], canonical
//   home; the old lv2 re-proof here was TRIMMED per the #2057 skill-side verdict — the level
//   filter lives entirely in getMajorFeatureProficiencyChoices, this service just consumes rows),
//   choose||1 default, empty-from filter, feature-only container (disk majors carry no
//   proficiency_choices at all), major-name mismatch guard.
// - toolValidation.limits.test.js — bg/class/feat limit aggregation and validateTools overflow/
//   Skilled math with NO Fighter majors; bg+major accumulation is delegated to this file.
// - toolValidation.parsing.test.js (#2063), .services.test.js (#2064), .test.js (#2065) —
//   regex parsing and getToolsByCategory lanes (computeSkilledToolUsage retired with its dead export), untouched here.
// Disk honesty: Fighter (Battle Master + Champion decoy), background Artisan, and equipment rows
// are verbatim public/data/{2024/classes,2024/backgrounds,equipment}.json. Disk sweep: Battle
// Master's Student of War (lv3, choose 1 from 17 Artisan's Tools + choose 1 skill) is the only
// tool-bearing major choice on disk — so the join's error branch and the filter(Boolean)
// unknown-name drop have ZERO disk source and share one clearly-fabricated defensive major
// with two it.each rows (family precedent: limits.test.js isAny lane). Results are asserted
// FULL-SHAPE per the limits #1883 bar. "Guild Artisan" is NOT a disk name (its real name is
// Artisan). The lowercase-index feat lookup (toolValidation.js:168) is never reached here:
// every form omits feats, so applyFeatGrants early-returns on the empty list (pinned in limits).
// The skill-row filter is pinned by the console.error spy on the real-data positive run: an
// unfiltered "Skill: " row would miss the tool→category map and trip the mixed-pool error.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadEquipment: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(async () => []),
}));

import {
  getToolLimitsByCategory,
  validateTools,
} from './toolValidation.js';

const diskClasses2024 = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));
const diskEquipment = JSON.parse(readFileSync('public/data/equipment.json', 'utf8'));
const diskBackgrounds2024 = JSON.parse(readFileSync('public/data/2024/backgrounds.json', 'utf8'));

const formData = (overrides) => ({
  rules: '2024',
  level: 18,
  class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
  background: 'Artisan',
  ...overrides,
});

describe('toolValidation - major feature (Student of War) tool grants', () => {
  let consoleError;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Safe defaults: disk rows by name (unknown → undefined, handled by `?.`).
    vi.mocked(dataLoader.fetchClassData).mockImplementation(async (name) =>
      diskClasses2024.find((c) => c.name === name));
    vi.mocked(dataLoader.fetchBackgroundData).mockImplementation(async (name) =>
      diskBackgrounds2024.find((b) => b.name === name));
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue(diskEquipment);
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each([
    {
      major: 'Battle Master',
      limit: 2, // bg Artisan "Choose one kind of Artisan's Tools" + Student of War choose 1
    },
    {
      major: 'Champion', // disk decoy: zero choice-bearing features — bg grant only
      limit: 1,
    },
  ])('maps the selected major\'s Tool: rows to exactly one category limit ($major → Artisan\'s Tools $limit)', async ({ major, limit }) => {
    const result = await getToolLimitsByCategory(formData({
      class: { name: 'Fighter', subclass: { name: major } },
    }));

    expect(result.categoryLimits).toEqual(new Map([
      ["Artisan's Tools", limit],
    ]));
    expect(result.preSelected).toEqual([]);
    expect(result.skilledUsesAvailable).toBe(0);
    // Real-data filter pin: the lv3 skill row (9 "Skill: " entries) must pass silently;
    // a broken "Tool: " filter would trip the mixed-pool console.error.
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'mixed two-category pool',
      fabricatedFrom: ["Tool: Alchemist's Supplies", 'Tool: Dice Set'],
      // Dice Set (Gaming Sets) + Alchemist's Supplies (Artisan's) — the model cannot express
      // the split pool: error logged, NOTHING granted (no partial limit).
      expectedLimits: new Map(),
      expectedError: "Major feature \"Fabricated Mixed Grant\" grants tools across multiple categories (Artisan's Tools, Gaming Sets); category-limit model cannot express a mixed pool.",
    },
    {
      label: 'unresolvable tool row dropped',
      fabricatedFrom: ["Tool: Alchemist's Supplies", 'Tool: Nonexistent Kit'],
      // Positive leg of the `filter(Boolean)` drop: an unknown name must NOT widen the pool
      // to length>1 — the remaining known tool grants its limit silently.
      expectedLimits: new Map([["Artisan's Tools", 1]]),
      expectedError: null,
    },
  ])('DEFENSIVE (no disk source): $label — join result $expectedLimits', async ({ fabricatedFrom, expectedLimits, expectedError }) => {
    // Fabricated feature — disk sweep confirms no 2024 major choice spans two tool categories
    // or names a tool missing from equipment.json (only Battle Master's Student of War carries
    // choices, all 17 Artisan's Tools). Container name stays 'Battle Master' so the
    // selected-major resolution still lands.
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      name: 'Fighter',
      majors: [{
        name: 'Battle Master',
        features: [{
          name: 'Fabricated Mixed Grant',
          level: 3,
          proficiency_choices: [{ choose: 1, from: fabricatedFrom }],
        }],
      }],
    });

    const result = await getToolLimitsByCategory(formData({ background: undefined }));

    expect(result).toEqual({
      categoryLimits: expectedLimits,
      preSelected: [],
      skilledUsesAvailable: 0,
    });
    if (expectedError === null) {
      expect(consoleError).not.toHaveBeenCalled();
    } else {
      expect(consoleError).toHaveBeenCalledWith(expectedError);
    }
  });

  it('validateTools accepts exactly the major-granted allowance and warns with exact counts one over', async () => {
    // No background here: the single Artisan's Tools allowance comes from Student of War alone.
    const formDataNoBg = (tools) => ({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
      toolProficiencies: tools,
    });

    expect(await validateTools(formDataNoBg(["Smith's Tools"]))).toEqual([]);

    expect(await validateTools(formDataNoBg(["Smith's Tools", "Alchemist's Supplies"]))).toEqual([{
      type: 'warning',
      message: "You have selected 2 from Artisan's Tools, but your class/background/feats only grant 1 proficiency/ies from Artisan's Tools.",
    }]);
  });
});
