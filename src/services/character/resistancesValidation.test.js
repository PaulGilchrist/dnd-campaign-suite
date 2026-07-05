// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
}));

import {
  getResistanceLimits,
  getPreSelectedResistances,
  validateResistances,
  getResistanceInfo,
} from './resistancesValidation.js';

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
 * Assert that `result.resistances` contains exactly the given types.
 * Also asserts that `result.immunities` is empty (race-only test).
 */
function expectResistances(result, expected) {
  expect(result.resistances.sort()).toEqual(expected.sort());
  expect(result.immunities).toEqual([]);
}

/**
 * Assert that `result.immunities` contains exactly the given types.
 * Also asserts that `result.resistances` is empty (class-only test).
 */
function expectImmunities(result, expected) {
  expect(result.resistances).toEqual([]);
  expect(result.immunities.sort()).toEqual(expected.sort());
}

/**
 * Assert that `warnings` contains at least one warning of the given type
 * whose message includes the given substring.
 */
function expectWarning(warnings, type, substring) {
  const match = warnings.find(
    (w) => w.type === type && w.message.includes(substring),
  );
  expect(match).toBeDefined();
}

/**
 * Assert that `warnings` does NOT contain a warning of the given type with
 * the given substring (negative assertion).
 */
function expectNoWarning(warnings, type, substring) {
  const match = warnings.find(
    (w) => w.type === type && w.message.includes(substring),
  );
  expect(match).toBeUndefined();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resistancesValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── extract5eRaceResistances ─────────────────────────────────────────────

  describe('extract5eRaceResistances (via getResistanceLimits)', () => {
    it('extracts fire resistance from Tiefling Hellish Resistance', async () => {
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

      expectResistances(result, ['Fire']);
    });

    it('extracts poison resistance from Dwarf Dwarven Resilience', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Dwarf',
        traits: [
          {
            name: 'Dwarven Resilience',
            description: ['You have resistance against poison damage.'],
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ rules: '5e', race: { name: 'Dwarf' } }));

      expectResistances(result, ['Poison']);
    });

    it('extracts poison resistance from Stout Halfling Scout Resilience', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Halfling',
        subraces: [
          {
            name: 'Stout Halfling',
            racial_traits: [
              {
                name: 'Scout Resilience',
                description: ['You have resistance against poison damage.'],
              },
            ],
          },
        ],
        traits: [],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({
          rules: '5e',
          race: { name: 'Halfling', subrace: { name: 'Stout Halfling' } },
        }),
      );

      expectResistances(result, ['Poison']);
    });

    it('returns empty resistances when race has no traits', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs());

      expectResistances(result, []);
    });

    it('returns empty resistances when raceData is null', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs());

      expectResistances(result, []);
    });

    it('returns empty resistances when raceData has no traits property', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ name: 'MysteryRace' });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs());

      expectResistances(result, []);
    });

    it('returns empty resistances for Dragonborn "Damage Resistance" trait alone', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Dragonborn',
        traits: [
          {
            name: 'Damage Resistance',
            description: ['You have resistance to one damage type.'],
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ rules: '5e', race: { name: 'Dragonborn' } }),
      );

      expectResistances(result, []);
    });

    it('extracts Fire resistance from Dragonborn subrace description (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData)
        .mockResolvedValueOnce({
          name: 'Dragonborn',
          traits: [
            {
              name: 'Damage Resistance',
              description: ['You have resistance to one damage type.'],
            },
          ],
        })
        .mockResolvedValueOnce({
          name: 'Dragonborn',
          traits: [
            {
              name: 'Damage Resistance',
              description: ['You have resistance to one damage type.'],
            },
          ],
          subraces: [
            { name: 'Gold Dragon', description: 'You have resistance to fire damage.' },
          ],
        });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({
          rules: '5e',
          race: { name: 'Dragonborn', subrace: { name: 'Gold Dragon' } },
        }),
      );

      expectResistances(result, ['Fire']);
    });

    it('handles non-array trait description (string fallback)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Tiefling',
        traits: [
          {
            name: 'Hellish Resistance',
            description: 'You have resistance to fire damage.',
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(baseArgs({ race: { name: 'Tiefling' } }));

      expectResistances(result, ['Fire']);
    });

    it('handles undefined subrace gracefully', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ race: { name: 'Human', subrace: undefined } }),
      );

      expectResistances(result, []);
    });
  });

  // ── extract2024RaceResistances ───────────────────────────────────────────

  describe('extract2024RaceResistances (via getResistanceLimits)', () => {
    it('extracts Necrotic and Radiant from Aasimar Celestial Resistance', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Aasimar',
        traits: [
          {
            name: 'Celestial Resistance',
            description: 'Resistance to Necrotic and Radiant damage.',
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ rules: '2024', race: { name: 'Aasimar' } }),
      );

      expectResistances(result, ['Necrotic', 'Radiant']);
    });

    it('extracts Poison from 2024 Dwarf Dwarven Resilience', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Dwarf',
        traits: [
          {
            name: 'Dwarven Resilience',
            description: 'Resistance to Poison damage.',
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ rules: '2024', race: { name: 'Dwarf' } }),
      );

      expectResistances(result, ['Poison']);
    });

    it('extracts Acid from 2024 Dragonborn subrace traits array', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Dragonborn',
        traits: [
          {
            name: 'Damage Resistance',
            description: 'You have resistance to one damage type.',
          },
        ],
        subraces: [
          {
            name: 'Draconborn of Tiamat',
            traits: [{ description: 'Resistance to Acid damage.' }],
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({
          rules: '2024',
          race: { name: 'Dragonborn', subrace: { name: 'Draconborn of Tiamat' } },
        }),
      );

      expectResistances(result, ['Acid']);
    });

    it('extracts Poison from 2024 Tiefling subrace traits', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Tiefling',
        traits: [
          {
            name: 'Fiendish Legacy',
            description: 'Your infernal heritage grants you a legacy.',
          },
        ],
        subraces: [
          {
            name: 'Abyssal Tiefling',
            traits: [{ description: 'Resistance to Poison damage.' }],
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({
          rules: '2024',
          race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } },
        }),
      );

      expectResistances(result, ['Poison']);
    });

    it('extracts Fire from 2024 Dragonborn subrace description', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Dragonborn',
        traits: [
          {
            name: 'Damage Resistance',
            description: 'Resistance to one damage type.',
          },
        ],
        subraces: [
          { name: 'Gold Dragonborn', description: 'Resistance to Fire damage.' },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({
          rules: '2024',
          race: { name: 'Dragonborn', subrace: { name: 'Gold Dragonborn' } },
        }),
      );

      expectResistances(result, ['Fire']);
    });

    it('extracts Cold from 2024 subrace with nested traits array', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'CustomRace',
        traits: [],
        subraces: [
          {
            name: 'Frost Subrace',
            traits: [{ description: 'You have Resistance to Cold damage.' }],
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({
          rules: '2024',
          race: { name: 'CustomRace', subrace: { name: 'Frost Subrace' } },
        }),
      );

      expectResistances(result, ['Cold']);
    });

    it('returns empty resistances when raceData has no traits (2024)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ name: 'CustomRace' });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ rules: '2024', race: { name: 'CustomRace' } }),
      );

      expectResistances(result, []);
    });
  });

  // ── extractClassImmunities ───────────────────────────────────────────────

  describe('extractClassImmunities (via getResistanceLimits)', () => {
    it('extracts Fire immunity from class features at or below level', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          {
            level: 10,
            features: [
              {
                name: 'Damage Immunity',
                description: 'You gain Immunity to Fire damage.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 10, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunities(result, ['Fire']);
    });

    it('excludes immunities from levels above character level', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          {
            level: 10,
            features: [
              {
                name: 'Damage Immunity',
                description: 'You gain Immunity to Fire damage.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 5, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunities(result, []);
    });

    it('filters out non-damage immunity types (e.g. Charmed)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 6,
            features: [
              {
                name: 'Mystic Immunity',
                description: 'You gain Immunity to Charmed and Immunity to Fire.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 6, race: { name: 'Human' }, class: { name: 'Mystic' } }),
      );

      expectImmunities(result, ['Fire']);
    });

    it('extracts Psychic immunity (valid damage type)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 10,
            features: [
              {
                name: 'Damage Immunity',
                description: 'You gain Immunity to Psychic damage.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 10, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunities(result, ['Psychic']);
    });

    it('returns empty immunities when classData is null', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

      const result = await getResistanceLimits(
        baseArgs({ race: { name: 'Human' }, class: { name: 'Nonexistent' } }),
      );

      expectImmunities(result, []);
    });

    it('returns empty immunities when classData has no class_levels', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ name: 'WeirdClass' });

      const result = await getResistanceLimits(
        baseArgs({ race: { name: 'Human' }, class: { name: 'WeirdClass' } }),
      );

      expectImmunities(result, []);
    });

    it('extracts immunities from 5e subclass features at or below level', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [] }],
        subclasses: [
          {
            name: 'Test Subclass',
            class_levels: [
              { level: 1, features: [] },
              {
                level: 7,
                features: [
                  {
                    name: 'Subclass Feature',
                    description: 'You gain Immunity to Lightning damage.',
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 7, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunities(result, ['Lightning']);
    });

    it('excludes 5e subclass immunities above character level', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [] }],
        subclasses: [
          {
            name: 'Test Subclass',
            class_levels: [
              { level: 1, features: [] },
              {
                level: 14,
                features: [
                  {
                    name: 'Late Feature',
                    description: 'You gain Immunity to Fire damage.',
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 7, race: { name: 'Human' }, class: { name: 'Fighter' } }),
      );

      expectImmunities(result, []);
    });

    it('extracts immunities from 2024 subclass majors at or below level', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [] }],
        majors: [
          {
            name: 'Path of the Test',
            features: [
              {
                level: 3,
                name: 'Test Feature',
                description: 'You gain Immunity to Fire damage.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ rules: '2024', level: 3, race: { name: 'Human' }, class: { name: 'Barbarian' } }),
      );

      expectImmunities(result, ['Fire']);
    });

    it('excludes 2024 major immunities above character level', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [] }],
        majors: [
          {
            name: 'High Level Path',
            features: [
              {
                level: 10,
                name: 'Late Feature',
                description: 'You gain Immunity to Fire damage.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({
          rules: '2024',
          level: 5,
          race: { name: 'Human' },
          class: { name: 'Barbarian' },
        }),
      );

      expectImmunities(result, []);
    });

    it('ignores condition immunities like "Immunity to Charmed" in Mindless Rage', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 6,
            features: [
              {
                name: 'Mindless Rage',
                description: 'You gain Immunity to Charmed and Frightened.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ level: 6, race: { name: 'Human' }, class: { name: 'Barbarian' } }),
      );

      // Charmed and Frightened are conditions, not damage types
      expectImmunities(result, []);
    });
  });

  // ── getPreSelectedResistances ────────────────────────────────────────────

  describe('getPreSelectedResistances', () => {
    it('returns pre-selected resistances and immunities from race and class', async () => {
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

      const result = await getPreSelectedResistances(
        baseArgs({ race: { name: 'Tiefling' } }),
      );

      expect(result.resistances).toContain('Fire');
      expect(result.immunities).toEqual([]);
    });

    it('returns empty arrays when race and class are empty objects', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

      const result = await getPreSelectedResistances(
        baseArgs({ race: {}, class: {} }),
      );

      expect(result.resistances).toEqual([]);
      expect(result.immunities).toEqual([]);
    });
  });

  // ── validateResistances ──────────────────────────────────────────────────

  describe('validateResistances', () => {
    const emptyDataArgs = () =>
      baseArgs({
        resistances: [],
        immunities: [],
      });

    it('warns about ungranted resistances', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ resistances: ['Fire'], immunities: [] }),
      );

      expectWarning(warnings, 'warning', 'not granted');
      expect(warnings.filter((w) => w.type === 'warning').length).toBeGreaterThanOrEqual(1);
    });

    it('warns about ungranted immunities', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ resistances: [], immunities: ['Fire'] }),
      );

      expectWarning(warnings, 'warning', 'immunities are not granted');
    });

    it('warns about duplicate resistances', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ resistances: ['Fire', 'Fire'], immunities: [] }),
      );

      expectWarning(warnings, 'warning', 'multiple times');
    });

    it('warns about duplicate immunities', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ resistances: [], immunities: ['Fire', 'Fire'] }),
      );

      expectWarning(warnings, 'warning', 'immunities') &&
        expectWarning(warnings, 'warning', 'multiple times');
    });

    it('returns info when no resistances or immunities selected and none granted', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(emptyDataArgs());

      expectWarning(warnings, 'info', 'does not grant');
    });

    it('warns about unselected granted resistances', async () => {
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

      const warnings = await validateResistances(
        baseArgs({
          rules: '5e',
          race: { name: 'Tiefling' },
          class: { name: 'Wizard' },
          level: 1,
          resistances: [],
          immunities: [],
        }),
      );

      expectWarning(warnings, 'info', 'grants these resistances');
    });

    it('warns about unselected granted immunities', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 1,
            features: [
              {
                name: 'Immunity',
                description: 'You gain Immunity to Fire damage.',
              },
            ],
          },
        ],
      });

      const warnings = await validateResistances(
        baseArgs({
          race: { name: 'Human' },
          class: { name: 'Fighter' },
          level: 1,
          resistances: [],
          immunities: [],
        }),
      );

      expectWarning(warnings, 'info', 'grants these immunities');
    });

    it('uses "2024" in info message for 2024 ruleset', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ rules: '2024', resistances: [], immunities: [] }),
      );

      expectWarning(warnings, 'info', '2024');
    });

    it('handles null resistances and immunities fields', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ resistances: null, immunities: null }),
      );

      expectWarning(warnings, 'info', 'does not grant');
    });

    it('includes race and class names in info message', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ race: { name: 'Elf' }, class: { name: 'Ranger' }, resistances: [], immunities: [] }),
      );

      const infoMsg = warnings.find((w) => w.type === 'info' && w.message.includes('does not grant'));
      expect(infoMsg.message).toContain('Elf');
      expect(infoMsg.message).toContain('Ranger');
    });

    it('does not warn when all selected resistances are granted', async () => {
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

      const warnings = await validateResistances(
        baseArgs({ race: { name: 'Tiefling' }, resistances: ['Fire'], immunities: [] }),
      );

      expectNoWarning(warnings, 'warning', 'not granted');
    });

    it('does not warn when all selected immunities are granted', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 1,
            features: [
              {
                name: 'Immunity',
                description: 'You gain Immunity to Fire damage.',
              },
            ],
          },
        ],
      });

      const warnings = await validateResistances(
        baseArgs({ class: { name: 'Fighter' }, resistances: [], immunities: ['Fire'] }),
      );

      expectNoWarning(warnings, 'warning', 'immunities are not granted');
    });
  });

  // ── getResistanceInfo ────────────────────────────────────────────────────

  describe('getResistanceInfo', () => {
    it('identifies resistance source from race', async () => {
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

      const result = await getResistanceInfo('Fire', 'resistance', baseArgs({ race: { name: 'Tiefling' } }));

      expect(result.isGranted).toBe(true);
      expect(result.isPreSelected).toBe(true);
      expect(result.source).toContain('Race');
    });

    it('returns isGranted false and Unknown source when resistance not granted', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceInfo('Fire', 'resistance', baseArgs());

      expect(result.isGranted).toBe(false);
      expect(result.isPreSelected).toBe(false);
      expect(result.source).toBe('Unknown');
    });

    it('identifies immunity source from class', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 1,
            features: [
              {
                name: 'Immunity',
                description: 'You gain Immunity to Psychic damage.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceInfo(
        'Psychic',
        'immunity',
        baseArgs({ class: { name: 'Fighter' }, level: 1 }),
      );

      expect(result.isGranted).toBe(true);
      expect(result.isPreSelected).toBe(true);
      expect(result.source).toContain('Class');
    });

    it('handles 2024 ruleset correctly', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Aasimar',
        traits: [
          {
            name: 'Celestial Resistance',
            description: 'Resistance to Necrotic and Radiant damage.',
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceInfo(
        'Necrotic',
        'resistance',
        baseArgs({ rules: '2024', race: { name: 'Aasimar' } }),
      );

      expect(result.isGranted).toBe(true);
      expect(result.isPreSelected).toBe(true);
      expect(result.source).toContain('Race');
    });

    it('returns isGranted false for immunity when class has none', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceInfo('Fire', 'immunity', baseArgs());

      expect(result.isGranted).toBe(false);
      expect(result.isPreSelected).toBe(false);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('getResistanceLimits edge cases', () => {
    it('handles empty race name', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ race: { name: '' } }),
      );

      expectResistances(result, []);
    });

    it('handles missing subrace field', async () => {
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

      const result = await getResistanceLimits(
        baseArgs({ race: { name: 'Tiefling' } }),
      );

      expectResistances(result, ['Fire']);
    });

    it('handles 2024 rules without race', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ rules: '2024', race: { name: '' } }),
      );

      expectResistances(result, []);
      expect(result.details).toContain('2024');
    });

    it('handles missing class name', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

      const result = await getResistanceLimits(
        baseArgs({ class: { name: '' } }),
      );

      expectImmunities(result, []);
    });

    it('includes race and class names in details message', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ race: { name: 'Human' }, class: { name: 'Wizard' } }),
      );

      expect(result.details).toContain('5e');
      expect(result.details).toContain('Human');
      expect(result.details).toContain('Wizard');
    });

    it('handles string subrace (not nested object)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        name: 'Dwarf',
        traits: [
          {
            name: 'Dwarven Resilience',
            description: ['You have resistance against poison damage.'],
          },
        ],
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceLimits(
        baseArgs({ race: { name: 'Dwarf', subrace: 'Hill Dwarf' } }),
      );

      expectResistances(result, ['Poison']);
    });

    it('defaults to level 1 when level is missing', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          {
            level: 1,
            features: [
              {
                name: 'Immunity',
                description: 'You gain Immunity to Fire damage.',
              },
            ],
          },
          {
            level: 5,
            features: [
              {
                name: 'Advanced Immunity',
                description: 'You gain Immunity to Cold damage.',
              },
            ],
          },
        ],
      });

      const result = await getResistanceLimits(
        baseArgs({ class: { name: 'Fighter' } }),
      );

      expectImmunities(result, ['Fire']);
      expect(result.immunities).not.toContain('Cold');
    });

    it('returns details string with correct ruleset label', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result5e = await getResistanceLimits(baseArgs({ rules: '5e' }));
      const result2024 = await getResistanceLimits(baseArgs({ rules: '2024' }));

      expect(result5e.details).toContain('5e');
      expect(result2024.details).toContain('2024');
    });
  });
});
