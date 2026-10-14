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
const emptyClassData = () => ({ class_levels: [] });

const baseArgs = (overrides = {}) => ({
  rules: '5e',
  race: { name: 'Human' },
  class: { name: 'Wizard' },
  level: 1,
  ...overrides,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Assert that `result.resistances` contains exactly the given types
 * (ignoring order) and `result.immunities` is empty.
 */
function expectResistancesOnly(result, expected) {
  expect(result.resistances.sort()).toEqual(expected.sort());
  expect(result.immunities).toEqual([]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resistancesValidation getResistanceLimits - race resistances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── extract5eRaceResistances ─────────────────────────────────────────────

  describe('extract5eRaceResistances (via getResistanceLimits)', () => {
    it('extracts Fire resistance from Tiefling Hellish Resistance', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Tiefling',
        traits: [
          {
            name: 'Hellish Resistance',
            description: ['You have resistance to fire damage.'],
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ rules: '5e', race: { name: 'Tiefling' } }));

      expectResistancesOnly(result, ['Fire']);
    });

    it.each([
      { name: 'Dwarf', traitName: 'Dwarven Resilience', desc: ['You have resistance against poison damage.'], expected: ['Poison'] },
      { name: 'Halfling', traitName: 'Scout Resilience', desc: ['You have resistance against poison damage.'], expected: ['Poison'], subrace: 'Stout Halfling' },
    ])('extracts poison resistance from $name $traitName', async ({ name, desc, expected, subrace }) => {
      const raceData = subrace
        ? {
            name,
            subraces: [{ name: subrace, racial_traits: [{ name: 'Scout Resilience', description: desc }] }],
            traits: [],
          }
        : { name, traits: [{ name: 'Dwarven Resilience', description: desc }] };

      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(raceData);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ rules: '5e', race: { name, subrace: subrace ? { name: subrace } : undefined } }));

      expectResistancesOnly(result, expected);
    });

    it('returns empty resistances when raceData is null or has no traits', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs());

      expectResistancesOnly(result, []);
    });

    it('extracts Fire resistance from Dragonborn subrace description (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Dragonborn',
        traits: [{ name: 'Damage Resistance', description: ['You have resistance to one damage type.'] }],
        subraces: [{ name: 'Gold Dragon', description: 'You have resistance to fire damage.' }],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ rules: '5e', race: { name: 'Dragonborn', subrace: { name: 'Gold Dragon' } } }));

      expectResistancesOnly(result, ['Fire']);
    });

    it('handles non-array trait description (string fallback)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Tiefling',
        traits: [{ name: 'Hellish Resistance', description: 'You have resistance to fire damage.' }],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ race: { name: 'Tiefling' } }));

      expectResistancesOnly(result, ['Fire']);
    });

    it('handles undefined subrace and empty traits gracefully', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ race: { name: 'Human', subrace: undefined } }));

      expectResistancesOnly(result, []);
    });
  });

  // ── extract2024RaceResistances ───────────────────────────────────────────

  describe('extract2024RaceResistances (via getResistanceLimits)', () => {
    it.each([
      { name: 'Aasimar', desc: 'Resistance to Necrotic and Radiant damage.', expected: ['Necrotic', 'Radiant'], traitName: 'Celestial Resistance' },
      { name: 'Dwarf', desc: 'Resistance to Poison damage.', expected: ['Poison'], traitName: 'Dwarven Resilience' },
    ])('extracts resistances from 2024 $name $traitName', async ({ name, desc, expected, traitName }) => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name,
        traits: [{ name: traitName, description: desc }],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ rules: '2024', race: { name } }));

      expectResistancesOnly(result, expected);
    });

    it.each([
      { name: 'Dragonborn', subrace: 'Draconborn of Tiamat', desc: 'Resistance to Acid damage.', expected: ['Acid'], traitName: 'Damage Resistance', source: 'traits' },
      { name: 'Tiefling', subrace: 'Abyssal Tiefling', desc: 'Resistance to Poison damage.', expected: ['Poison'], traitName: 'Fiendish Legacy', source: 'traits' },
      { name: 'Dragonborn', subrace: 'Gold Dragonborn', desc: 'Resistance to Fire damage.', expected: ['Fire'], traitName: 'Damage Resistance', source: 'description' },
    ])('extracts resistances from 2024 $name subrace $subrace', async ({ name, subrace, desc, expected, traitName, source }) => {
      const subraceData = source === 'traits'
        ? { name, traits: [{ name: traitName, description: 'You have resistance to one damage type.' }], subraces: [{ name: subrace, traits: [{ description: desc }] }] }
        : { name, traits: [{ name: traitName, description: 'Resistance to one damage type.' }], subraces: [{ name: subrace, description: desc }] };

      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(subraceData);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ rules: '2024', race: { name, subrace: { name: subrace } } }));

      expectResistancesOnly(result, expected);
    });

    it('handles 2024 race with null traits', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ name: 'NullTraitsRace', traits: null });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ rules: '2024', race: { name: 'NullTraitsRace' } }));

      expectResistancesOnly(result, []);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('getResistanceLimits edge cases', () => {
    it('handles missing class name', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

      const result = await getResistanceLimits(baseArgs({ class: { name: '' } }));

      expect(result.resistances).toEqual([]);
      expect(result.immunities).toEqual([]);
    });

    it('includes race and class names in details message for both rulesets', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result5e = await getResistanceLimits(baseArgs({ rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' } }));
      const result2024 = await getResistanceLimits(baseArgs({ rules: '2024', race: { name: 'Human' }, class: { name: 'Wizard' } }));

      expect(result5e.details).toContain('5e');
      expect(result5e.details).toContain('Human');
      expect(result5e.details).toContain('Wizard');
      expect(result2024.details).toContain('2024');
      expect(result2024.details).toContain('Human');
      expect(result2024.details).toContain('Wizard');
    });

    it('handles string subrace (not nested object)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Dwarf',
        traits: [{ name: 'Dwarven Resilience', description: ['You have resistance against poison damage.'] }],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ race: { name: 'Dwarf', subrace: 'Hill Dwarf' } }));

      expectResistancesOnly(result, ['Poison']);
    });

    it('defaults to level 1 for class immunities when level is missing', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Immunity', description: 'You gain Immunity to Fire damage.' }] },
          { level: 5, features: [{ name: 'Advanced Immunity', description: 'You gain Immunity to Cold damage.' }] },
        ],
      });

      const result = await getResistanceLimits(baseArgs({ class: { name: 'Fighter' } }));

      expect(result.resistances).toEqual([]);
      expect(result.immunities).toEqual(['Fire']);
      expect(result.immunities).not.toContain('Cold');
    });

    it('handles missing level with no class immunities at level 1', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 5, features: [{ name: 'Late Immunity', description: 'You gain Immunity to Fire damage.' }] }],
      });

      const result = await getResistanceLimits(baseArgs({ class: { name: 'Fighter' } }));

      expect(result.resistances).toEqual([]);
      expect(result.immunities).toEqual([]);
    });
  });
});
