// @cleaned-by-ai
// @improved-by-ai
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadAbilityScores: vi.fn(),
  loadClassData: vi.fn(),
  loadEquipment: vi.fn(),
  loadMagicItems: vi.fn(),
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadRaceData: vi.fn(),
  loadSpells: vi.fn(),
}));

import useAppData from './useAppData.js';
import {
  loadAbilityScores,
  loadClassData,
  loadEquipment,
  loadMagicItems,
  loadRaceData,
  loadSpells,
} from '../../services/ui/dataLoader.js';

const mockAbilityScores = [{ name: 'Strength' }];
const mockClasses = [{ name: 'Fighter' }];
const mockClasses2024 = [{ name: 'Fighter 2024' }];
const mockEquipment = [{ name: 'Sword' }];
const mockMagicItems = [{ name: 'Wand' }];
const mockRaces = [{ name: 'Human' }];
const mockRaces2024 = [{ name: 'Human 2024' }];
const mockSpells = [{ name: 'Fireball' }];
const mockSpells2024 = [{ name: 'Fireball 2024' }];

function setupDefaults() {
  loadAbilityScores.mockResolvedValue(mockAbilityScores);
  loadClassData.mockImplementation((version) =>
    version === '2024'
      ? Promise.resolve(mockClasses2024)
      : Promise.resolve(mockClasses)
  );
  loadEquipment.mockResolvedValue(mockEquipment);
  loadMagicItems.mockResolvedValue(mockMagicItems);
  loadRaceData.mockImplementation((version) =>
    version === '2024'
      ? Promise.resolve(mockRaces2024)
      : Promise.resolve(mockRaces)
  );
  loadSpells.mockImplementation((version) =>
    version === '2024'
      ? Promise.resolve(mockSpells2024)
      : Promise.resolve(mockSpells)
  );
}

describe('useAppData', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaults();
  });

  describe('initial state', () => {
    it('returns empty arrays, null abilityScores, showButton false, and isLoading true before data loads', () => {
      // Block all loaders with a never-resolving promise so the hook never reaches the success/finalize path
      const neverResolving = new Promise(() => {});
      loadAbilityScores.mockReturnValue(neverResolving);
      loadClassData.mockReturnValue(neverResolving);
      loadEquipment.mockReturnValue(neverResolving);
      loadMagicItems.mockReturnValue(neverResolving);
      loadRaceData.mockReturnValue(neverResolving);
      loadSpells.mockReturnValue(neverResolving);

      const { result } = renderHook(() => useAppData());

      expect(result.current.abilityScores).toBeNull();
      expect(result.current.classes).toEqual([]);
      expect(result.current.classes2024).toEqual([]);
      expect(result.current.equipment).toEqual([]);
      expect(result.current.magicItems).toEqual([]);
      expect(result.current.races).toEqual([]);
      expect(result.current.races2024).toEqual([]);
      expect(result.current.spells).toEqual([]);
      expect(result.current.spells2024).toEqual([]);
      expect(result.current.showButton).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('successful data loading', () => {
    it('populates all data arrays after successful fetch and sets isLoading to false', async () => {
      const { result } = renderHook(() => useAppData());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.abilityScores).toEqual(mockAbilityScores);
      expect(result.current.classes).toEqual(mockClasses);
      expect(result.current.classes2024).toEqual(mockClasses2024);
      expect(result.current.equipment).toEqual(mockEquipment);
      expect(result.current.magicItems).toEqual(mockMagicItems);
      expect(result.current.races).toEqual(mockRaces);
      expect(result.current.races2024).toEqual(mockRaces2024);
      expect(result.current.spells).toEqual(mockSpells);
      expect(result.current.spells2024).toEqual(mockSpells2024);
      expect(result.current.showButton).toBe(true);
    });
  });

  describe('showButton logic', () => {
    it('is true when classes, equipment, and both spell sets are non-empty', async () => {
      const { result } = renderHook(() => useAppData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.showButton).toBe(true);
    });

    it('is false when any required data source is empty', async () => {
      loadClassData.mockImplementation((version) =>
        version === '2024'
          ? Promise.resolve(mockClasses2024)
          : Promise.resolve([])
      );

      const { result } = renderHook(() => useAppData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.showButton).toBe(false);
    });

    it('is false when equipment is empty', async () => {
      loadEquipment.mockResolvedValue([]);

      const { result } = renderHook(() => useAppData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.showButton).toBe(false);
    });
  });

  describe('error handling', () => {
    it('logs an error, keeps data at initial values, and sets isLoading to false when a loader rejects', async () => {
      const fetchError = new Error('Network error');
      loadSpells.mockImplementation((version) => {
        if (version === '2024') return Promise.resolve(mockSpells2024);
        return Promise.reject(fetchError);
      });

      const consoleErrorSpy = vi.spyOn(console, 'error');

      const { result } = renderHook(() => useAppData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch app data:',
        fetchError
      );
      expect(result.current.abilityScores).toBeNull();
      expect(result.current.classes).toEqual([]);
      expect(result.current.classes2024).toEqual([]);
      expect(result.current.equipment).toEqual([]);
      expect(result.current.magicItems).toEqual([]);
      expect(result.current.races).toEqual([]);
      expect(result.current.races2024).toEqual([]);
      expect(result.current.spells).toEqual([]);
      expect(result.current.spells2024).toEqual([]);
      expect(result.current.showButton).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });
});
