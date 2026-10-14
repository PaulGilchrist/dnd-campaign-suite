import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
}));

import { getResistanceInfo } from './resistancesValidation.js';

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resistancesValidation getResistanceInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getResistanceInfo', () => {
    it('returns isGranted true and Race source when race grants the resistance', async () => {
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

      expect(result).toEqual({
        isGranted: true,
        isPreSelected: true,
        source: 'Race',
      });
    });

    it('returns isGranted true and Class source when class grants the immunity', async () => {
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

      expect(result).toEqual({
        isGranted: true,
        isPreSelected: true,
        source: 'Class',
      });
    });

    it('returns isGranted false and Unknown source when nothing grants the type', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(emptyClassData());

      const result = await getResistanceInfo('Fire', 'resistance', baseArgs());

      expect(result).toEqual({
        isGranted: false,
        isPreSelected: false,
        source: 'Unknown',
      });
    });

    it('returns isGranted false when querying resistance category for an immunity-only grant', async () => {
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

      const result = await getResistanceInfo('Fire', 'resistance', baseArgs());

      expect(result).toEqual({
        isGranted: false,
        isPreSelected: false,
        source: 'Unknown',
      });
    });

    it('returns isGranted false when querying immunity category for a resistance-only grant', async () => {
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

      const result = await getResistanceInfo('Fire', 'immunity', baseArgs({ race: { name: 'Tiefling' } }));

      expect(result).toEqual({
        isGranted: false,
        isPreSelected: false,
        source: 'Unknown',
      });
    });

    it('extracts 2024 race resistances correctly', async () => {
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

      expect(result).toEqual({
        isGranted: true,
        isPreSelected: true,
        source: 'Race',
      });
    });

    it('handles null raceData gracefully', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

      const result = await getResistanceInfo('Fire', 'resistance', baseArgs({ race: { name: 'Nonexistent' } }));

      expect(result).toEqual({
        isGranted: false,
        isPreSelected: false,
        source: 'Unknown',
      });
    });

    it('uses 2024 ruleset when specified', async () => {
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

      const result = await getResistanceInfo(
        'Poison',
        'resistance',
        baseArgs({ rules: '2024', race: { name: 'Dwarf' } }),
      );

      expect(result.isGranted).toBe(true);
      expect(result.isPreSelected).toBe(true);
      expect(result.source).toBe('Race');
    });
  });
});
