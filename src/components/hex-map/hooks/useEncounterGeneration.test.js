// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useEncounterGeneration from './useEncounterGeneration.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { generateOutdoorEncounter } from '../../../services/encounters/outdoorEncounterGenerator.js';

vi.mock('../../../services/maps/mapsService.js', () => ({
    default: {
        createMap: vi.fn(),
        saveMapData: vi.fn(),
    },
    createMap: vi.fn(),
    saveMapData: vi.fn(),
}));

vi.mock('../../../services/encounters/outdoorEncounterGenerator.js', () => ({
    generateOutdoorEncounter: vi.fn(),
}));

describe('useEncounterGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const baseArgs = [
        'test-campaign',
        'test-map.json',
        { '0,0': 'plains', '1,0': 'forest' },
        ['Alice', 'Bob'],
        vi.fn(),
    ];

    describe('generateMonsterPlacements', () => {
        it('returns an array of monster placement objects with correct counts', () => {
            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );
            const { generateMonsterPlacements } = result.current;

            const monsters = [
                { name: 'Goblin', qty: 3 },
                { name: 'Orc', qty: 2 },
            ];
            const items = generateMonsterPlacements(monsters, 30);

            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBe(5);

            const goblinCount = items.filter((i) => i.name === 'Goblin').length;
            const orcCount = items.filter((i) => i.name === 'Orc').length;
            expect(goblinCount).toBe(3);
            expect(orcCount).toBe(2);

            for (const item of items) {
                expect(item.type).toBe('npc');
                expect(item.visible).toBe(true);
                expect(item.gridX).toBeGreaterThanOrEqual(1);
                expect(item.gridX).toBeLessThanOrEqual(28);
                expect(item.gridY).toBeGreaterThanOrEqual(1);
                expect(item.gridY).toBeLessThanOrEqual(28);
            }
        });

        it('avoids duplicate grid positions', () => {
            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );
            const { generateMonsterPlacements } = result.current;

            const items = generateMonsterPlacements(
                [{ name: 'Goblin', qty: 20 }],
                30
            );

            const keys = new Set();
            for (const item of items) {
                const key = `${item.gridX},${item.gridY}`;
                expect(keys.has(key)).toBe(false);
                keys.add(key);
            }
        });

        it('returns stable function reference', () => {
            const { result, rerender } = renderHook(
                (...args) => useEncounterGeneration(...args),
                { initialProps: baseArgs }
            );
            const first = result.current.generateMonsterPlacements;
            rerender();
            expect(result.current.generateMonsterPlacements).toBe(first);
        });
    });

    describe('handleStartEncounter', () => {
        it('calls generateOutdoorEncounter with correct terrain', async () => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [],
                players: [],
                bgFill: '#7A9B6A',
            });
            mapsService.createMap.mockResolvedValue({});

            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );

            await result.current.handleStartEncounter(0, 0);

            expect(generateOutdoorEncounter).toHaveBeenCalledWith(
                'plains',
                30,
                ['Alice', 'Bob'],
                0,
                0
            );
        });

        it('uses fallback terrain when hex key is missing', async () => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [],
                players: [],
                bgFill: '#7A9B6A',
            });
            mapsService.createMap.mockResolvedValue({});

            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );

            await result.current.handleStartEncounter(5, 5);

            expect(generateOutdoorEncounter).toHaveBeenCalledWith(
                'plains',
                30,
                ['Alice', 'Bob'],
                5,
                5
            );
        });

        it('calls mapsService.createMap with correct data', async () => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [{ id: 'item-1', type: 'bush' }],
                players: [
                    { id: 'alice', name: 'Alice', gridX: 14, gridY: 14 },
                    { id: 'bob', name: 'Bob', gridX: 15, gridY: 14 },
                ],
                bgFill: '#2D5E37',
            });
            mapsService.createMap.mockResolvedValue({});

            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );

            await result.current.handleStartEncounter(0, 0);

            expect(mapsService.createMap).toHaveBeenCalledWith(
                'test-campaign',
                'test-map - Encounter at 0,0',
                expect.objectContaining({
                    type: 'indoor',
                    gridSize: 30,
                    placedItems: [{ id: 'item-1', type: 'bush' }],
                    players: expect.any(Array),
                    fog: [],
                    walls: [],
                    parentTerrain: 'plains',
                    parentHex: { q: 0, r: 0 },
                    bgFill: '#2D5E37',
                })
            );
        });

        it('calls mapsService.saveMapData when map does not already exist', async () => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [],
                players: [],
                bgFill: '#7A9B6A',
            });
            mapsService.createMap.mockResolvedValue({});
            mapsService.saveMapData.mockResolvedValue({});

            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );

            await result.current.handleStartEncounter(0, 0);

            expect(mapsService.saveMapData).toHaveBeenCalledWith(
                'test-campaign',
                'test-map - Encounter at 0,0',
                expect.any(Object)
            );
        });

        it('skips saveMapData when map already exists', async () => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [],
                players: [],
                bgFill: '#7A9B6A',
            });
            mapsService.createMap.mockResolvedValue({ alreadyExists: true });

            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );

            await result.current.handleStartEncounter(0, 0);

            expect(mapsService.saveMapData).not.toHaveBeenCalled();
        });

        it('calls onEncounterCreated callback', async () => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [],
                players: [],
                bgFill: '#7A9B6A',
            });
            mapsService.createMap.mockResolvedValue({});
            mapsService.saveMapData.mockResolvedValue({});

            const onEncounterCreated = vi.fn();
            const args = [
                'test-campaign',
                'test-map.json',
                { '0,0': 'plains' },
                ['Alice'],
                onEncounterCreated,
            ];

            const { result } = renderHook(() =>
                useEncounterGeneration(...args)
            );

            await result.current.handleStartEncounter(0, 0);

            expect(onEncounterCreated).toHaveBeenCalledWith(
                'test-map - Encounter at 0,0'
            );
        });

        it('uses extraPlacedItems when provided', async () => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [{ id: 'enc-item-1' }],
                players: [],
                bgFill: '#7A9B6A',
            });
            mapsService.createMap.mockResolvedValue({});
            mapsService.saveMapData.mockResolvedValue({});

            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );

            const extraItems = [
                { id: 'extra-1', type: 'chest' },
                { id: 'extra-2', type: 'trap' },
            ];

            await result.current.handleStartEncounter(0, 0, extraItems);

            const callArgs = mapsService.createMap.mock.calls[0];
            const placedItems = callArgs[2].placedItems;

            expect(placedItems.length).toBe(3);
            expect(placedItems[0].id).toBe('enc-item-1');
            expect(placedItems[1].id).toBe('extra-1');
            expect(placedItems[2].id).toBe('extra-2');
        });

        it('strips .json extension from map name for encounter name', async () => {
            const jsonArgs = [
                'my-campaign',
                'dungeon-exploration.json',
                { '0,0': 'forest' },
                [],
                vi.fn(),
            ];
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [],
                players: [],
                bgFill: '#2D5E37',
            });
            mapsService.createMap.mockResolvedValue({});

            const { result } = renderHook(() =>
                useEncounterGeneration(...jsonArgs)
            );

            await result.current.handleStartEncounter(0, 0);

            expect(mapsService.createMap).toHaveBeenCalledWith(
                'my-campaign',
                'dungeon-exploration - Encounter at 0,0',
                expect.any(Object)
            );
        });

        it.each`
            service              | setup
            ${'createMap'}       | ${() => mapsService.createMap.mockRejectedValue(new Error('Network error'))}
            ${'saveMapData'}     | ${() => { mapsService.createMap.mockResolvedValue({}); mapsService.saveMapData.mockRejectedValue(new Error('Save failed')); }}
        `('handles errors from $service gracefully', async ({ setup }) => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [],
                players: [],
                bgFill: '#7A9B6A',
            });
            setup();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { result } = renderHook(() =>
                useEncounterGeneration(...baseArgs)
            );

            await result.current.handleStartEncounter(0, 0);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[handleStartEncounter] FAILED:',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });

        it('does not call onEncounterCreated when error occurs', async () => {
            generateOutdoorEncounter.mockReturnValue({
                placedItems: [],
                players: [],
                bgFill: '#7A9B6A',
            });
            mapsService.createMap.mockRejectedValue(new Error('fail'));
            const onEncounterCreated = vi.fn();

            const args = [
                'test-campaign',
                'test-map.json',
                { '0,0': 'plains' },
                ['Alice'],
                onEncounterCreated,
            ];

            const { result } = renderHook(() =>
                useEncounterGeneration(...args)
            );

            await result.current.handleStartEncounter(0, 0);

            expect(onEncounterCreated).not.toHaveBeenCalled();
        });

        it('handles generateOutdoorEncounter throwing an error', async () => {
            generateOutdoorEncounter.mockImplementation(() => {
                throw new Error('Encounter generation failed');
            });
            const onEncounterCreated = vi.fn();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const args = [
                'test-campaign',
                'test-map.json',
                { '0,0': 'plains' },
                ['Alice'],
                onEncounterCreated,
            ];

            const { result } = renderHook(() =>
                useEncounterGeneration(...args)
            );

            let caughtError = null;
            try {
                await result.current.handleStartEncounter(0, 0);
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError).toBeInstanceOf(Error);
            expect(caughtError.message).toBe('Encounter generation failed');
            expect(onEncounterCreated).not.toHaveBeenCalled();
            expect(mapsService.createMap).not.toHaveBeenCalled();
            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('returns stable handleStartEncounter reference', () => {
            const stableCallback = vi.fn();
            const stableArgs = [
                'test-campaign',
                'test-map.json',
                { '0,0': 'plains', '1,0': 'forest' },
                ['Alice', 'Bob'],
                stableCallback,
            ];
            let handleStartEncounter;
            const { rerender } = renderHook(
                (args) => {
                    handleStartEncounter = useEncounterGeneration(...args);
                    return handleStartEncounter;
                },
                { initialProps: stableArgs }
            );
            const first = handleStartEncounter.handleStartEncounter;
            rerender(stableArgs);
            expect(handleStartEncounter.handleStartEncounter).toBe(first);
        });
    });
});
