// @maintained-by-ai
// toolValidation LIMITS lane (pair opener #2061): getToolLimitsByCategory aggregation of
// background/class/feat tool grants + validateTools category-overflow & Skilled-pool warnings.
// PAIR SEAM MAP (siblings cited, never re-pinned here):
// - toolValidation.parsing.test.js — regex parsing of parseToolChoiceString/parseFeatToolProficiency
//   branches. Here the same strings flow through the fetch→limit aggregation lanes only.
// - toolValidation.major-feature.test.js — Fighter Student of War major-feature tool grants and the
//   bg+major accumulation; no Fighter majors are used here. Major-level proficiency_choices are
//   ignored (feature-only contract, majorFeatureChoices.test.js) — tool-side analog cited there, not here.
// - toolValidation.services.test.js — getToolsByCategory units (computeSkilledToolUsage lane retired with its dead export), untouched here.
// - skillValidation.major-feature.test.js — idiom source: disk-verbatim fixtures, zero fabricated data.
// Disk honesty: fixtures are verbatim public/data/2024/{backgrounds,classes,feats}.json +
// public/data/equipment.json rows (Thieves' Tools, Navigator's Tools, Dice Set, Flute, …;
// there is no tools.json — tool rows live in equipment.json). One documented exception: the
// non-Skilled isAny feat branch has ZERO disk source (only Skilled matches on disk), pinned as a
// defensive lane with a clearly-fabricated feat. rules-validation.json: no tool entries in either
// ruleset (verified) — limits derive solely from bg/class/feat/major-feature grants.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadEquipment: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import {
  getToolLimitsByCategory,
  validateTools,
} from './toolValidation.js';

const diskBackgrounds = JSON.parse(readFileSync('public/data/2024/backgrounds.json', 'utf8'));
const diskClasses = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));
const diskFeats = JSON.parse(readFileSync('public/data/2024/feats.json', 'utf8'));
const diskEquipment = JSON.parse(readFileSync('public/data/equipment.json', 'utf8'));

describe('toolValidation - getToolLimitsByCategory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Safe defaults: every fetch resolves real disk rows (unknown names → undefined, handled by `?.`).
    vi.mocked(dataLoader.fetchBackgroundData).mockImplementation(async (name) =>
      diskBackgrounds.find((b) => b.name === name));
    vi.mocked(dataLoader.fetchClassData).mockImplementation(async (name) =>
      diskClasses.find((c) => c.name === name));
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(diskFeats);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue(diskEquipment);
  });

  it('returns nothing for non-2024 rulesets and for 2024 forms with no resolvable sources', async () => {
    for (const formData of [
      { rules: '5e', background: 'Guard', class: { name: 'Bard' }, feats: ['Skilled'] },
      {},
      { rules: '2024' },
      { rules: '2024', background: 'Unknown', class: { name: 'Unknown' }, feats: ['NonExistentFeat'] },
    ]) {
      const result = await getToolLimitsByCategory(formData);
      expect(result.categoryLimits.size).toBe(0);
      expect(result.preSelected).toEqual([]);
      expect(result.skilledUsesAvailable).toBe(0);
    }
  });

  it('turns background and class choice strings into category allowances', async () => {
    // Disk verbatim: Guard "Choose one kind of Gaming Set", Bard "Choose 3 Musical Instruments (see chapter 6)".
    const result = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Guard',
      class: { name: 'Bard' },
    });

    expect(result.categoryLimits.get('Gaming Sets')).toBe(1);
    expect(result.categoryLimits.get('Musical Instrument')).toBe(3);
    expect(result.preSelected).toEqual([]);
    expect(result.categoryLimits.has("Artisan's Tools")).toBe(false);
  });

  it('routes fixed (non-choice) background and class tools to preSelected, not to limits', async () => {
    // Disk verbatim: Criminal "Thieves' Tools", Druid "Herbalism Kit".
    const result = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Criminal',
      class: { name: 'Druid' },
    });

    expect(result.preSelected).toContain("Thieves' Tools");
    expect(result.preSelected).toContain('Herbalism Kit');
    expect(result.categoryLimits.size).toBe(0);
  });

  it('aggregates background + class + feat grants across categories with the Skilled pool tracked separately', async () => {
    // Artisan kind-choice (+1 Artisan) + Monk or-choice (+1 Artisan, +1 Musical)
    // + Musician feat (+3 Musical) + Skilled feat (shared pool of 3, no category limits).
    const result = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Artisan',
      class: { name: 'Monk' },
      feats: ['Musician', 'Skilled'],
    });

    expect(result.categoryLimits.get("Artisan's Tools")).toBe(2);
    expect(result.categoryLimits.get('Musical Instrument')).toBe(4);
    expect(result.categoryLimits.has('Gaming Sets')).toBe(false);
    expect(result.skilledUsesAvailable).toBe(3);
    expect(result.preSelected).toEqual([]);
  });

  it('auto-selects Cook\'s Utensils for Chef without inventing a category limit', async () => {
    // Disk Chef benefit is a fixed tool ("...with Cook's Utensils if you don't already have it") —
    // guards that the Chef short-circuit runs before the generic feat parser could misread it.
    const result = await getToolLimitsByCategory({
      rules: '2024',
      feats: ['Chef'],
    });

    expect(result.preSelected).toEqual(["Cook's Utensils"]);
    expect(result.categoryLimits.size).toBe(0);
    expect(result.skilledUsesAvailable).toBe(0);
  });

  it('spreads non-Skilled isAny feats over every tool category and skips unmatched or non-tool feats', async () => {
    // DEFENSIVE lane: no disk feat besides Skilled matches "skills or tools" (verified scan of
    // public/data/2024/feats.json), so the fabricated feat below is the only way to exercise the branch.
    // Tough (passive-only) and an unknown feat name must contribute nothing.
    const fabricatedAnyFeat = {
      name: 'Fabricated Any-Tool Feat',
      benefits: [
        { type: 'proficiency', description: 'You gain proficiency in any combination of two skills or tools of your choice' },
      ],
    };
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([...diskFeats, fabricatedAnyFeat]);

    const result = await getToolLimitsByCategory({
      rules: '2024',
      feats: ['Fabricated Any-Tool Feat', 'Tough', 'NonExistentFeat'],
    });

    expect(result.categoryLimits).toEqual(new Map([
      ["Artisan's Tools", 2],
      ['Gaming Sets', 2],
      ['Musical Instrument', 2],
      ['Other Tools', 2],
    ]));
    expect(result.skilledUsesAvailable).toBe(0);
    expect(result.preSelected).toEqual([]);
  });
});

