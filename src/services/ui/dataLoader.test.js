// @cleaned-by-ai
// @improved-by-ai
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
    loadManeuvers,
    clearDataCache,
    getCacheState
} from './dataLoader.js';

// Silence console.error produced by the source's error logging
const originalError = console.error;
beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    console.error = originalError;
});

// Helper to create a mock successful fetch response
function mockSuccessResponse(data, contentType = 'application/json') {
    return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', contentType]]),
        json: async () => data
    };
}

// Helper to create a mock error fetch response
function mockErrorResponse(status = 500, contentType = 'text/html') {
    return {
        ok: false,
        status,
        headers: new Map([['content-type', contentType]]),
        json: async () => null
    };
}

describe('dataLoader', () => {
    beforeEach(() => {
        vi.spyOn(global, 'fetch').mockResolvedValue(mockErrorResponse(500));
        clearDataCache();
    });

    afterEach(() => {
        clearDataCache();
        vi.restoreAllMocks();
    });

    describe('loadClassData', () => {
        it('returns class data and caches it', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadClassData('5e');
            expect(result1).toEqual(mockData);

            const result2 = await loadClassData('5e');
            expect(result2).toEqual(mockData);
        });

        it('uses 2024 data path for 2024 ruleset', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadClassData('2024');
            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/data/2024/classes.json');
        });

        it('falls back to 5e path for invalid or undefined version', async () => {
            const mockData = [{ name: 'Wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadClassData('invalid');
            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/data/classes.json');
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadClassData('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadRaceData', () => {
        it('returns race data and caches it', async () => {
            const mockData = [{ name: 'Human', index: 'human' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadRaceData('5e');
            expect(result).toEqual(mockData);

            const cached = await loadRaceData('5e');
            expect(cached).toEqual(mockData);
        });

        it('uses 2024 data path for 2024 ruleset', async () => {
            const mockData = [{ name: 'Human' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            await loadRaceData('2024');
            expect(global.fetch).toHaveBeenCalledWith('/data/2024/races.json');
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadRaceData('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadBackgroundData', () => {
        it('loads background data when available', async () => {
            const mockData = [{ name: 'Acolyte', index: 'acolyte' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadBackgroundData('2024');
            expect(result).toEqual(mockData);
        });

        it('returns empty array on 404 (optional data)', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(404));

            const result = await loadBackgroundData('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadFeatData', () => {
        it('returns feat data and caches it', async () => {
            const mockData = [{ name: 'Tough', index: 'tough' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadFeatData('5e');
            expect(result).toEqual(mockData);

            const cached = await loadFeatData('5e');
            expect(cached).toEqual(mockData);
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadFeatData('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadValidationRules', () => {
        it('returns data directly when not wrapped in version key', async () => {
            const mockData = { level_range: { min: 1, max: 20 } };
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadValidationRules('5e');
            expect(result).toEqual(mockData);
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadValidationRules('5e');
            expect(result).toEqual([]);
        });
    });

    describe('fetchClassData', () => {
        it('finds class by name', async () => {
            const mockData = [
                { name: 'Wizard', index: 'wizard' },
                { name: 'Sorcerer', index: 'sorcerer' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchClassData('Wizard', '5e');
            expect(result).toEqual({ name: 'Wizard', index: 'wizard' });
        });

        it('returns null when class not found or className is empty', async () => {
            const mockData = [
                { name: 'Wizard', index: 'wizard' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchClassData('Fighter', '5e');
            expect(result).toBeNull();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            const emptyResult = await fetchClassData('', '5e');
            expect(emptyResult).toBeNull();
            // Empty string returns null early without fetching
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('fetchRaceData', () => {
        it('finds race by name or index (case-insensitive)', async () => {
            const mockData = [
                { name: 'Human', index: 'human' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchRaceData('Human', '5e');
            expect(result).toEqual({ name: 'Human', index: 'human' });
        });

        it('returns null when race not found or raceName is empty', async () => {
            const mockData = [
                { name: 'Human', index: 'human' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchRaceData('Elf', '5e');
            expect(result).toBeNull();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            const emptyResult = await fetchRaceData('', '5e');
            expect(emptyResult).toBeNull();
            // Empty string returns null early without fetching
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('fetchSubraceData', () => {
        it('finds nested subrace in 2024 format', async () => {
            const mockData = [
                {
                    name: 'Elf',
                    subraces: [
                        { name: 'High Elf', traits: [] }
                    ]
                }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('High Elf', '2024');
            expect(result).toEqual({ name: 'High Elf', traits: [] });
        });

        it('finds top-level subrace in 5e format by name or index', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'High Human', index: 'high-human' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('High Human', '5e');
            expect(result).toEqual({ name: 'High Human', index: 'high-human' });
        });

        it('returns null when subrace not found or subraceName is empty', async () => {
            const mockData = [
                {
                    name: 'Elf',
                    subraces: [{ name: 'High Elf' }]
                }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('Wood Elf', '2024');
            expect(result).toBeNull();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            const emptyResult = await fetchSubraceData('', '2024');
            expect(emptyResult).toBeNull();
            // Empty string returns null early without fetching
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('fetchBackgroundData', () => {
        it('finds background by name or index (case-insensitive)', async () => {
            const mockData = [
                { name: 'Acolyte', index: 'acolyte' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchBackgroundData('Acolyte', '2024');
            expect(result).toEqual({ name: 'Acolyte', index: 'acolyte' });
        });

        it('returns null when background not found or backgroundName is empty', async () => {
            const mockData = [
                { name: 'Acolyte', index: 'acolyte' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchBackgroundData('Charlatan', '2024');
            expect(result).toBeNull();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            const emptyResult = await fetchBackgroundData('', '2024');
            expect(emptyResult).toBeNull();
            // Empty string returns null early without fetching
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('fetchFeatData', () => {
        it('finds feat by name or index (case-insensitive)', async () => {
            const mockData = [
                { name: 'Tough', index: 'tough' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchFeatData('Tough', '5e');
            expect(result).toEqual({ name: 'Tough', index: 'tough' });
        });

        it('returns null when feat not found or featName is empty', async () => {
            const mockData = [
                { name: 'Tough', index: 'tough' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchFeatData('Resilient', '5e');
            expect(result).toBeNull();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            const emptyResult = await fetchFeatData('', '5e');
            expect(emptyResult).toBeNull();
            // Empty string returns null early without fetching
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadAbilityScores', () => {
        it('loads ability scores and caches them', async () => {
            const mockData = [
                { full_name: 'Strength', skills: ['Athletics'] },
                { full_name: 'Dexterity', skills: ['Acrobatics'] }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadAbilityScores();
            expect(result1).toEqual(mockData);

            const result2 = await loadAbilityScores();
            expect(result2).toEqual(mockData);
        });

        it('returns fallback data on network error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await loadAbilityScores();

            expect(result).toHaveLength(6);
            expect(result[0].full_name).toBe('Strength');
            expect(result[5].full_name).toBe('Charisma');
        });
    });

    describe('loadEquipment', () => {
        it('loads equipment and caches it', async () => {
            const mockData = [{ name: 'Club', type: 'weapon' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadEquipment();
            expect(result1).toEqual(mockData);

            const result2 = await loadEquipment();
            expect(result2).toEqual(mockData);
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadEquipment();
            expect(result).toEqual([]);
        });
    });

    describe('loadMonsters', () => {
        it('loads monsters and caches them', async () => {
            const mockData = [{ name: 'Goblin', cr: '1/4' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadMonsters();
            expect(result1).toEqual(mockData);

            const result2 = await loadMonsters();
            expect(result2).toEqual(mockData);
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadMonsters();
            expect(result).toEqual([]);
        });
    });

    describe('loadMagicItems', () => {
        it('loads magic items and caches them', async () => {
            const mockData = [{ name: 'Bag of Holding' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadMagicItems();
            expect(result1).toEqual(mockData);

            const result2 = await loadMagicItems();
            expect(result2).toEqual(mockData);
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadMagicItems();
            expect(result).toEqual([]);
        });
    });

    describe('loadSpells', () => {
        it('caches spells independently per version', async () => {
            const mockData5e = [{ name: 'Fireball', level: 3 }];
            const mockData2024 = [{ name: 'Magic Missile', level: 1 }];
            global.fetch
                .mockResolvedValueOnce(mockSuccessResponse(mockData5e))
                .mockResolvedValueOnce(mockSuccessResponse(mockData2024));

            const result5e = await loadSpells('5e');
            const result2024 = await loadSpells('2024');
            expect(result5e).toEqual(mockData5e);
            expect(result2024).toEqual(mockData2024);

            // Re-fetching should use cache
            const result5eAgain = await loadSpells('5e');
            const result2024Again = await loadSpells('2024');
            expect(result5eAgain).toEqual(mockData5e);
            expect(result2024Again).toEqual(mockData2024);
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadSpells('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadSkills', () => {
        it('derives skills from ability scores', async () => {
            const abilityData = [
                { full_name: 'Strength', skills: ['Athletics'] },
                { full_name: 'Intelligence', skills: ['Arcana', 'History'] }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(abilityData));

            const result = await loadSkills();

            expect(result).toEqual([
                { name: 'Athletics', ability: 'Strength' },
                { name: 'Arcana', ability: 'Intelligence' },
                { name: 'History', ability: 'Intelligence' }
            ]);
        });

        it('returns fallback skills on network error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await loadSkills();

            expect(result).toHaveLength(18);
            expect(result[0]).toEqual({ name: 'Athletics', ability: 'Strength' });
            expect(result[17]).toEqual({ name: 'Persuasion', ability: 'Charisma' });
        });
    });

    describe('loadPassiveSkills', () => {
        it('loads passive skills and caches them', async () => {
            const mockData = ['Insight', 'Investigation', 'Perception'];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadPassiveSkills();
            expect(result1).toEqual(mockData);

            const result2 = await loadPassiveSkills();
            expect(result2).toEqual(mockData);
        });

        it('returns fallback passive skills on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadPassiveSkills();
            expect(result).toEqual(['Insight', 'Investigation', 'Perception']);
        });
    });

    describe('loadManeuvers', () => {
        it('loads maneuvers and caches them', async () => {
            const mockData = [{ name: 'Action Surge' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadManeuvers('5e');
            expect(result1).toEqual(mockData);

            const result2 = await loadManeuvers('5e');
            expect(result2).toEqual(mockData);
        });

        it('returns empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadManeuvers('5e');
            expect(result).toEqual([]);
        });
    });

    describe('clearDataCache', () => {
        it('clears versioned cache entries', async () => {
            const mockData = [{ name: 'Wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            await loadClassData('5e');

            const cacheState = getCacheState();
            expect(cacheState['5e'].classes).toEqual(mockData);

            clearDataCache();

            const clearedCache = getCacheState();
            expect(clearedCache['5e'].classes).toBeNull();
        });

        it('clears shared data caches', async () => {
            const mockAbilityData = [{ full_name: 'Strength', skills: ['Athletics'] }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockAbilityData));

            await loadAbilityScores();
            await loadSkills();

            clearDataCache();

            // After clearing, loading should trigger a fresh fetch
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockAbilityData));
            await loadAbilityScores();

            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

});
