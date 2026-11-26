// @maintained-by-ai 2026-11-19
// Regression for bug-alert-missing-origin-type-quickbuild-self-warns (2026-11-19):
// the 2024 quick-build draft pre-selects the background-granted feat "Alert"
// (Guard/Criminal in backgrounds.json), and the feats-step Origin validator used
// to call that same draft illegal because public/data/2024/feats.json typed Alert
// with no "Origin Feat" type — and the Human Versatile choice list omitted it too.
// These pins ride the REAL disk data, not fixtures.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../ui/dataLoader.js', async () => {
  const { readFileSync } = await import('node:fs');
  const raw = (p) => JSON.parse(readFileSync(p, 'utf8'));
  return {
    loadValidationRules: vi.fn(async (version) => raw(`public/data/${version === '2024' ? '2024/' : ''}rules-validation.json`)[version]),
    fetchBackgroundData: vi.fn(async (name, version) =>
      raw(version === '2024' ? 'public/data/2024/backgrounds.json' : 'public/data/backgrounds.json')
        .find((b) => b.name === name) || null),
    fetchRaceData: vi.fn(async (name, version) =>
      raw(version === '2024' ? 'public/data/2024/races.json' : 'public/data/races.json')
        .find((r) => r.name === name) || null),
  };
});

import { readFileSync } from 'node:fs';
import {
  validateFeats,
  getFeatTypeInfo,
  getPreSelectedFeats,
  normalizeBackgroundFeatName,
} from './featValidation.js';

const raw = (p) => JSON.parse(readFileSync(p, 'utf8'));
const FEATS_2024 = raw('public/data/2024/feats.json');
const BACKGROUNDS_2024 = raw('public/data/2024/backgrounds.json');
const RACES_2024 = raw('public/data/2024/races.json');

const ORIGIN_NAMES_ON_DISK = FEATS_2024
  .filter((f) => f.type === 'Origin Feat')
  .map((f) => f.name)
  .sort();

// The 2024 PHB Origin feats — the full legal set (feats.json must not drift from it)
const PHB_2024_ORIGIN_FEATS = [
  'Alert', 'Crafter', 'Fey Touched', 'Healer', 'Lucky', 'Magic Initiate',
  'Musician', 'Savage Attacker', 'Shadow Touched', 'Skilled', 'Tavern Brawler', 'Tough',
];

// Verbatim shape of the 2024 Quick-build draft on the Feats step
// (quickBuildService.buildFeatsAndResistances -> getPreSelectedFeats, Human + Guard)
const QUICK_BUILD_DRAFT = {
  rules: '2024',
  level: 1,
  race: { name: 'Human' },
  background: 'Guard',
  class: { name: 'Fighter' },
  feats: ['Alert'],
};

describe('2024 Origin-feat disk data (Alert tagging)', () => {
  it('types Alert as an Origin feat (getFeatTypeInfo no longer reads it as General)', () => {
    expect(getFeatTypeInfo('Alert', FEATS_2024)).toEqual({
      type: 'Origin Feat',
      isOrigin: true,
      isEpicBoon: false,
    });
  });

  it('carries exactly the 2024 PHB Origin feat set on disk', () => {
    expect(ORIGIN_NAMES_ON_DISK).toEqual([...PHB_2024_ORIGIN_FEATS].sort());
  });

  it.each(
    BACKGROUNDS_2024
      .filter((b) => b.feat)
      .map((b) => [b.name, b.feat])
  )('background %s grants an Origin-tagged feat (%s)', (_bgName, rawFeat) => {
    const featName = normalizeBackgroundFeatName(rawFeat);
    const row = FEATS_2024.find((f) => f.name === featName);
    expect(row, `${featName} must exist in 2024 feats.json`).toBeTruthy();
    expect(row.type).toBe('Origin Feat');
  });

  it('Human Versatile choice list agrees with the disk Origin-tagged feats', () => {
    const versatile = RACES_2024
      .find((r) => r.name === 'Human')
      .traits.find((t) => t.name === 'Versatile');
    expect([...versatile.proficiency_choices.from].sort()).toEqual(ORIGIN_NAMES_ON_DISK);
  });
});

describe('quick-build Alert draft passes its own Origin validator', () => {
  it('pre-selects Alert from the Guard background', async () => {
    expect(await getPreSelectedFeats(QUICK_BUILD_DRAFT)).toEqual(['Alert']);
  });

  it('validateFeats returns ZERO warnings for the machine-generated draft', async () => {
    const warnings = await validateFeats(QUICK_BUILD_DRAFT, FEATS_2024);
    expect(warnings).toEqual([]);
  });

  it('still warns when only a non-Origin feat is selected', async () => {
    const warnings = await validateFeats({ ...QUICK_BUILD_DRAFT, feats: ['Chef'] }, FEATS_2024);
    expect(warnings.map((w) => w.message)).toEqual([
      "Level 1 2024 characters should select an Origin feat. Your selected feats don't include an Origin feat.",
      'Some selected feats are not Origin feats. Level 1 2024 characters typically take an Origin feat.',
    ]);
  });

  it('still flags a non-Origin extra pick alongside the pre-selected Alert', async () => {
    const warnings = await validateFeats({ ...QUICK_BUILD_DRAFT, feats: ['Alert', 'Chef'] }, FEATS_2024);
    expect(warnings.map((w) => w.message)).toEqual([
      'Some selected feats are not Origin feats. Level 1 2024 characters typically take an Origin feat.',
    ]);
  });
});
