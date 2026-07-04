import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTerrainPainting from './useTerrainPainting.js';

describe('useTerrainPainting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createHooks = (hexCols = 10, hexRows = 10, getHex = () => ({ q: 2, r: 3 }), terrain = 'forest', setTerrain = vi.fn(), setRivers = vi.fn()) =>
        renderHook(() => useTerrainPainting(hexCols, hexRows, getHex, terrain, setTerrain, setRivers));

    describe('handleTerrainPointerDown', () => {
        it('does nothing when getHexFromEvent returns null', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => null, 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('sets terrain when tool is paint', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'mountains', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).toHaveBeenCalled();
            const callArg = setTerrain.mock.calls[0][0]({});
            expect(callArg['2,3']).toBe('mountains');
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('removes terrain when tool is erase', () => {
            const initialTerrain = { '2,3': 'forest', '4,5': 'desert' };
            const setTerrain = vi.fn((fn) => fn(initialTerrain));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'erase');
            });

            expect(setTerrain).toHaveBeenCalled();
            const callArg = setTerrain.mock.calls[0][0](initialTerrain);
            expect(callArg['2,3']).toBeUndefined();
            expect(callArg['4,5']).toBe('desert');
        });

        it('toggles river when tool is river', () => {
            const setTerrain = vi.fn();

            const setRivers = vi.fn((fn) => fn([]));
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).toHaveBeenCalled();
            const callArg = setRivers.mock.calls[0][0]([]);
            expect(callArg).toContain('2,3');

            // Toggle off: river already present
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });
            const callArg2 = setRivers.mock.calls[1][0](['2,3']);
            expect(callArg2).toEqual([]);
        });
    });

    describe('reacting to prop changes', () => {
        it('uses updated selectedTerrain on subsequent paint calls', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result, rerender } = renderHook(
                (args) => useTerrainPainting(args.hexCols, args.hexRows, args.getHex, args.terrain, args.setTerrain, args.setRivers),
                { initialProps: { hexCols: 10, hexRows: 10, getHex: () => ({ q: 2, r: 3 }), terrain: 'forest', setTerrain, setRivers } }
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain.mock.calls[0][0]({})['2,3']).toBe('forest');

            rerender({ hexCols: 10, hexRows: 10, getHex: () => ({ q: 3, r: 4 }), terrain: 'desert', setTerrain, setRivers });

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain.mock.calls[1][0]({})['3,4']).toBe('desert');
        });
    });
});
