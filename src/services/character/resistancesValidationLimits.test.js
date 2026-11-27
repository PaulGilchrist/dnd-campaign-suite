// @maintained-by-ai 2026-11-27
// QUARTET lane (see resistancesValidation.test.js header seam map): race-side resistance extraction
// (5e + 2024) via getResistanceLimits — the CANONICAL home for race extraction (Info lane cites
// this file per #2049) — plus the race-switch subrace seam ({ name: '' } must never reach the
// extractors as an object; bug-wizard-race-switch-subracename-toLowerCase-crash). Class-side immunity extraction + level gates live in
// resistancesValidationImmunities.test.js; message contract in resistancesValidation.test.js.
// Liveness verdict (#2050, verified): getResistanceLimits has ZERO direct importers outside the
// module, but it IS live production code through getPreSelectedResistances + validateResistances
// (src/hooks/wizard/useWizardResistances.js preSelect + validateFn), so the extraction battery
// stays here — API-contract pins are compact; no wrapper re-proofing (#1916 not applicable).
// Disk anchors verified verbatim against public/data/races.json + public/data/2024/races.json:
//   5e trait descriptions are STRINGS on disk ("You have resistance to fire damage." /
//   "…resistance against poison damage."); the 5e 'Damage Resistance' base-trait branch in the
//   source is an empty no-op — pinned to extract nothing via the verbatim disk-anchor row below
//   (a standalone no-subrace row is masked by it: the anchor carries the same base prose).
//   Array-`description` tolerance in extract5eRaceResistances is NOT re-proven here: disk never
//   stores arrays (no-legacy policy) and the wrapper pin in resistancesValidation.test.js
//   (array-form Tiefling fixture → preSelected ['Fire']) already exercises the branch — the
//   tolerance itself is a #1916 legacy-shape candidate for the source owner.
//   FLAG: disk stores subrace ancestry types ONLY in a structured damage_resistance field
//   ('Fire'/'Poison') — the prose extractors never read it, so verbatim Dragonborn/Tiefling
//   subrace data yields NO resistance today (pinned below). Any 'resistance to …' prose in a
//   fixture below is SYNTHETIC (marked inline) and exercises the extractor path that future
//   prose-based data would hit.
// No spies (module-level vi.fn mocks only) → no restoreAllMocks needed (#2020); no timers.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
}));

import { getResistanceLimits } from './resistancesValidation.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const emptyClassData = () => ({ class_levels: [] });

const baseArgs = (overrides = {}) => ({
  rules: '5e',
  race: { name: 'Human' },
  class: { name: 'Wizard' },
  level: 1,
  ...overrides,
});

function mockRace(raceData) {
  vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(raceData);
  vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());
}

// Race lane: assert the exact resistance set; class side must contribute nothing
// (emptyClassData keeps immunities [] so any immunity here is a lane bleed / bug).
function expectRaceResistances(result, expected) {
  expect(result.resistances.sort()).toEqual([...expected].sort());
  expect(result.immunities).toEqual([]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getResistanceLimits — API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      rules: '5e',
      details: 'In 5e rules, resistances come from your race (Human) and class (Wizard) features',
    },
    {
      rules: '2024',
      details: 'In 2024 rules, resistances and immunities come from your race (Human) and class (Wizard) features',
    },
  ])('returns { resistances, immunities, details } with exact $rules details string', async ({ rules, details }) => {
    mockRace({ name: 'Human', traits: [] });

    const result = await getResistanceLimits(baseArgs({ rules }));

    expect(result).toEqual({ resistances: [], immunities: [], details });
    // Ordered census: exactly one fetch per side, ruleset-routed, nothing extra.
    expect(dataLoader.fetchRaceData.mock.calls).toEqual([['Human', rules]]);
    expect(dataLoader.fetchClassData.mock.calls).toEqual([['Wizard', rules]]);
  });

  it('defaults missing level to 1 (level-1 immunity included, level-5 excluded)', async () => {
    // The ONLY pin for getResistanceLimits' `formData.level || 1` input normalization —
    // the Immunities lane gates with an explicit level only.
    // SYNTHETIC class prose (disk sweep: zero real class damage immunities — Immunities lane).
    mockRace({ name: 'Human', traits: [] });
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [
        { level: 1, features: [{ name: 'Early Immunity', description: 'You gain Immunity to Fire damage.' }] },
        { level: 5, features: [{ name: 'Late Immunity', description: 'You gain Immunity to Cold damage.' }] },
      ],
    });

    const result = await getResistanceLimits({
      rules: '5e',
      race: { name: 'Human' },
      class: { name: 'Fighter' },
    });

    expect(result.resistances).toEqual([]);
    expect(result.immunities).toEqual(['Fire']);
  });

  it('skips dataLoader entirely when race and class names are absent', async () => {
    const result = await getResistanceLimits({ rules: '5e' });

    expect(result.resistances).toEqual([]);
    expect(result.immunities).toEqual([]);
    expect(dataLoader.fetchRaceData).not.toHaveBeenCalled();
    expect(dataLoader.fetchClassData).not.toHaveBeenCalled();
  });
});

