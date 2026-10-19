// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useEncounterGeneration from './useEncounterGeneration.js';
import { createMap, saveMapData } from '../../../services/maps/mapsService.js';
import { generateOutdoorEncounter } from '../../../services/encounters/outdoorEncounterGenerator.js';

vi.mock('../../../services/maps/mapsService.js', () => ({
    createMap: vi.fn(),
    saveMapData: vi.fn(),
}));

vi.mock('../../../services/encounters/outdoorEncounterGenerator.js', () => ({
    generateOutdoorEncounter: vi.fn(),
}));

const TERRAIN = { '0,0': 'plains', '1,0': 'forest' };

const setup = ({
    mapName = 'test-map.json',
    terrain = TERRAIN,
    marchingOrder = ['Alice', 'Bob'],
    onEncounterCreated = vi.fn(),
} = {}) => {
    generateOutdoorEncounter.mockReturnValue({
        placedItems: [],
        players: [],
        bgFill: '#7A9B6A',
    });
    createMap.mockResolvedValue({});
    saveMapData.mockResolvedValue({});

    const { result } = renderHook(() =>
        useEncounterGeneration('test-campaign', mapName, terrain, marchingOrder, onEncounterCreated)
    );
    return { result, onEncounterCreated };
};

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

describe('useEncounterGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('generateMonsterPlacements', () => {
        beforeEach(() => {
            vi.spyOn(Math, 'random').mockImplementation(seededRandom(42));
        });

        it('places one visible NPC per monster, uniquely identified, on distinct cells in a ring around the grid centre', () => {
            const { result } = setup();
            const items = result.current.generateMonsterPlacements(
                [
                    { name: 'Goblin', qty: 3 },
                    { name: 'Orc', qty: 2 },
                ],
                30
            );

            expect(items).toHaveLength(5);
            expect(items.filter((i) => i.name === 'Goblin')).toHaveLength(3);
            expect(items.filter((i) => i.name === 'Orc')).toHaveLength(2);
            expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
            expect(new Set(items.map((i) => `${i.gridX},${i.gridY}`)).size).toBe(items.length);

            for (const item of items) {
                expect(item.type).toBe('npc');
                expect(item.visible).toBe(true);
                expect(item.id).toMatch(/^enc-monster-\d+$/);
                expect(item.gridX).toBeGreaterThanOrEqual(1);
                expect(item.gridX).toBeLessThanOrEqual(28);
                expect(item.gridY).toBeGreaterThanOrEqual(1);
                expect(item.gridY).toBeLessThanOrEqual(28);
                // Spawn ring is 6-12 hexes from centre (15,15); allow ±1 for rounding.
                const dist = Math.hypot(item.gridX - 15, item.gridY - 15);
                expect(dist).toBeGreaterThanOrEqual(5);
                expect(dist).toBeLessThan(13);
            }

            expect(result.current.generateMonsterPlacements([], 30)).toEqual([]);
        });
    });

    describe('handleStartEncounter', () => {
        it('runs the full pipeline: generates from hex terrain, creates the map with the exact payload, saves the generated data, and notifies the caller', async () => {
            const generated = {
                placedItems: [{ id: 'item-1', type: 'bush' }],
                players: [
                    { id: 'alice', name: 'Alice', gridX: 14, gridY: 14 },
                    { id: 'bob', name: 'Bob', gridX: 15, gridY: 14 },
                ],
                bgFill: '#2D5E37',
            };
            const { result, onEncounterCreated } = setup({ mapName: 'dungeon-exploration.json' });
            generateOutdoorEncounter.mockReturnValue(generated);

            await result.current.handleStartEncounter(1, 0);

            expect(generateOutdoorEncounter).toHaveBeenCalledTimes(1);
            expect(generateOutdoorEncounter).toHaveBeenCalledWith('forest', 30, ['Alice', 'Bob'], 1, 0);
            expect(createMap).toHaveBeenCalledTimes(1);
            expect(createMap).toHaveBeenCalledWith('test-campaign', 'dungeon-exploration - Encounter at 1,0', {
                type: 'indoor',
                gridSize: 30,
                placedItems: [{ id: 'item-1', type: 'bush' }],
                players: [
                    { id: 'alice', name: 'Alice', gridX: 14, gridY: 14 },
                    { id: 'bob', name: 'Bob', gridX: 15, gridY: 14 },
                ],
                fog: [],
                walls: [],
                parentTerrain: 'forest',
                parentHex: { q: 1, r: 0 },
                bgFill: '#2D5E37',
            });
            expect(saveMapData).toHaveBeenCalledTimes(1);
            expect(saveMapData).toHaveBeenCalledWith(
                'test-campaign',
                'dungeon-exploration - Encounter at 1,0',
                generated
            );
            // Save receives the generator result untouched (pass-through identity).
            expect(saveMapData.mock.calls[0][2]).toBe(generated);
            expect(onEncounterCreated).toHaveBeenCalledTimes(1);
            expect(onEncounterCreated).toHaveBeenCalledWith('dungeon-exploration - Encounter at 1,0');
        });

        it('falls back to plains terrain when the hex key is missing', async () => {
            const { result, onEncounterCreated } = setup();

            await result.current.handleStartEncounter(5, 5);

            expect(generateOutdoorEncounter).toHaveBeenCalledWith('plains', 30, ['Alice', 'Bob'], 5, 5);
            expect(createMap).toHaveBeenCalledWith(
                'test-campaign',
                'test-map - Encounter at 5,5',
                expect.objectContaining({
                    parentTerrain: 'plains',
                    parentHex: { q: 5, r: 5 },
                })
            );
            expect(onEncounterCreated).toHaveBeenCalledWith('test-map - Encounter at 5,5');
        });

        it('appends extra placed items after the generated ones', async () => {
            const { result } = setup();
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [{ id: 'enc-item-1' }],
                players: [],
                bgFill: '#7A9B6A',
            });

            await result.current.handleStartEncounter(0, 0, [
                { id: 'extra-1', type: 'chest' },
                { id: 'extra-2', type: 'trap' },
            ]);

            expect(createMap).toHaveBeenCalledWith(
                'test-campaign',
                'test-map - Encounter at 0,0',
                expect.objectContaining({
                    placedItems: [
                        { id: 'enc-item-1' },
                        { id: 'extra-1', type: 'chest' },
                        { id: 'extra-2', type: 'trap' },
                    ],
                })
            );
        });

        it('skips saving but still notifies the caller when the map already exists', async () => {
            const { result, onEncounterCreated } = setup();
            createMap.mockResolvedValue({ alreadyExists: true });

            await result.current.handleStartEncounter(0, 0);

            expect(saveMapData).not.toHaveBeenCalled();
            expect(onEncounterCreated).toHaveBeenCalledWith('test-map - Encounter at 0,0');
        });

        it.each([
            ['createMap', 'Map create failed'],
            ['saveMapData', 'Map save failed'],
        ])('logs the failure and skips the callback when %s rejects', async (service, message) => {
            const { result, onEncounterCreated } = setup();
            const error = new Error(message);
            if (service === 'createMap') {
                createMap.mockRejectedValue(error);
            } else {
                saveMapData.mockRejectedValue(error);
            }
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await expect(result.current.handleStartEncounter(0, 0)).resolves.toBeUndefined();

            expect(consoleSpy).toHaveBeenCalledWith(
                '[handleStartEncounter] FAILED:',
                expect.objectContaining({ message })
            );
            expect(onEncounterCreated).not.toHaveBeenCalled();
        });

        it('rejects and skips all map work when generateOutdoorEncounter throws', async () => {
            const { result, onEncounterCreated } = setup();
            generateOutdoorEncounter.mockImplementation(() => {
                throw new Error('Encounter generation failed');
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await expect(result.current.handleStartEncounter(0, 0)).rejects.toThrow(
                'Encounter generation failed'
            );

            expect(createMap).not.toHaveBeenCalled();
            expect(saveMapData).not.toHaveBeenCalled();
            expect(onEncounterCreated).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('completes the map work without an onEncounterCreated callback', async () => {
            const { result } = setup({ onEncounterCreated: undefined });

            await expect(result.current.handleStartEncounter(0, 0)).resolves.toBeUndefined();

            expect(createMap).toHaveBeenCalledTimes(1);
            expect(saveMapData).toHaveBeenCalledTimes(1);
        });
    });
});
