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
    loadAbilityScores,
    loadEquipment,
    loadMonsters,
    loadMagicItems,
    loadSpells,
    loadSkills,
    loadPassiveSkills,
    clearDataCache,
    getCacheState
} from './dataLoader.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a mock successful fetch response
function mockSuccessResponse(data, headersOverride) {
    const headers = headersOverride || new Map([['content-type', 'application/json']]);
    return {
        ok: true,
        status: 200,
        headers,
        json: async () => data
    };
}

// Helper to create a mock error fetch response
function mockErrorResponse(status = 500, headers) {
    return {
        ok: false,
        status,
        headers: headers || new Map([['content-type', 'text/html']]),
        json: async () => null
    };
}

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
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadClassData('5e');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/classes.json');
        });

        it('should load and cache class data for 2024', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadClassData('2024');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/2024/classes.json');
        });

        it('should return cached data on second call', async () => {
            const mockData = [{ name: 'Wizard' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            await loadClassData('5e');
            await loadClassData('5e');

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on fetch error', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadClassData('5e');

            expect(result).toEqual([]);
        });

        it('should return empty array on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadClassData('5e');

            expect(result).toEqual([]);
        });
    });

    describe('loadRaceData', () => {
        it('should load race data', async () => {
            const mockData = [{ name: 'Human', index: 'human' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadRaceData('5e');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/races.json');
        });
    });

    describe('loadBackgroundData', () => {
        it('should return empty array for 404 (optional data)', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(404));

            const result = await loadBackgroundData('5e');

            expect(result).toEqual([]);
        });

        it('should load background data when available', async () => {
            const mockData = [{ name: 'Acolyte', index: 'acolyte' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadBackgroundData('2024');

            expect(result).toEqual(mockData);
        });

        it('should return empty array on non-404 error even when optional', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadBackgroundData('5e');

            expect(result).toEqual([]);
        });
    });

    describe('loadFeatData', () => {
        it('should load feat data', async () => {
            const mockData = [{ name: 'Tough' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadFeatData('5e');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/feats.json');
        });
    });

    describe('loadValidationRules', () => {
        it('should load validation rules', async () => {
            const mockData = { '5e': { level_range: { min: 1, max: 20 } } };
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadValidationRules('5e');

            expect(result).toEqual({ level_range: { min: 1, max: 20 } });
        });

        it('should return data directly if not wrapped in version key', async () => {
            const mockData = { level_range: { min: 1, max: 20 } };
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

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
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchClassData('Wizard', '5e');

            expect(result).toEqual({ name: 'Wizard', index: 'wizard' });
        });

        it('should find class by index', async () => {
            const mockData = [
                { name: 'Wizard', index: 'wizard' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchClassData('wizard', '5e');

            expect(result).toEqual({ name: 'Wizard', index: 'wizard' });
        });

        it('should return null when class not found', async () => {
            const mockData = [
                { name: 'Wizard', index: 'wizard' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

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
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchRaceData('Human', '5e');

            expect(result).toEqual({ name: 'Human', index: 'human' });
        });

        it('should return null when race not found', async () => {
            const mockData = [
                { name: 'Human', index: 'human' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchRaceData('Elf', '5e');

            expect(result).toBeNull();
        });

        it('should return null when no race name provided', async () => {
            const result = await fetchRaceData('', '5e');

            expect(result).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
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
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('High Elf', '2024');

            expect(result).toEqual({ name: 'High Elf', traits: [] });
        });

        it('should find subrace in 5e format (top-level)', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'High Human', index: 'high-human' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('High Human', '5e');

            expect(result).toEqual({ name: 'High Human', index: 'high-human' });
        });

        it('should find subrace in 5e format by index', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'High Human', index: 'high-human' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('high-human', '5e');

            expect(result).toEqual({ name: 'High Human', index: 'high-human' });
        });

        it('should return null for 5e when subrace not found at top level', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'Elf', index: 'elf' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('Drow', '5e');

            expect(result).toBeNull();
        });

        it('should return null for 2024 when no races have subraces', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'Elf', index: 'elf' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('Wood Elf', '2024');

            expect(result).toBeNull();
        });

        it('should return null when subrace not found', async () => {
            const mockData = [
                { name: 'Elf', subraces: [{ name: 'High Elf' }] }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('Wood Elf', '2024');

            expect(result).toBeNull();
        });

        it('should return null when no subrace name provided', async () => {
            const result = await fetchSubraceData('', '2024');

            expect(result).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('fetchBackgroundData', () => {
        it('should find background by name', async () => {
            const mockData = [
                { name: 'Acolyte', index: 'acolyte' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchBackgroundData('Acolyte', '2024');

            expect(result).toEqual({ name: 'Acolyte', index: 'acolyte' });
        });

        it('should return null when background not found', async () => {
            const mockData = [
                { name: 'Acolyte', index: 'acolyte' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchBackgroundData('Charlatan', '2024');

            expect(result).toBeNull();
        });

        it('should return null when no background name provided', async () => {
            const result = await fetchBackgroundData('', '2024');

            expect(result).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('fetchFeatData', () => {
        it('should find feat by name', async () => {
            const mockData = [
                { name: 'Tough', index: 'tough' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchFeatData('Tough', '5e');

            expect(result).toEqual({ name: 'Tough', index: 'tough' });
        });

        it('should return null when feat not found', async () => {
            const mockData = [
                { name: 'Tough', index: 'tough' }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await fetchFeatData('Resilient', '5e');

            expect(result).toBeNull();
        });

        it('should return null when no feat name provided', async () => {
            const result = await fetchFeatData('', '5e');

            expect(result).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('loadAbilityScores', () => {
        it('should load ability scores successfully', async () => {
            const mockData = [
                { full_name: 'Strength', skills: ['Athletics'] }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadAbilityScores();

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/ability-scores.json');
        });

        it('should cache ability scores on subsequent calls', async () => {
            const mockData = [
                { full_name: 'Strength', skills: ['Athletics'] }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            await loadAbilityScores();
            const result2 = await loadAbilityScores();

            expect(result2).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should return fallback data on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadAbilityScores();

            expect(result).toHaveLength(6);
            expect(result[0].full_name).toBe('Strength');
            expect(result[5].full_name).toBe('Charisma');
            expect(result[2].full_name).toBe('Constitution');
        });

        it('should return fallback data on non-ok response', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadAbilityScores();

            expect(result).toHaveLength(6);
            expect(result[0].full_name).toBe('Strength');
        });
    });

    describe('loadEquipment', () => {
        it('should load equipment successfully', async () => {
            const mockData = [{ name: 'Club', type: 'weapon' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadEquipment();

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/equipment.json');
        });

        it('should cache equipment data', async () => {
            const mockData = [{ name: 'Club', type: 'weapon' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            await loadEquipment();
            await loadEquipment();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on error', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadEquipment();

            expect(result).toEqual([]);
        });

        it('should return empty array on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadEquipment();

            expect(result).toEqual([]);
        });
    });

    describe('loadMonsters', () => {
        it('should load monsters successfully', async () => {
            const mockData = [{ name: 'Goblin', cr: '1/4' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadMonsters();

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/2024/monsters.json');
        });

        it('should cache monsters data', async () => {
            const mockData = [{ name: 'Goblin', cr: '1/4' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            await loadMonsters();
            await loadMonsters();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on error', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadMonsters();

            expect(result).toEqual([]);
        });

        it('should return empty array on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadMonsters();

            expect(result).toEqual([]);
        });
    });

    describe('loadMagicItems', () => {
         it('should load magic items (merged, version agnostic)', async () => {
             const mockData = [{ name: 'Bag of Holding' }];
             mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

             const result = await loadMagicItems();

             expect(result).toEqual(mockData);
             expect(mockFetch).toHaveBeenCalledWith('/data/magic-items.json');
          });

         it('should cache magic items on subsequent calls', async () => {
             const mockData = [{ name: 'Bag of Holding' }];
             mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

             await loadMagicItems();
             await loadMagicItems();

             expect(mockFetch).toHaveBeenCalledTimes(1);
          });

        it('should return empty array on error', async () => {
              mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadMagicItems();

           expect(result).toEqual([]);
          });

          it('should return empty array on network error', async () => {
          mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadMagicItems();

            expect(result).toEqual([]);
            });
      });

    describe('loadSpells', () => {
        it('should load spells for 5e', async () => {
            const mockData = [{ name: 'Fireball', level: 3 }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadSpells('5e');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/spells.json');
        });

        it('should load spells for 2024', async () => {
            const mockData = [{ name: 'Fireball', level: 3 }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadSpells('2024');

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/2024/spells.json');
        });

        it('should cache spells per version', async () => {
            const mockData5e = [{ name: 'Fireball', level: 3 }];
            const mockData2024 = [{ name: 'Magic Missile', level: 1 }];
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse(mockData5e))
                .mockResolvedValueOnce(mockSuccessResponse(mockData2024));

            await loadSpells('5e');
            await loadSpells('2024');
            await loadSpells('5e');
            await loadSpells('2024');

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should return empty array on error', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadSpells('5e');

            expect(result).toEqual([]);
        });

        it('should return empty array on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadSpells('5e');

            expect(result).toEqual([]);
        });
    });

    describe('loadSkills', () => {
        it('should derive skills from ability scores', async () => {
            const abilityData = [
                { full_name: 'Strength', skills: ['Athletics'] },
                { full_name: 'Intelligence', skills: ['Arcana', 'History'] }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(abilityData));

            const result = await loadSkills();

            expect(result).toEqual([
                { name: 'Athletics', ability: 'Strength' },
                { name: 'Arcana', ability: 'Intelligence' },
                { name: 'History', ability: 'Intelligence' }
            ]);
            expect(mockFetch).toHaveBeenCalledWith('/data/ability-scores.json');
        });

        it('should cache skills after first load', async () => {
            const abilityData = [
                { full_name: 'Strength', skills: ['Athletics'] }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(abilityData));

            await loadSkills();
            await loadSkills();

            // Should only fetch ability scores once
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should derive skills from fallback ability scores on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadSkills();

            // loadAbilityScores returns its own hardcoded fallback on error,
            // then loadSkills derives the full 18 skills from it
            expect(result).toHaveLength(18);
            expect(result[0]).toEqual({ name: 'Athletics', ability: 'Strength' });
            expect(result[17]).toEqual({ name: 'Persuasion', ability: 'Charisma' });
        });

        it('should derive skills from fallback ability scores on non-ok response', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadSkills();

            // loadAbilityScores returns its own hardcoded fallback on 500,
            // then loadSkills derives the full 18 skills from it
            expect(result).toHaveLength(18);
            expect(result[0]).toEqual({ name: 'Athletics', ability: 'Strength' });
        });

        it('should use hardcoded fallback when ability data has null skills', async () => {
            // Return ability data where one entry has null skills
            // This causes .forEach to throw inside loadSkills, triggering its catch/fallback
            const malformedData = [
                { full_name: 'Strength', skills: null },
                { full_name: 'Dexterity', skills: null }
            ];
            mockFetch.mockResolvedValue(mockSuccessResponse(malformedData));

            const result = await loadSkills();

            // Should fall through to the hardcoded fallback skills array
            expect(result).toHaveLength(18);
            expect(result[0]).toEqual({ name: 'Acrobatics', ability: 'Dexterity' });
            expect(result[17]).toEqual({ name: 'Survival', ability: 'Wisdom' });
        });
    });

    describe('loadPassiveSkills', () => {
        it('should load passive skills successfully', async () => {
            const mockData = ['Insight', 'Investigation', 'Perception'];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadPassiveSkills();

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/passive-skills.json');
        });

        it('should cache passive skills', async () => {
            const mockData = ['Insight', 'Investigation', 'Perception'];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            await loadPassiveSkills();
            await loadPassiveSkills();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should return fallback passive skills on error', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(500));

            const result = await loadPassiveSkills();

            expect(result).toEqual(['Insight', 'Investigation', 'Perception']);
        });

        it('should return fallback passive skills on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await loadPassiveSkills();

            expect(result).toEqual(['Insight', 'Investigation', 'Perception']);
        });
    });

    describe('clearDataCache', () => {
        it('should clear all cached data including shared caches', async () => {
            const mockData = [{ name: 'Wizard' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

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

        it('should also clear shared data caches', async () => {
            const mockAbilityData = [{ full_name: 'Strength', skills: ['Athletics'] }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockAbilityData));

            await loadAbilityScores();
            await loadSkills();

            clearDataCache();

            // After clearing, loading again should trigger fetch
            mockFetch.mockResolvedValue(mockSuccessResponse(mockAbilityData));
            await loadAbilityScores();

            // First call was initial load, second call should have occurred after cache clear
            expect(mockFetch).toHaveBeenCalledTimes(2);
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
            expect(getCacheState()).not.toHaveProperty('magicItems');
            expect(cacheState['5e']).toHaveProperty('spells');
        });

        it('should return a deep copy of cache state', () => {
            const cacheState = getCacheState();
            cacheState['5e'].classes = 'modified';

            const cacheState2 = getCacheState();
            expect(cacheState2['5e'].classes).toBeNull();
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

        it('should handle non-JSON response with optional data', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'text/html']]),
                json: async () => ({})
            });

            const result = await loadBackgroundData('5e');

            expect(result).toEqual([]);
        });

        it('should handle missing content-type header', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map(),
                json: async () => ({})
            });

            const result = await loadClassData('5e');

            expect(result).toEqual([]);
        });
    });

    describe('edge cases', () => {
        it('should handle invalid version by falling back to 5e', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadClassData(undefined);

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/classes.json');
        });

        it('should handle null version by falling back to 5e', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            mockFetch.mockResolvedValue(mockSuccessResponse(mockData));

            const result = await loadClassData(null);

            expect(result).toEqual(mockData);
            expect(mockFetch).toHaveBeenCalledWith('/data/classes.json');
        });

        it('should cache independently for 5e and 2024', async () => {
            const mockData5e = [{ name: 'Wizard 5e' }];
            const mockData2024 = [{ name: 'Wizard 2024' }];
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse(mockData5e))
                .mockResolvedValueOnce(mockSuccessResponse(mockData2024));

            const result5e = await loadClassData('5e');
            const result2024 = await loadClassData('2024');

            expect(result5e).toEqual(mockData5e);
            expect(result2024).toEqual(mockData2024);

            // Re-fetching should use cache for both
            const result5eAgain = await loadClassData('5e');
            const result2024Again = await loadClassData('2024');

            expect(result5eAgain).toEqual(mockData5e);
            expect(result2024Again).toEqual(mockData2024);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should handle empty JSON array response', async () => {
            mockFetch.mockResolvedValue(mockSuccessResponse([]));

            const result = await loadClassData('5e');

            expect(result).toEqual([]);
        });

        it('should handle response with content-type as plain object property', async () => {
            const mockData = [{ name: 'Wizard' }];
            // Use plain object headers - .get is undefined, falls through to bracket notation
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: { 'content-type': 'application/json' },
                json: async () => mockData
            });

            const result = await loadClassData('5e');

            expect(result).toEqual(mockData);
        });

        it('should handle optional data with non-JSON response', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'text/plain']]),
                json: async () => null
            });

            const result = await loadBackgroundData('5e');

            expect(result).toEqual([]);
        });

        it('should cache empty result for optional 404 to avoid re-fetching', async () => {
            mockFetch.mockResolvedValue(mockErrorResponse(404));

            await loadBackgroundData('5e');
            await loadBackgroundData('5e');

            // Should only fetch once despite empty result
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });
});