describe('getResistanceLimits — 5e race extraction (canonical)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'null raceData tolerated',
      race: { name: 'Tiefling' },
      raceData: null,
      expected: [],
    },
    {
      name: 'Hellish Resistance — disk verbatim (string description)',
      race: { name: 'Tiefling' },
      raceData: {
        name: 'Tiefling',
        traits: [{ name: 'Hellish Resistance', description: 'You have resistance to fire damage.' }],
      },
      expected: ['Fire'],
    },
    {
      name: 'Dwarven Resilience — disk verbatim (advantage + resistance in one sentence)',
      race: { name: 'Dwarf' },
      raceData: {
        name: 'Dwarf',
        traits: [{ name: 'Dwarven Resilience', description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.' }],
      },
      expected: ['Poison'],
    },
    {
      name: 'subrace racial_traits — Stout Halfling Scout Resilience disk verbatim',
      race: { name: 'Halfling', subrace: { name: 'Stout Halfling' } },
      raceData: {
        name: 'Halfling',
        traits: [],
        subraces: [{
          name: 'Stout Halfling',
          description: "As a stout halfling, you're hardier than average and have some resistance to poison.",
          racial_traits: [{ name: 'Scout Resilience', description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.' }],
        }],
      },
      expected: ['Poison'],
    },
    {
      name: 'subrace racial_traits generic "resistance to X damage" prose (SYNTHETIC; disk keeps type in unread damage_resistance)',
      race: { name: 'Dragonborn', subrace: { name: 'Gold Dragonborn' } },
      raceData: {
        name: 'Dragonborn',
        traits: [],
        subraces: [{
          name: 'Gold Dragonborn',
          racial_traits: [{ name: 'Damage Resistance', description: 'You have resistance to fire damage.' }],
        }],
      },
      expected: ['Fire'],
    },
    {
      name: 'Dragonborn ancestry from subrace description; decoy subrace ignored (SYNTHETIC prose)',
      race: { name: 'Dragonborn', subrace: { name: 'Gold Dragonborn' } },
      raceData: {
        name: 'Dragonborn',
        traits: [],
        subraces: [
          { name: 'Gold Dragonborn', description: 'You have resistance to fire damage.' },
          { name: 'Silver Dragonborn', description: 'You have resistance to cold damage.' },
        ],
      },
      expected: ['Fire'],
    },
    {
      name: 'disk anchor: Gold Dragonborn verbatim subrace data extracts nothing (structured damage_resistance is never read; same row re-proves the base-trait "Damage Resistance" no-op — its prose would match a generic-regex regression)',
      race: { name: 'Dragonborn', subrace: { name: 'Gold Dragonborn' } },
      raceData: {
        name: 'Dragonborn',
        traits: [{ name: 'Damage Resistance', description: 'You have resistance to the damage type associated with your draconic ancestry.' }],
        subraces: [{
          name: 'Gold Dragonborn',
          description: 'Gold Dragonborn embody nobility and inner fire, inheriting a powerful flame breath and the disciplined, honorable nature of gold dragons.',
          damage_resistance: 'Fire',
        }],
      },
      expected: [],
    },
  ])('$name', async ({ race, raceData, expected }) => {
    mockRace(raceData);

    const result = await getResistanceLimits(baseArgs({ race }));

    expectRaceResistances(result, expected);
  });
});

