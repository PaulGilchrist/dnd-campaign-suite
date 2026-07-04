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
    loadSpellData,
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
        it('should return class data and cache it', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadClassData('5e');
            expect(result1).toEqual(mockData);

            // Second call should use cache
            const result2 = await loadClassData('5e');
            expect(result2).toEqual(mockData);
        });

        it('should use 2024 data path for 2024 ruleset', async () => {
            const mockData = [{ name: 'Wizard', index: 'wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadClassData('2024');
            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/data/2024/classes.json');
        });

        it('should return empty array on non-ok response', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadClassData('5e');
            expect(result).toEqual([]);
        });

        it('should return empty array on network error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await loadClassData('5e');
            expect(result).toEqual([]);
        });

        it('should return empty array when response is not JSON', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'text/html']]),
                json: async () => ({})
            });

            const result = await loadClassData('5e');
            expect(result).toEqual([]);
        });

        it('should fall back to 5e path for invalid version', async () => {
            const mockData = [{ name: 'Wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadClassData('invalid');
            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/data/classes.json');
        });

        it('should handle undefined version by falling back to 5e', async () => {
            const mockData = [{ name: 'Wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadClassData(undefined);
            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/data/classes.json');
        });
    });

    describe('loadRaceData', () => {
        it('should return race data and cache it', async () => {
            const mockData = [{ name: 'Human', index: 'human' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadRaceData('5e');
            expect(result).toEqual(mockData);

            const cached = await loadRaceData('5e');
            expect(cached).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should use 2024 data path for 2024 ruleset', async () => {
            const mockData = [{ name: 'Human' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            await loadRaceData('2024');
            expect(global.fetch).toHaveBeenCalledWith('/data/2024/races.json');
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadRaceData('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadBackgroundData', () => {
        it('should load background data when available', async () => {
            const mockData = [{ name: 'Acolyte', index: 'acolyte' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadBackgroundData('2024');
            expect(result).toEqual(mockData);
        });

        it('should return empty array on 404 (optional data)', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(404));

            const result = await loadBackgroundData('5e');
            expect(result).toEqual([]);
        });

        it('should return empty array on non-404 error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadBackgroundData('5e');
            expect(result).toEqual([]);
        });

        it('should cache the 404 empty result to avoid re-fetching', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(404));

            await loadBackgroundData('5e');
            await loadBackgroundData('5e');

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when response is not JSON', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                headers: new Map([['content-type', 'text/plain']]),
                json: async () => null
            });

            const result = await loadBackgroundData('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadFeatData', () => {
        it('should return feat data and cache it', async () => {
            const mockData = [{ name: 'Tough', index: 'tough' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadFeatData('5e');
            expect(result).toEqual(mockData);

            const cached = await loadFeatData('5e');
            expect(cached).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadFeatData('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadValidationRules', () => {
        it('should extract versioned data when wrapped', async () => {
            const mockData = { '5e': { level_range: { min: 1, max: 20 } } };
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadValidationRules('5e');
            expect(result).toEqual({ level_range: { min: 1, max: 20 } });
        });

        it('should return data directly when not wrapped in version key', async () => {
            const mockData = { level_range: { min: 1, max: 20 } };
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadValidationRules('5e');
            expect(result).toEqual(mockData);
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadValidationRules('5e');
            expect(result).toEqual([]);
        });
    });

    describe('fetchClassData', () => {
        it('should find class by name', async () => {
            const mockData = [
                { name: 'Wizard', index: 'wizard' },
                { name: 'Sorcerer', index: 'sorcerer' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchClassData('Wizard', '5e');
            expect(result).toEqual({ name: 'Wizard', index: 'wizard' });
        });

        it('should find class by index (case-insensitive)', async () => {
            const mockData = [
                { name: 'Wizard', index: 'wizard' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchClassData('wizard', '5e');
            expect(result).toEqual({ name: 'Wizard', index: 'wizard' });
        });

        it('should return null when class not found', async () => {
            const mockData = [
                { name: 'Wizard', index: 'wizard' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchClassData('Fighter', '5e');
            expect(result).toBeNull();
        });

        it('should return null when className is empty', async () => {
            const result = await fetchClassData('', '5e');
            expect(result).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should return null when className is null', async () => {
            const result = await fetchClassData(null, '5e');
            expect(result).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('fetchRaceData', () => {
        it('should find race by name', async () => {
            const mockData = [
                { name: 'Human', index: 'human' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchRaceData('Human', '5e');
            expect(result).toEqual({ name: 'Human', index: 'human' });
        });

        it('should find race by index (case-insensitive)', async () => {
            const mockData = [
                { name: 'Human', index: 'human' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchRaceData('human', '5e');
            expect(result).toEqual({ name: 'Human', index: 'human' });
        });

        it('should return null when race not found', async () => {
            const mockData = [
                { name: 'Human', index: 'human' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchRaceData('Elf', '5e');
            expect(result).toBeNull();
        });

        it('should return null when raceName is empty', async () => {
            const result = await fetchRaceData('', '5e');
            expect(result).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('fetchSubraceData', () => {
        it('should find nested subrace in 2024 format', async () => {
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

        it('should search all races for a 2024 subrace', async () => {
            const mockData = [
                { name: 'Human', subraces: [{ name: 'Variant Human' }] },
                {
                    name: 'Elf',
                    subraces: [{ name: 'High Elf', traits: [] }]
                }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('High Elf', '2024');
            expect(result).toEqual({ name: 'High Elf', traits: [] });
        });

        it('should find top-level subrace in 5e format by name', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'High Human', index: 'high-human' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('High Human', '5e');
            expect(result).toEqual({ name: 'High Human', index: 'high-human' });
        });

        it('should find top-level subrace in 5e format by index', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'High Human', index: 'high-human' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('high-human', '5e');
            expect(result).toEqual({ name: 'High Human', index: 'high-human' });
        });

        it('should return null when 2024 subrace not found in any race', async () => {
            const mockData = [
                {
                    name: 'Elf',
                    subraces: [{ name: 'High Elf' }]
                }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('Wood Elf', '2024');
            expect(result).toBeNull();
        });

        it('should return null when no races have subraces in 2024', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'Elf', index: 'elf' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('Wood Elf', '2024');
            expect(result).toBeNull();
        });

        it('should return null when subrace not found at 5e top level', async () => {
            const mockData = [
                { name: 'Human', index: 'human' },
                { name: 'Elf', index: 'elf' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchSubraceData('Drow', '5e');
            expect(result).toBeNull();
        });

        it('should return null when subraceName is empty', async () => {
            const result = await fetchSubraceData('', '2024');
            expect(result).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('fetchBackgroundData', () => {
        it('should find background by name', async () => {
            const mockData = [
                { name: 'Acolyte', index: 'acolyte' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchBackgroundData('Acolyte', '2024');
            expect(result).toEqual({ name: 'Acolyte', index: 'acolyte' });
        });

        it('should find background by index (case-insensitive)', async () => {
            const mockData = [
                { name: 'Acolyte', index: 'acolyte' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchBackgroundData('acolyte', '2024');
            expect(result).toEqual({ name: 'Acolyte', index: 'acolyte' });
        });

        it('should return null when background not found', async () => {
            const mockData = [
                { name: 'Acolyte', index: 'acolyte' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchBackgroundData('Charlatan', '2024');
            expect(result).toBeNull();
        });

        it('should return null when backgroundName is empty', async () => {
            const result = await fetchBackgroundData('', '2024');
            expect(result).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('fetchFeatData', () => {
        it('should find feat by name', async () => {
            const mockData = [
                { name: 'Tough', index: 'tough' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchFeatData('Tough', '5e');
            expect(result).toEqual({ name: 'Tough', index: 'tough' });
        });

        it('should find feat by index (case-insensitive)', async () => {
            const mockData = [
                { name: 'Tough', index: 'tough' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchFeatData('tough', '5e');
            expect(result).toEqual({ name: 'Tough', index: 'tough' });
        });

        it('should return null when feat not found', async () => {
            const mockData = [
                { name: 'Tough', index: 'tough' }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await fetchFeatData('Resilient', '5e');
            expect(result).toBeNull();
        });

        it('should return null when featName is empty', async () => {
            const result = await fetchFeatData('', '5e');
            expect(result).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('loadAbilityScores', () => {
        it('should load ability scores and cache them', async () => {
            const mockData = [
                { full_name: 'Strength', skills: ['Athletics'] },
                { full_name: 'Dexterity', skills: ['Acrobatics'] }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadAbilityScores();
            expect(result1).toEqual(mockData);

            const result2 = await loadAbilityScores();
            expect(result2).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return fallback data on network error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await loadAbilityScores();

            expect(result).toHaveLength(6);
            expect(result[0].full_name).toBe('Strength');
            expect(result[2].full_name).toBe('Constitution');
            expect(result[5].full_name).toBe('Charisma');
        });

        it('should return fallback data on non-ok response', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadAbilityScores();

            expect(result).toHaveLength(6);
            expect(result[0].full_name).toBe('Strength');
        });

        it('should return fallback with all 6 ability scores', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await loadAbilityScores();

            const expected = [
                'Strength', 'Dexterity', 'Constitution',
                'Intelligence', 'Wisdom', 'Charisma'
            ];
            result.forEach((ability, i) => {
                expect(ability.full_name).toBe(expected[i]);
            });
        });
    });

    describe('loadEquipment', () => {
        it('should load equipment and cache it', async () => {
            const mockData = [{ name: 'Club', type: 'weapon' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadEquipment();
            expect(result1).toEqual(mockData);

            const result2 = await loadEquipment();
            expect(result2).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadEquipment();
            expect(result).toEqual([]);
        });
    });

    describe('loadMonsters', () => {
        it('should load monsters and cache them', async () => {
            const mockData = [{ name: 'Goblin', cr: '1/4' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadMonsters();
            expect(result1).toEqual(mockData);

            const result2 = await loadMonsters();
            expect(result2).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadMonsters();
            expect(result).toEqual([]);
        });
    });

    describe('loadMagicItems', () => {
        it('should load magic items and cache them', async () => {
            const mockData = [{ name: 'Bag of Holding' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadMagicItems();
            expect(result1).toEqual(mockData);

            const result2 = await loadMagicItems();
            expect(result2).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadMagicItems();
            expect(result).toEqual([]);
        });
    });

    describe('loadSpells', () => {
        it('should load spells for 5e', async () => {
            const mockData = [{ name: 'Fireball', level: 3 }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadSpells('5e');
            expect(result).toEqual(mockData);
        });

        it('should load spells for 2024', async () => {
            const mockData = [{ name: 'Magic Missile', level: 1 }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadSpells('2024');
            expect(result).toEqual(mockData);
        });

        it('should cache spells independently per version', async () => {
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
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

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
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(abilityData));

            const result = await loadSkills();

            expect(result).toEqual([
                { name: 'Athletics', ability: 'Strength' },
                { name: 'Arcana', ability: 'Intelligence' },
                { name: 'History', ability: 'Intelligence' }
            ]);
        });

        it('should cache derived skills after first load', async () => {
            const abilityData = [
                { full_name: 'Strength', skills: ['Athletics'] }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(abilityData));

            await loadSkills();
            await loadSkills();

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should derive all 18 skills from full ability scores', async () => {
            const abilityData = [
                { full_name: 'Strength', skills: ['Athletics'] },
                { full_name: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
                { full_name: 'Constitution', skills: [] },
                { full_name: 'Intelligence', skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'] },
                { full_name: 'Wisdom', skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] },
                { full_name: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] }
            ];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(abilityData));

            const result = await loadSkills();

            expect(result).toHaveLength(18);
            expect(result[0]).toEqual({ name: 'Athletics', ability: 'Strength' });
        });

        it('should return fallback skills on network error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await loadSkills();

            // loadAbilityScores returns fallback ordered by ability (Strength first),
            // so loadSkills derives in that order: Athletics(0) through Persuasion(17)
            expect(result).toHaveLength(18);
            expect(result[0]).toEqual({ name: 'Athletics', ability: 'Strength' });
            expect(result[17]).toEqual({ name: 'Persuasion', ability: 'Charisma' });
        });
    });

    describe('loadPassiveSkills', () => {
        it('should load passive skills and cache them', async () => {
            const mockData = ['Insight', 'Investigation', 'Perception'];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadPassiveSkills();
            expect(result1).toEqual(mockData);

            const result2 = await loadPassiveSkills();
            expect(result2).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should return fallback passive skills on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadPassiveSkills();
            expect(result).toEqual(['Insight', 'Investigation', 'Perception']);
        });
    });

    describe('loadManeuvers', () => {
        it('should load maneuvers and cache them', async () => {
            const mockData = [{ name: 'Action Surge' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result1 = await loadManeuvers('5e');
            expect(result1).toEqual(mockData);

            const result2 = await loadManeuvers('5e');
            expect(result2).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should use 2024 path for 2024 ruleset', async () => {
            const mockData = [{ name: 'Action Surge' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            await loadManeuvers('2024');
            expect(global.fetch).toHaveBeenCalledWith('/data/2024/maneuvers.json');
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadManeuvers('5e');
            expect(result).toEqual([]);
        });
    });

    describe('loadSpellData', () => {
        it('should delegate to loadSpells using playerStats.rules', async () => {
            const mockData = [{ name: 'Fireball', level: 3 }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadSpellData({ rules: '2024' });
            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/data/2024/spells.json');
        });

        it('should default to 5e when playerStats has no rules', async () => {
            const mockData = [{ name: 'Fireball', level: 3 }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            const result = await loadSpellData({});
            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/data/spells.json');
        });

        it('should return empty array on error', async () => {
            global.fetch.mockResolvedValueOnce(mockErrorResponse(500));

            const result = await loadSpellData({ rules: '5e' });
            expect(result).toEqual([]);
        });
    });

    describe('clearDataCache', () => {
        it('should clear versioned cache entries', async () => {
            const mockData = [{ name: 'Wizard' }];
            global.fetch.mockResolvedValueOnce(mockSuccessResponse(mockData));

            await loadClassData('5e');

            const cacheState = getCacheState();
            expect(cacheState['5e'].classes).toEqual(mockData);

            clearDataCache();

            const clearedCache = getCacheState();
            expect(clearedCache['5e'].classes).toBeNull();
        });

        it('should clear shared data caches', async () => {
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

        it('should clear both 5e and 2024 caches', async () => {
            const mockData5e = [{ name: 'Wizard 5e' }];
            const mockData2024 = [{ name: 'Wizard 2024' }];
            global.fetch
                .mockResolvedValueOnce(mockSuccessResponse(mockData5e))
                .mockResolvedValueOnce(mockSuccessResponse(mockData2024));

            await loadClassData('5e');
            await loadClassData('2024');

            clearDataCache();

            const cleared = getCacheState();
            expect(cleared['5e'].classes).toBeNull();
            expect(cleared['2024'].classes).toBeNull();
        });
    });

    describe('getCacheState', () => {
        it('should return an object with 5e and 2024 versions', () => {
            const cacheState = getCacheState();

            expect(cacheState).toHaveProperty('5e');
            expect(cacheState).toHaveProperty('2024');
        });


    });

});
