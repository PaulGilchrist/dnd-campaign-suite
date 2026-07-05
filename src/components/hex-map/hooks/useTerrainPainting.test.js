// @cleaned-by-ai
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

        it('paints terrain on the hex', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'mountains', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            const callArg = setTerrain.mock.calls[0][0]({});
            expect(callArg['2,3']).toBe('mountains');
        });

        it('removes terrain when erasing', () => {
            const initialTerrain = { '2,3': 'forest', '4,5': 'desert' };
            const setTerrain = vi.fn((fn) => fn(initialTerrain));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'erase');
            });

            const callArg = setTerrain.mock.calls[0][0](initialTerrain);
            expect(callArg['2,3']).toBeUndefined();
            expect(callArg['4,5']).toBe('desert');
        });

        it('toggles river presence on the hex', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn([]));
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            // Toggle on: river not present
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });
            expect(setTerrain).not.toHaveBeenCalled();
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

    describe('handleTerrainPointerMove', () => {
        it('paints terrain while dragging', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'mountains', setTerrain, setRivers);

            // Simulate pointer down to activate painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10, clientY: 10 }, 'paint');
            });

            const callArg = setTerrain.mock.calls[0][0]({});
            expect(callArg['2,3']).toBe('mountains');
        });

        it('does not paint when pointer was never pressed', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10, clientY: 10 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
        });

        it('adds rivers without toggling while dragging', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn([]));
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10, clientY: 10 }, 'river');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            const callArg = setRivers.mock.calls[0][0]([]);
            expect(callArg).toContain('2,3');
        });
    });

    describe('handleTerrainPointerUp', () => {
        it('resets painting state', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            // Start painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10, clientY: 10 }, 'paint');
            });

            // Release
            act(() => {
                result.current.handleTerrainPointerUp();
            });

            // After release, move should not paint (no additional call)
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 20, clientY: 20 }, 'paint');
            });

            // Down and move both painted (same hex), pointerUp prevents further painting
            expect(setTerrain).toHaveBeenCalledTimes(2);
        });
    });
});