describe('getResistanceLimits — race-switch seam (subrace never resolves as a non-string)', () => {
  // Regression (bug-wizard-race-switch-subracename-toLowerCase-crash): the wizard's
  // canonical shape is race.subrace = { name: string } —WizardStepRace resets it to
  // { name: '' } the instant you switch races. The old dual-read
  // `subrace?.name || subrace` handed the raw object to extract5eRaceResistances,
  // whose `sr.index === subraceName.toLowerCase()` threw mid-Array.find and silently
  // killed the whole 5e limits collector for that recompute (live: Human → Dwarf).
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Disk anchor public/data/races.json: Dwarf traits carry the poison prose verbatim;
  // subraces carry name + index ('hill-dwarf'), racial_traits never repeat a resistance.
  const dwarfRaceData = () => ({
    name: 'Dwarf',
    traits: [{ name: 'Dwarven Resilience', description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.' }],
    subraces: [
      { name: 'Hill Dwarf', index: 'hill-dwarf', racial_traits: [{ name: 'Dwarven Toughness', description: 'Your hit point maximum increases by 1.' }] },
      { name: 'Mountain Dwarf', index: 'mountain-dwarf', racial_traits: [] },
    ],
  });

  it('5e: a fresh switch to a subrace-bearing race (subrace { name: "" }) resolves and still collects the base grant', async () => {
    mockRace(dwarfRaceData());

    const result = await getResistanceLimits(baseArgs({ race: { name: 'Dwarf', subrace: { name: '' } } }));

    expectRaceResistances(result, ['Poison']);
    // A settled subrace name ({ name: 'Hill Dwarf' }, racial_traits grant nothing) is the
    // Stout-Halfling-resolved-subrace shape minus the grant — same completed path, no re-proof.
  });

  // Disk anchor public/data/2024/races.json: 2024 Dwarf trait prose is capital-R
  // 'You have Resistance to Poison damage.' — the 2024 extractor matches that form.
  // This twin is ALSO the canonical 2024 Dwarven Resilience extraction pin (the weaker
  // subrace-less table row was consolidated into it).
  const dwarfRaceData2024 = () => ({
    name: 'Dwarf',
    traits: [{ name: 'Dwarven Resilience', description: 'You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition.' }],
    subraces: [{ name: 'Hill Dwarf', traits: [] }],
  });

  it('2024 twin: the same fresh-switch shape resolves without throwing', async () => {
    mockRace(dwarfRaceData2024());

    const result = await getResistanceLimits(baseArgs({ rules: '2024', race: { name: 'Dwarf', subrace: { name: '' } } }));

    expectRaceResistances(result, ['Poison']);
  });
});

describe('getResistanceLimits — 2024 race extraction (canonical, #2049)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'null raceData with traits:null tolerated',
      race: { name: 'Aasimar' },
      raceData: { name: 'Aasimar', traits: null },
      expected: [],
    },
    {
      name: 'Celestial Resistance — disk verbatim, exact two-type set',
      race: { name: 'Aasimar' },
      raceData: {
        name: 'Aasimar',
        traits: [{ name: 'Celestial Resistance', description: 'You have Resistance to Necrotic damage and Radiant damage.' }],
      },
      expected: ['Necrotic', 'Radiant'],
    },
    {
      // Canonical 2024 Dwarven Resilience prose lives in the seam lane's 2024 twin row.
      name: 'subrace traits prose (SYNTHETIC — disk Abyssal Tiefling carries only unread damage_resistance)',
      race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } },
      raceData: {
        name: 'Tiefling',
        traits: [],
        subraces: [{
          name: 'Abyssal Tiefling',
          traits: [{ description: 'You have Resistance to Poison damage.' }],
        }],
      },
      expected: ['Poison'],
    },
    {
      name: 'Dragonborn ancestry from subrace description; decoy subrace ignored (SYNTHETIC prose)',
      race: { name: 'Dragonborn', subrace: { name: 'Gold Dragonborn' } },
      raceData: {
        name: 'Dragonborn',
        traits: [],
        subraces: [
          { name: 'Gold Dragonborn', description: 'You have Resistance to Fire damage.' },
          { name: 'Silver Dragonborn', description: 'You have Resistance to Cold damage.' },
        ],
      },
      expected: ['Fire'],
    },
    {
      name: 'subrace-description path is Dragonborn-only — Tiefling desc prose grants nothing',
      race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } },
      raceData: {
        name: 'Tiefling',
        traits: [],
        subraces: [{
          name: 'Abyssal Tiefling',
          description: 'You have Resistance to Poison damage.',
        }],
      },
      expected: [],
    },
    {
      name: 'disk anchor: Abyssal Tiefling verbatim subrace data extracts nothing (structured damage_resistance is never read)',
      race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } },
      raceData: {
        name: 'Tiefling',
        traits: [],
        subraces: [{
          name: 'Abyssal Tiefling',
          description: 'The entropy of the Abyss, the chaos of Pandemonium, and the despair of Carceri call to tieflings who have the abyssal legacy.',
          damage_resistance: 'Poison',
        }],
      },
      expected: [],
    },
  ])('$name', async ({ race, raceData, expected }) => {
    mockRace(raceData);

    const result = await getResistanceLimits(baseArgs({ rules: '2024', race }));

    expectRaceResistances(result, expected);
  });
});
