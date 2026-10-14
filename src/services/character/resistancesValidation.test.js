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

    it('warns about both ungranted resistances and immunities together', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ resistances: ['Fire'], immunities: ['Cold'] }),
      );

      expectWarning(warnings, 'warning', 'resistances are not granted');
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

      expectWarning(warnings, 'warning', 'immunities');
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

    it('does not warn when selected resistances partially overlap with granted', async () => {
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
        baseArgs({ race: { name: 'Tiefling' }, resistances: ['Fire', 'Cold'], immunities: [] }),
      );

      // Fire is granted, Cold is not — should still warn about Cold
      expectWarning(warnings, 'warning', 'not granted');
    });

    it('warns about each ungranted type individually in the message', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ resistances: ['Fire', 'Cold'], immunities: [] }),
      );

      const match = warnings.find((w) => w.type === 'warning' && w.message.includes('not granted'));
      expect(match.message).toContain('Fire');
      expect(match.message).toContain('Cold');
    });

    it('returns exactly one warning per issue category', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const warnings = await validateResistances(
        baseArgs({ resistances: ['Fire', 'Fire', 'Cold'], immunities: [] }),
      );

      const warningWarnings = warnings.filter((w) => w.type === 'warning');
      expect(warningWarnings.length).toBe(2); // one for ungranted, one for duplicates
    });
  });
});
