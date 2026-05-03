import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAppData from './use-app-data';

const mockData = {
   '/data/ability-scores.json': [{ name: 'Strength' }],
   '/data/classes.json': [{ name: 'Fighter' }],
   '/data/2024/classes.json': [{ name: 'Fighter 2024' }],
   '/data/equipment.json': [{ name: 'Sword' }],
   '/data/magic-items.json': [{ name: 'Wand' }],
   '/data/2024/magic-items.json': [{ name: 'Wand 2024' }],
   '/data/races.json': [{ name: 'Human' }],
   '/data/2024/races.json': [{ name: 'Human 2024' }],
   '/data/spells.json': [{ name: 'Fireball' }],
   '/data/2024/spells.json': [{ name: 'Fireball 2024' }],
};

function createMockFetch(responseMap = mockData) {
   const mockFetch = vi.fn();
   mockFetch.mockImplementation((url) => {
      const data = responseMap[url];
      if (data !== undefined) {
         return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(data),
         });
      }
      return Promise.reject(new Error(`Not found: ${url}`));
   });
   return mockFetch;
}

describe('useAppData', () => {
   beforeEach(() => {
      vi.restoreAllMocks();
   });

   it('should initialize with empty arrays, null abilityScores, showButton false, and isLoading true', () => {
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => { /* never resolves */ }));

      const { result } = renderHook(() => useAppData());

      expect(result.current.abilityScores).toBeNull();
      expect(result.current.classes).toEqual([]);
      expect(result.current.classes2024).toEqual([]);
      expect(result.current.equipment).toEqual([]);
      expect(result.current.magicItems).toEqual([]);
      expect(result.current.magicItems2024).toEqual([]);
      expect(result.current.races).toEqual([]);
      expect(result.current.races2024).toEqual([]);
      expect(result.current.spells).toEqual([]);
      expect(result.current.spells2024).toEqual([]);
      expect(result.current.showButton).toBe(false);
      expect(result.current.isLoading).toBe(true);
   });

   it('should populate all data arrays after successful fetch and set isLoading to false', async () => {
      global.fetch = createMockFetch();

      const { result } = renderHook(() => useAppData());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.abilityScores).toEqual([{ name: 'Strength' }]);
      expect(result.current.classes).toEqual([{ name: 'Fighter' }]);
      expect(result.current.classes2024).toEqual([{ name: 'Fighter 2024' }]);
      expect(result.current.equipment).toEqual([{ name: 'Sword' }]);
      expect(result.current.magicItems).toEqual([{ name: 'Wand' }]);
      expect(result.current.magicItems2024).toEqual([{ name: 'Wand 2024' }]);
      expect(result.current.races).toEqual([{ name: 'Human' }]);
      expect(result.current.races2024).toEqual([{ name: 'Human 2024' }]);
      expect(result.current.spells).toEqual([{ name: 'Fireball' }]);
      expect(result.current.spells2024).toEqual([{ name: 'Fireball 2024' }]);
      expect(result.current.showButton).toBe(true);
   });

   it('showButton is false when classes is empty', async () => {
      global.fetch = createMockFetch({
         ...mockData,
         '/data/classes.json': [],
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
      global.fetch = createMockFetch({
         ...mockData,
         '/data/equipment.json': [],
      });

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
      global.fetch = createMockFetch({
         ...mockData,
         '/data/spells.json': [],
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
      global.fetch = createMockFetch({
         ...mockData,
         '/data/2024/spells.json': [],
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
      const failingUrl = '/data/spells.json';
      const mockFetch = vi.fn();
      mockFetch.mockImplementation((url) => {
         if (url === failingUrl) {
            return Promise.reject(new Error('Network error'));
         }
         const data = mockData[url];
         if (data !== undefined) {
            return Promise.resolve({
               ok: true,
               json: () => Promise.resolve(data),
            });
         }
         return Promise.reject(new Error(`Not found: ${url}`));
      });

      global.fetch = mockFetch;
      console.error = vi.fn();

      const { result } = renderHook(() => useAppData());

      await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
      });

      expect(console.error).toHaveBeenCalled();
      expect(result.current.classes.length).toBe(0);
      expect(result.current.equipment.length).toBe(0);
      expect(result.current.spells.length).toBe(0);
      expect(result.current.showButton).toBe(false);
   });

   it('should call all 10 fetches in a single batch via one useEffect', async () => {
      global.fetch = createMockFetch();
      const { result } = renderHook(() => useAppData());

      expect(global.fetch).toHaveBeenCalledTimes(10);

      expect(global.fetch).toHaveBeenCalledWith('/data/ability-scores.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/classes.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/2024/classes.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/equipment.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/magic-items.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/2024/magic-items.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/races.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/2024/races.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/spells.json');
      expect(global.fetch).toHaveBeenCalledWith('/data/2024/spells.json');

      await waitFor(() => {
         expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(10);
   });
});