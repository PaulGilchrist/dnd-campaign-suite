import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
    loadClassData, 
    loadRaceData, 
    loadBackgroundData, 
    loadFeatData, 
    loadValidationRules,
    fetchClassData,
    fetchRaceData,
    fetchSubraceData,
    fetchBackgroundData,
    fetchFeatData,
    clearDataCache,
    getCacheState
} from './dataLoader.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('dataLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearDataCache();
      });

    afterEach(() => {
        vi.restoreAllMocks();
      });

    describe('loadClassData', () => {
        it('should load and cache class data for 5e', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await loadClassData('5e');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/classes.json');
          });

        it('should load and cache class data for 2024', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await loadClassData('2024');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/2024/classes.json');
          });

        it('should return cached data on second call', async () => {
            const mockData = [{ name: 'Wizard' }];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            await loadClassData('5e');
            await loadClassData('5e');

            expect(mockFetch).toHaveBeenCalledTimes(1);
          });

        it('should return empty array on error', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500
               });

            const result = await loadClassData('5e');

            expect(result).toEqual([]);
          });
      });

    describe('loadRaceData', () => {
        it('should load race data', async () => {
            const mockData = [{ name: 'Human', index: 'human' }];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await loadRaceData('5e');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/races.json');
          });
      });

    describe('loadBackgroundData', () => {
        it('should return empty array for 404 (optional data)', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404
               });

            const result = await loadBackgroundData('5e');

            expect(result).toEqual([]);
          });

        it('should load background data when available', async () => {
            const mockData = [{ name: 'Acolyte', index: 'acolyte' }];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await loadBackgroundData('2024');

            expect(result).toEqual(mockData);
          });
      });

    describe('loadFeatData', () => {
        it('should load feat data', async () => {
            const mockData = [{ name: 'Tough' }];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await loadFeatData('5e');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/feats.json');
          });
      });

    describe('loadValidationRules', () => {
        it('should load validation rules', async () => {
            const mockData = { '5e': { level_range: { min: 1, max: 20 } } };
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await loadValidationRules('5e');

            expect(result).toEqual({ level_range: { min: 1, max: 20 } });
          });

        it('should return data directly if not wrapped in version key', async () => {
            const mockData = { level_range: { min: 1, max: 20 } };
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await loadValidationRules('5e');

            expect(result).toEqual(mockData);
          });
      });

    describe('fetchClassData', () => {
        it('should find class by name', async () => {
            const mockData = [
                  { name: 'Wizard', index: 'wizard' },
                  { name: 'Sorcerer', index: 'sorcerer' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchClassData('Wizard', '5e');

            expect(result).toEqual({ name: 'Wizard', index: 'wizard' });
          });

        it('should find class by index', async () => {
            const mockData = [
                  { name: 'Wizard', index: 'wizard' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchClassData('wizard', '5e');

            expect(result).toEqual({ name: 'Wizard', index: 'wizard' });
          });

        it('should return null when class not found', async () => {
            const mockData = [
                  { name: 'Wizard', index: 'wizard' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchClassData('Fighter', '5e');

            expect(result).toBeNull();
          });

        it('should return null when no class name provided', async () => {
            const result = await fetchClassData('', '5e');

            expect(result).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
          });
      });

    describe('fetchRaceData', () => {
        it('should find race by name', async () => {
            const mockData = [
                  { name: 'Human', index: 'human' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchRaceData('Human', '5e');

            expect(result).toEqual({ name: 'Human', index: 'human' });
          });

        it('should return null when race not found', async () => {
            const mockData = [
                  { name: 'Human', index: 'human' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchRaceData('Elf', '5e');

            expect(result).toBeNull();
          });
      });

    describe('fetchSubraceData', () => {
        it('should find subrace in 2024 format (nested)', async () => {
            const mockData = [
                  {
                    name: 'Elf',
                    subraces: [
                          { name: 'High Elf', traits: [] }
                       ]
                   }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchSubraceData('High Elf', '2024');

            expect(result).toEqual({ name: 'High Elf', traits: [] });
          });

        it('should find subrace in 5e format (top-level)', async () => {
            const mockData = [
                  { name: 'Human', index: 'human' },
                  { name: 'High Human', index: 'high-human' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchSubraceData('High Human', '5e');

            expect(result).toEqual({ name: 'High Human', index: 'high-human' });
          });

        it('should return null when subrace not found', async () => {
            const mockData = [
                  { name: 'Elf', subraces: [{ name: 'High Elf' }] }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchSubraceData('Wood Elf', '2024');

            expect(result).toBeNull();
          });
      });

    describe('fetchBackgroundData', () => {
        it('should find background by name', async () => {
            const mockData = [
                  { name: 'Acolyte', index: 'acolyte' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchBackgroundData('Acolyte', '2024');

            expect(result).toEqual({ name: 'Acolyte', index: 'acolyte' });
          });

        it('should return null when background not found', async () => {
            const mockData = [
                  { name: 'Acolyte', index: 'acolyte' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchBackgroundData('Charlatan', '2024');

            expect(result).toBeNull();
          });
      });

    describe('fetchFeatData', () => {
        it('should find feat by name', async () => {
            const mockData = [
                  { name: 'Tough', index: 'tough' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchFeatData('Tough', '5e');

            expect(result).toEqual({ name: 'Tough', index: 'tough' });
          });

        it('should return null when feat not found', async () => {
            const mockData = [
                  { name: 'Tough', index: 'tough' }
               ];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            const result = await fetchFeatData('Resilient', '5e');

            expect(result).toBeNull();
          });
      });

    describe('clearDataCache', () => {
        it('should clear all cached data', async () => {
            const mockData = [{ name: 'Wizard' }];
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockData
               });

            // Load data to cache it
            await loadClassData('5e');
            
            // Check cache state
            const cacheState = getCacheState();
            expect(cacheState['5e'].classes).toEqual(mockData);

            // Clear cache
            clearDataCache();
            
            // Check cache is cleared
            const clearedCache = getCacheState();
            expect(clearedCache['5e'].classes).toBeNull();
          });
      });

    describe('getCacheState', () => {
        it('should return current cache state', () => {
            const cacheState = getCacheState();

            expect(cacheState).toHaveProperty('5e');
            expect(cacheState).toHaveProperty('2024');
            expect(cacheState['5e']).toHaveProperty('classes');
            expect(cacheState['5e']).toHaveProperty('races');
            expect(cacheState['5e']).toHaveProperty('backgrounds');
            expect(cacheState['5e']).toHaveProperty('feats');
            expect(cacheState['5e']).toHaveProperty('rules-validation');
          });
      });

    describe('error handling', () => {
        it('should handle non-JSON response', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'text/html']]),
                json: async () => ({})
               });

            const result = await loadClassData('5e');

            expect(result).toEqual([]);
          });

        it('should handle network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadClassData('5e');

            expect(result).toEqual([]);
          });
      });
});