describe('toolValidation - validateTools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLoader.fetchBackgroundData).mockImplementation(async (name) =>
      diskBackgrounds.find((b) => b.name === name));
    vi.mocked(dataLoader.fetchClassData).mockImplementation(async (name) =>
      diskClasses.find((c) => c.name === name));
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(diskFeats);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue(diskEquipment);
  });

  it('returns no warnings for non-2024 rulesets and when nothing is selected', async () => {
    expect(await validateTools({ rules: '5e', toolProficiencies: ['Flute', "Thieves' Tools"] })).toEqual([]);
    expect(await validateTools({})).toEqual([]);
    expect(await validateTools({ rules: '2024' })).toEqual([]);
    expect(await validateTools({ rules: '2024', toolProficiencies: [] })).toEqual([]);
  });

  it('warns once with exact counts when Gaming Sets selections exceed the Guard allowance, and stays silent at the boundary', async () => {
    const warnings = await validateTools({
      rules: '2024',
      background: 'Guard',
      toolProficiencies: ['Dice Set', 'Playing Card Set'],
    });

    expect(warnings).toEqual([{
      type: 'warning',
      message: "You have selected 2 from Gaming Sets, but your class/background/feats only grant 1 proficiency/ies from Gaming Sets.",
    }]);

    expect(await validateTools({
      rules: '2024',
      background: 'Guard',
      toolProficiencies: ['Dice Set'],
    })).toEqual([]);
  });

  it('lists the offending tool names per category when no allowance exists for any of them', async () => {
    const warnings = await validateTools({
      rules: '2024',
      toolProficiencies: ['Flute', 'Drum', "Thieves' Tools"],
    });

    expect(warnings).toEqual([
      {
        type: 'warning',
        message: "You have selected 2 from Musical Instrument (Flute, Drum), but your class/background/feats do not grant any proficiencies from Musical Instrument.",
      },
      {
        type: 'warning',
        message: "You have selected 1 from Other Tools (Thieves' Tools), but your class/background/feats do not grant any proficiencies from Other Tools.",
      },
    ]);
  });

  it('lets the Skilled pool absorb overflow across limited and unlimited categories, then warns when the pool runs dry', async () => {
    // Bard grants 3 Musical; Skilled pool of 3 covers +4 more Musical but not the extra tool on top.
    const withinPool = await validateTools({
      rules: '2024',
      class: { name: 'Bard' },
      feats: ['Skilled'],
      toolProficiencies: ['Flute', 'Lute', 'Lyre', "Navigator's Tools"],
    });
    expect(withinPool).toEqual([]);

    const overPool = await validateTools({
      rules: '2024',
      class: { name: 'Bard' },
      feats: ['Skilled'],
      toolProficiencies: ['Flute', 'Lute', 'Lyre', 'Drum', 'Dulcimer', 'Bagpipes', 'Horn', "Navigator's Tools"],
    });
    expect(overPool).toEqual([{
      type: 'warning',
      message: "You have selected 7 from Musical Instrument, but your class/background/feats only grant 3 proficiency/ies from Musical Instrument.",
    }]);
  });

  it('ignores pre-selected and placeholder entries, but still warns when real selections land in an ungranted category', async () => {
    // Criminal pre-selects "Thieves' Tools" (disk verbatim): selecting it, or a wizard placeholder,
    // must not warn — but a genuine Flute pick still triggers the zero-allowance warning.
    const clean = await validateTools({
      rules: '2024',
      background: 'Criminal',
      toolProficiencies: ["Thieves' Tools", '3 from: Flute'],
    });
    expect(clean).toEqual([]);

    const withOver = await validateTools({
      rules: '2024',
      background: 'Criminal',
      toolProficiencies: ["Thieves' Tools", '3 from: Flute', 'Flute'],
    });
    expect(withOver).toEqual([{
      type: 'warning',
      message: "You have selected 1 from Musical Instrument (Flute), but your class/background/feats do not grant any proficiencies from Musical Instrument.",
    }]);
  });
});
