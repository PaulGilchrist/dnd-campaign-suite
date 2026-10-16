// @maintained-by-ai
// QUARTET SEAM MAP (resistancesValidation family — don't duplicate across these lanes):
//   resistancesValidation.test.js           → THIS FILE: validateResistances message contract (ungranted /
//                                             duplicates / unselected-grants / empty-selection info) + the
//                                             getPreSelectedResistances wrapper shape (strips limits.details).
//   resistancesValidationLimits.test.js     → getResistanceLimits race-side resistance extraction (5e + 2024).
//   resistancesValidationImmunities.test.js → getResistanceLimits class-side immunity extraction + level gates.
//   resistancesValidationInfo.test.js       → getResistanceInfo granted/source API.
// Consumers: src/hooks/wizard/useWizardResistances.js (validateFn + preSelect slots).
// Disk anchors: Tiefling 'Hellish Resistance' / "You have resistance to fire damage." is verbatim from
// public/data/races.json; 2024 trait strings verified against public/data/2024/races.json (Limits lane).
// public/data/rules-validation.json contains NO resistances templates — these four message templates are
// hardcoded in resistancesValidation.js, so full-string pins below match the source templates exactly,
// including the info message's raw `level || 1` interpolation.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
}));

import {
  getPreSelectedResistances,
  validateResistances,
} from './resistancesValidation.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────
// Race trait matches public/data/races.json verbatim (array description form).

const emptyRaceData = () => ({ name: 'Human', traits: [] });
const emptyClassData = () => ({ class_levels: [] });

const tieflingRaceData = () => ({
  name: 'Tiefling',
  traits: [
    { name: 'Hellish Resistance', description: ['You have resistance to fire damage.'] },
  ],
});

