import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/dataLoader.js', () => ({
  loadAbilityScores: vi.fn(),
  loadClassData: vi.fn(),
  loadEquipment: vi.fn(),
  loadMagicItems: vi.fn(),
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
} from '../services/dataLoader.js';

const mockAbilityScores = [{ name: 'Strength' }];
const mockClasses = [{ name: 'Fighter' }];
const mockClasses2024 = [{ name: 'Fighter 2024' }];
const mockEquipment = [{ name: 'Sword' }];
const mockMagicItems = [{ name: 'Wand' }];
const mockRaces = [{ name: 'Human' }];
const mockRaces2024 = [{ name: 'Human 2024' }];
const mockSpells = [{ name: 'Fireball' }];
const mockSpells2024 = [{ name: 'Fireball 2024' }];

describe('useAppData', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    loadAbilityScores.mockResolvedValue(mockAbilityScores);
    loadClassData.mockImplementation((version) => {
      if (version === '2024') return Promise.resolve(mockClasses2024);
      return Promise.resolve(mockClasses);
    });
    loadEquipment.mockResolvedValue(mockEquipment);
    loadMagicItems.mockResolvedValue(mockMagicItems);
    loadRaceData.mockImplementation((version) => {
      if (version === '2024') return Promise.resolve(mockRaces2024);
      return Promise.resolve(mockRaces);
    });
    loadSpells.mockImplementation((version) => {
      if (version === '2024') return Promise.resolve(mockSpells2024);
      return Promise.resolve(mockSpells);
    });
  });

  it('should initialize with empty arrays, null abilityScores, showButton false, and isLoading true', () => {
    loadAbilityScores.mockImplementation(() => new Promise(() => {}));
    loadClassData.mockImplementation(() => new Promise(() => {}));
    loadEquipment.mockImplementation(() => new Promise(() => {}));
    loadMagicItems.mockImplementation(() => new Promise(() => {}));
    loadRaceData.mockImplementation(() => new Promise(() => {}));
    loadSpells.mockImplementation(() => new Promise(() => {}));

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

  it('should populate all data arrays after successful fetch and set isLoading to false', async () => {
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

  it('showButton is false when classes is empty', async () => {
    loadClassData.mockImplementation((version) => {
      if (version === '2024') return Promise.resolve(mockClasses2024);
      return Promise.resolve([]);
    });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.classes.length).toBe(0);
    expect(result.current.equipment.length).toBeGreaterThan(0);
    expect(result.current.spells.length).toBeGreaterThan(0);
    expect(result.current.spells2024.length).toBeGreaterThan(0);
    expect(result.current.showButton).toBe(false);
  });

  it('showButton is false when equipment is empty', async () => {
    loadEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useAppData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.classes.length).toBeGreaterThan(0);
    expect(result.current.equipment.length).toBe(0);
    expect(result.current.spells.length).toBeGreaterThan(0);
    expect(result.current.spells2024.length).toBeGreaterThan(0);
    expect(result.current.showButton).toBe(false);
  });

  it('showButton is false when spells is empty', async () => {
    loadSpells.mockImplementation((version) => {
      if (version === '2024') return Promise.resolve(mockSpells2024);
      return Promise.resolve([]);
    });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.classes.length).toBeGreaterThan(0);
    expect(result.current.equipment.length).toBeGreaterThan(0);
    expect(result.current.spells.length).toBe(0);
    expect(result.current.spells2024.length).toBeGreaterThan(0);
    expect(result.current.showButton).toBe(false);
  });

  it('showButton is false when spells2024 is empty', async () => {
    loadSpells.mockImplementation((version) => {
      if (version === '2024') return Promise.resolve([]);
      return Promise.resolve(mockSpells);
    });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.classes.length).toBeGreaterThan(0);
    expect(result.current.equipment.length).toBeGreaterThan(0);
    expect(result.current.spells.length).toBeGreaterThan(0);
    expect(result.current.spells2024.length).toBe(0);
    expect(result.current.showButton).toBe(false);
  });

  it('should handle fetch failure gracefully with data remaining empty and isLoading becoming false', async () => {
    loadSpells.mockImplementation((version) => {
      if (version === '2024') return Promise.resolve(mockSpells2024);
      return Promise.reject(new Error('Network error'));
    });

    console.error = vi.fn();

    const { result } = renderHook(() => useAppData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(console.error).toHaveBeenCalled();
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
  });

  it('should call all data-loader functions in a single batch via one useEffect', async () => {
    const { result } = renderHook(() => useAppData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(loadAbilityScores).toHaveBeenCalledTimes(1);
    expect(loadClassData).toHaveBeenCalledTimes(2);
    expect(loadClassData).toHaveBeenCalledWith('5e');
    expect(loadClassData).toHaveBeenCalledWith('2024');
    expect(loadEquipment).toHaveBeenCalledTimes(1);
    expect(loadMagicItems).toHaveBeenCalledTimes(1);
    expect(loadRaceData).toHaveBeenCalledTimes(2);
    expect(loadRaceData).toHaveBeenCalledWith('5e');
    expect(loadRaceData).toHaveBeenCalledWith('2024');
    expect(loadSpells).toHaveBeenCalledTimes(2);
    expect(loadSpells).toHaveBeenCalledWith('5e');
    expect(loadSpells).toHaveBeenCalledWith('2024');
  });
});
