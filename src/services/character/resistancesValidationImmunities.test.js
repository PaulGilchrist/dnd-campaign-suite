import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
}));

import { getResistanceLimits } from './resistancesValidation.js';

// ── Factories ────────────────────────────────────────────────────────────────

const emptyRaceData = () => ({ name: 'Human', traits: [] });

const baseArgs = (overrides = {}) => ({
  rules: '5e',
  race: { name: 'Human' },
  class: { name: 'Wizard' },
  level: 1,
  ...overrides,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Assert that `result.resistances` is empty and `result.immunities` contains
 * exactly the given types (ignoring order).
 */
function expectImmunitiesOnly(result, expected) {
  expect(result.resistances).toEqual([]);
  expect(result.immunities.sort()).toEqual(expected.sort());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resistancesValidation getResistanceLimits - class immunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractClassImmunities (via getResistanceLimits)', () => {
    it.each([
      { desc: 'Fire', name: 'Fire immunity', featureDesc: 'You gain Immunity to Fire damage.', expected: ['Fire'] },
      { desc: 'Psychic', name: 'Psychic immunity', featureDesc: 'You gain Immunity to Psychic damage.', expected: ['Psychic'] },
    ])('extracts $name from class features at or below level', async ({ featureDesc, expected }) => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          { level: 10, features: [{ name: 'Damage Immunity', description: featureDesc }] },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 10, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunitiesOnly(result, expected);
    });

    it.each([
      { desc: 'Fire', featureDesc: 'You gain Immunity to Fire damage.', expected: [] },
      { desc: 'Lightning', featureDesc: 'You gain Immunity to Lightning damage.', expected: [] },
    ])('excludes immunities from levels above character level ($desc)', async ({ featureDesc, expected }) => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          { level: 10, features: [{ name: 'Damage Immunity', description: featureDesc }] },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 5, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunitiesOnly(result, expected);
    });

    it.each([
      { name: 'multi-immunity feature', featureDesc: 'You gain Immunity to Fire damage and Immunity to Cold damage.', expected: ['Fire', 'Cold'] },
      { name: 'mixed damage + condition immunities', featureDesc: 'You gain Immunity to Charmed and Immunity to Fire.', expected: ['Fire'] },
      { name: 'condition-only immunities (Mindless Rage)', featureDesc: 'You gain Immunity to Charmed and Frightened.', expected: [] },
    ])('filters $name correctly', async ({ featureDesc, expected }) => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 6, features: [{ name: 'Feature', description: featureDesc }] },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 6, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunitiesOnly(result, expected);
    });

    it.each([
      { rules: '5e', structure: 'subclasses.class_levels', classData: { class_levels: [{ level: 1, features: [] }], subclasses: [{ name: 'Test Subclass', class_levels: [{ level: 7, features: [{ name: 'Subclass Feature', description: 'You gain Immunity to Lightning damage.' }] }] }] } },
      { rules: '2024', structure: 'majors.features', classData: { class_levels: [{ level: 1, features: [] }], majors: [{ name: 'Path of the Test', features: [{ level: 3, name: 'Test Feature', description: 'You gain Immunity to Fire damage.' }] }] } },
    ])('extracts immunities from $structure at or below level', async ({ rules, classData }) => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(classData);

      const result = await getResistanceLimits(
        baseArgs({ rules, level: rules === '5e' ? 7 : 3, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunitiesOnly(result, rules === '5e' ? ['Lightning'] : ['Fire']);
    });

    it.each([
      { rules: '5e', structure: 'subclasses.class_levels', classData: { class_levels: [{ level: 1, features: [] }], subclasses: [{ name: 'Test Subclass', class_levels: [{ level: 14, features: [{ name: 'Late Feature', description: 'You gain Immunity to Fire damage.' }] }] }] } },
      { rules: '2024', structure: 'majors.features', classData: { class_levels: [{ level: 1, features: [] }], majors: [{ name: 'High Level Path', features: [{ level: 10, name: 'Late Feature', description: 'You gain Immunity to Fire damage.' }] }] } },
    ])('excludes $structure immunities above character level', async ({ rules, classData }) => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(classData);

      const result = await getResistanceLimits(
        baseArgs({ rules, level: rules === '5e' ? 7 : 5, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunitiesOnly(result, []);
    });

    it('handles null classData, missing class_levels, and empty features', async () => {
      const nullResult = await getResistanceLimits(
        baseArgs({ race: { name: 'Human' }, class: { name: 'Nonexistent' } }),
      );
      expectImmunitiesOnly(nullResult, []);

      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ name: 'WeirdClass' });
      const noLevelsResult = await getResistanceLimits(
        baseArgs({ race: { name: 'Human' }, class: { name: 'WeirdClass' } }),
      );
      expectImmunitiesOnly(noLevelsResult, []);

      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [] }],
      });
      const emptyFeaturesResult = await getResistanceLimits(
        baseArgs({ level: 1, race: { name: 'Human' }, class: { name: 'Wizard' } }),
      );
      expectImmunitiesOnly(emptyFeaturesResult, []);
    });

    it('extracts immunity from feature with array description', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 1,
            features: [{ name: 'Damage Immunity', description: ['You gain', 'Immunity to', 'Radiant damage.'] }],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 1, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunitiesOnly(result, ['Radiant']);
    });

    it('rejects invalid damage types from immunity descriptions', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 1,
            features: [{ name: 'Fake Immunity', description: 'You gain Immunity to Magic and Sneaky.' }],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 1, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunitiesOnly(result, []);
    });
  });
});