// Synthetic class feature (5e base classes grant no level-1 damage immunities;
// mirrors the synthetic class fixtures of the Immunities lane).
const fireImmunityClassData = () => ({
  class_levels: [
    { level: 1, features: [{ name: 'Damage Immunity', description: 'You gain Immunity to Fire damage.' }] },
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

// ── Exact message templates (from resistancesValidation.js source) ─────────

const UNGRANTED_RES_MULTI =
  'These resistances are not granted by your race, class, or background: Fire, Cold. Verify with your DM.';
const UNGRANTED_RES_COLD =
  'These resistances are not granted by your race, class, or background: Cold. Verify with your DM.';
const UNGRANTED_IMM =
  'These immunities are not granted by your race, class, or background: Fire. Verify with your DM.';
const DUP_RES =
  'Some resistances are selected multiple times. Each resistance should only be selected once.';
const DUP_IMM =
  'Some immunities are selected multiple times. Each immunity should only be selected once.';
const GRANTS_RES_INFO =
  'Your race/class grants these resistances that are not selected: Fire. You may want to select them.';
const GRANTS_IMM_INFO =
  'Your race/class grants these immunities that are not selected: Fire. You may want to select them.';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resistancesValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPreSelectedResistances', () => {
    it('passes limits through as { resistances, immunities } only, and stays empty on null data', async () => {
      mockData(tieflingRaceData(), fireImmunityClassData());

      const result = await getPreSelectedResistances(
        baseArgs({ race: { name: 'Tiefling' }, class: { name: 'Fighter' } }),
      );

      // Wrapper contract: forwards both arrays and strips limits' `details`.
      expect(result).toEqual({ resistances: ['Fire'], immunities: ['Fire'] });

      mockData(null, null);

      const emptyResult = await getPreSelectedResistances(baseArgs());

      expect(emptyResult).toEqual({ resistances: [], immunities: [] });
    });
  });

  describe('validateResistances', () => {
    it.each([
      {
        name: 'ungranted resistances (multi listed comma-joined)',
        raceData: emptyRaceData(),
        classData: emptyClassData(),
        args: { resistances: ['Fire', 'Cold'], immunities: [] },
        expected: [{ message: UNGRANTED_RES_MULTI, type: 'warning' }],
      },
      {
        name: 'ungranted immunities',
        raceData: emptyRaceData(),
        classData: emptyClassData(),
        args: { resistances: [], immunities: ['Fire'] },
        expected: [{ message: UNGRANTED_IMM, type: 'warning' }],
      },
    ])('warns with exact message about $name', async ({ raceData, classData, args, expected }) => {
      mockData(raceData, classData);

      const warnings = await validateResistances(baseArgs(args));

      expect(warnings).toEqual(expected);
    });

    it.each([
      {
        name: 'resistances',
        raceData: tieflingRaceData(),
        classData: emptyClassData(),
        args: { race: { name: 'Tiefling' }, resistances: ['Fire', 'Fire'], immunities: [] },
        expected: { message: DUP_RES, type: 'warning' },
      },
      {
        name: 'immunities',
        raceData: emptyRaceData(),
        classData: fireImmunityClassData(),
        args: { class: { name: 'Fighter' }, resistances: [], immunities: ['Fire', 'Fire'] },
        expected: { message: DUP_IMM, type: 'warning' },
      },
    ])('warns about duplicate $name even when the type is granted', async ({ raceData, classData, args, expected }) => {
      mockData(raceData, classData);

      const warnings = await validateResistances(baseArgs(args));

      // Fire is granted, so the duplicate warning is the ONLY output.
      expect(warnings).toEqual([expected]);
    });

    it('emits exactly one warning per issue category (ungranted and duplicate coexist, in order)', async () => {
      mockData(tieflingRaceData(), emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ race: { name: 'Tiefling' }, resistances: ['Fire', 'Fire', 'Cold'], immunities: [] }),
      );

      expect(warnings.map((w) => w.message)).toEqual([UNGRANTED_RES_COLD, DUP_RES]);
    });

    it.each([
      {
        name: 'race-granted',
        raceData: tieflingRaceData(),
        classData: emptyClassData(),
        args: { race: { name: 'Tiefling' } },
        expected: GRANTS_RES_INFO,
      },
      {
        name: 'class-granted',
        raceData: emptyRaceData(),
        classData: fireImmunityClassData(),
        args: { class: { name: 'Fighter' } },
        expected: GRANTS_IMM_INFO,
      },
    ])('infos about $name grants left unselected (plus empty-selection info)', async ({ raceData, classData, args, expected }) => {
      mockData(raceData, classData);

      const warnings = await validateResistances(baseArgs({ ...args, resistances: [], immunities: [] }));

      // Quirk pinned honestly: an empty selection also fires the "does not grant any"
      // info, so unselected grants always produce exactly two info entries.
      expect(warnings).toHaveLength(2);
      expect(warnings[1]).toEqual({ message: expected, type: 'info' });
    });

    it.each([
      {
        name: '5e defaults',
        raceData: emptyRaceData(),
        classData: emptyClassData(),
        args: { resistances: [], immunities: [] },
        expected: 'Your 5e Human Wizard does not grant any resistances or immunities at level 1.',
      },
      {
        name: '2024 with null selections and level interpolation',
        raceData: emptyRaceData(),
        classData: emptyClassData(),
        args: { rules: '2024', race: { name: 'Elf' }, class: { name: 'Ranger' }, level: 3, resistances: null, immunities: null },
        expected: 'Your 2024 Elf Ranger does not grant any resistances or immunities at level 3.',
      },
    ])('infos exactly once when nothing is selected ($name)', async ({ raceData, classData, args, expected }) => {
      mockData(raceData, classData);

      const warnings = await validateResistances(baseArgs(args));

      expect(warnings).toEqual([{ message: expected, type: 'info' }]);
    });

    it('produces no warnings when every selected type is granted', async () => {
      mockData(tieflingRaceData(), fireImmunityClassData());

      const warnings = await validateResistances(
        baseArgs({
          race: { name: 'Tiefling' },
          class: { name: 'Fighter' },
          resistances: ['Fire'],
          immunities: ['Fire'],
        }),
      );

      expect(warnings).toEqual([]);
    });

    it('names only the ungranted subset when selection partially overlaps grants', async () => {
      mockData(tieflingRaceData(), emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ race: { name: 'Tiefling' }, resistances: ['Fire', 'Cold'], immunities: [] }),
      );

      // Fire is granted (and selected) — only Cold is reported, and no grants info fires.
      expect(warnings).toEqual([{ message: UNGRANTED_RES_COLD, type: 'warning' }]);
    });
  });
});
