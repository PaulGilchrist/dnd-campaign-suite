// @maintained-by-ai
// QUARTET lane (see resistancesValidation.test.js header seam map): getResistanceInfo granted/source API —
// who-granted attribution (Race | Class | "Race, Class" join | Unknown) and the exact { isGranted, source,
// isPreSelected } contract. Canonical extraction home is NOT here: race-side lives in
// resistancesValidationLimits.test.js, class-side in resistancesValidationImmunities.test.js — per #2049 the
// 2024 Aasimar/Dwarf extraction re-proofs were deleted here; only the attribution angle remains.
// Dead-code flag (#1916): getResistanceInfo has ZERO external consumers — useWizardResistances.js imports only
// validateResistances + getPreSelectedResistances. This file pins its API contract; source-side removal is
// queued for orchestrator decision.
// Disk anchors (verified): 5e Tiefling 'Hellish Resistance' / "You have resistance to fire damage." from
// public/data/races.json; 2024 Aasimar 'Celestial Resistance' / "You have Resistance to Necrotic damage and
// Radiant damage." verbatim from public/data/2024/races.json. Class immunity fixtures are SYNTHETIC — disk sweep
// proved zero real class features grant a valid damage immunity (Immunities lane header).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
}));

import { getResistanceInfo } from './resistancesValidation.js';

// ── Fixtures (discriminating: race grants Fire resistance, class grants Cold immunity,
//    different damage types so any attribution or category mixup is observable) ──

const emptyRaceData = () => ({ name: 'Human', traits: [] });
const emptyClassData = () => ({ class_levels: [] });

const tieflingRaceData = () => ({
  name: 'Tiefling',
  traits: [{ name: 'Hellish Resistance', description: 'You have resistance to fire damage.' }],
});

// Synthetic: 5e base classes grant no damage immunities (Immunities-lane disk sweep).
const syntheticImmunityClass = (type) => ({
  class_levels: [
    { level: 1, features: [{ name: 'Synthetic Immunity', description: `You gain Immunity to ${type} damage.` }] },
  ],
});

const baseArgs = (overrides = {}) => ({
  rules: '5e',
  race: { name: 'Human' },
  class: { name: 'Wizard' },
  level: 1,
  ...overrides,
});

function mockData(raceData, classData) {
  vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(raceData);
  vi.mocked(dataLoader.fetchClassData).mockResolvedValue(classData);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getResistanceInfo granted/source attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'race-granted resistance → Race',
      raceData: tieflingRaceData(),
      classData: emptyClassData(),
      type: 'Fire',
      category: 'resistance',
      expected: { isGranted: true, source: 'Race', isPreSelected: true },
    },
    {
      name: 'class-granted immunity → Class',
      raceData: emptyRaceData(),
      classData: syntheticImmunityClass('Cold'),
      type: 'Cold',
      category: 'immunity',
      expected: { isGranted: true, source: 'Class', isPreSelected: true },
    },
    {
      name: 'resistance-only grant queried as immunity → Unknown (never granted, never misattributed)',
      raceData: tieflingRaceData(),
      classData: emptyClassData(),
      type: 'Fire',
      category: 'immunity',
      expected: { isGranted: false, source: 'Unknown', isPreSelected: false },
    },
    {
      name: 'immunity-only grant queried as resistance → Unknown (class grant never lands in resistance lane)',
      raceData: emptyRaceData(),
      classData: syntheticImmunityClass('Cold'),
      type: 'Cold',
      category: 'resistance',
      expected: { isGranted: false, source: 'Unknown', isPreSelected: false },
    },
    {
      name: 'type granted by neither source → Unknown',
      raceData: tieflingRaceData(),
      classData: syntheticImmunityClass('Cold'),
      type: 'Necrotic',
      category: 'resistance',
      expected: { isGranted: false, source: 'Unknown', isPreSelected: false },
    },
    {
      name: 'unresolved (null) race and class data → Unknown, no throw',
      raceData: null,
      classData: null,
      type: 'Fire',
      category: 'resistance',
      expected: { isGranted: false, source: 'Unknown', isPreSelected: false },
    },
  ])('$name', async ({ raceData, classData, type, category, expected }) => {
    mockData(raceData, classData);

    const result = await getResistanceInfo(
      type,
      category,
      baseArgs({ race: { name: raceData?.name || 'Human' }, class: { name: 'Fighter' } }),
    );

    expect(result).toEqual(expected);
  });

  it('joins every matching source as "Race, Class" when both reference the same type', async () => {
    // Quirk pinned honestly: resolveGrantedSources runs the race *resistance* extractor even for the
    // immunity category, so a race resistance to the same type contributes to an immunity attribution.
    // The ', ' join is observable ONLY through this file — do not drop without re-pinning the join.
    mockData(tieflingRaceData(), syntheticImmunityClass('Fire'));

    const result = await getResistanceInfo(
      'Fire',
      'immunity',
      baseArgs({ race: { name: 'Tiefling' }, class: { name: 'Fighter' } }),
    );

    expect(result).toEqual({ isGranted: true, source: 'Race, Class', isPreSelected: true });
  });

  it('attributes 2024 grants to Race and routes the 2024 ruleset to dataLoader', async () => {
    // Attribution + routing angle only; 2024 extraction enumeration is pinned canonically in
    // resistancesValidationLimits.test.js (#2049). Trait strings verbatim from public/data/2024/races.json.
    mockData(
      {
        name: 'Aasimar',
        traits: [{ name: 'Celestial Resistance', description: 'You have Resistance to Necrotic damage and Radiant damage.' }],
      },
      emptyClassData(),
    );

    const result = await getResistanceInfo(
      'Necrotic',
      'resistance',
      baseArgs({ rules: '2024', race: { name: 'Aasimar' } }),
    );

    expect(result).toEqual({ isGranted: true, source: 'Race', isPreSelected: true });
    expect(dataLoader.fetchRaceData).toHaveBeenCalledWith('Aasimar', '2024');
  });
});
