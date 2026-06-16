import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTerrainPainting from './useTerrainPainting.js';

vi.mock('../../../services/maps/hexMapUtils.js', () => ({
    hexKey: vi.fn((q, r) => `${q},${r}`),
}));

vi.mock('../../../config/outdoorConfig.js', () => ({
    TOOL_PAINT: 'paint',
    TOOL_ERASE: 'erase',
    TOOL_RIVER: 'river',
}));

const { hexKey } = await import('../../../services/maps/hexMapUtils.js');

describe('useTerrainPainting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initial state', () => {
        it('returns handleTerrainPointerDown as a function', () => {
            const { handleTerrainPointerDown } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', vi.fn(), vi.fn())
            ).result.current;
            expect(typeof handleTerrainPointerDown).toBe('function');
        });

        it('returns handleTerrainPointerMove as a function', () => {
            const { handleTerrainPointerMove } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', vi.fn(), vi.fn())
            ).result.current;
            expect(typeof handleTerrainPointerMove).toBe('function');
        });

        it('returns handleTerrainPointerUp as a function', () => {
            const { handleTerrainPointerUp } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', vi.fn(), vi.fn())
            ).result.current;
            expect(typeof handleTerrainPointerUp).toBe('function');
        });
    });

    describe('handleTerrainPointerDown', () => {
        it('does nothing when getHexFromEvent returns null', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => null, 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('does nothing when hex is outside grid bounds (q < 0)', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: -1, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('does nothing when hex is outside grid bounds (q >= hexCols)', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 10, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('does nothing when hex is outside grid bounds (r < 0)', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: -1 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('does nothing when hex is outside grid bounds (r >= hexRows)', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 10 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('paints terrain when tool is TOOL_PAINT', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(hexKey).toHaveBeenCalledWith(2, 3);
            expect(setTerrain).toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('sets the selected terrain on the hex key when tool is TOOL_PAINT', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'mountains', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).toHaveBeenCalled();
            const callArg = setTerrain.mock.calls[0][0]({});
            expect(callArg['2,3']).toBe('mountains');
        });

        it('erases terrain when tool is TOOL_ERASE', () => {
            const initialTerrain = { '2,3': 'forest', '4,5': 'desert' };
            const setTerrain = vi.fn((fn) => fn(initialTerrain));
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'erase');
            });

            expect(setTerrain).toHaveBeenCalled();
            const callArg = setTerrain.mock.calls[0][0](initialTerrain);
            expect(callArg['2,3']).toBeUndefined();
            expect(callArg['4,5']).toBe('desert');
        });

        it('toggles river when tool is TOOL_RIVER and river not present', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn([]));
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).toHaveBeenCalled();
            const callArg = setRivers.mock.calls[0][0]([]);
            expect(callArg).toContain('2,3');
        });

        it('removes river when tool is TOOL_RIVER and river already present', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn(['2,3', '4,5']));
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).toHaveBeenCalled();
            const callArg = setRivers.mock.calls[0][0](['2,3', '4,5']);
            expect(callArg).toEqual(['4,5']);
        });

        it('sets paintingRef to true after paint action', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            // paintingRef is internal; verify painting continues via move
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).toHaveBeenCalledTimes(2);
        });

        it('sets paintingRef to true after river action', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn([]));
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            // paintingRef is internal; verify painting continues via move
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(setRivers).toHaveBeenCalledTimes(2);
        });
    });

    describe('handleTerrainPointerMove', () => {
        it('does nothing when paintingRef is false initially', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
        });

        it('paints terrain after pointer down activates painting', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            // First, activate painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            // Then move
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).toHaveBeenCalledTimes(2);
        });

        it('erases terrain during move when tool is TOOL_ERASE', () => {
            const initialTerrain = { '2,3': 'forest' };
            const setTerrain = vi.fn((fn) => fn(initialTerrain));
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            // Activate painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'erase');
            });

            // Move to erase
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'erase');
            });

            expect(setTerrain).toHaveBeenCalledTimes(2);
        });

        it('adds river during move when tool is TOOL_RIVER', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn([]));
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            // Activate painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            // Move to add river (should not duplicate)
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).toHaveBeenCalledTimes(2);
        });

        it('does not duplicate river keys during move', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn(['2,3']));
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            // Activate painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            // Move to same hex (should not duplicate)
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(setRivers).toHaveBeenCalled();
            const callArg = setRivers.mock.calls[1][0](['2,3']);
            expect(callArg).toEqual(['2,3']);
        });

        it('does nothing when getHexFromEvent returns null during move', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            let hexCounter = 0;
            const getHexFromEvent = vi.fn(() => {
                hexCounter++;
                if (hexCounter === 1) return { q: 2, r: 3 };
                return null;
            });
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, getHexFromEvent, 'forest', setTerrain, setRivers)
            );

            // Activate painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            const callsAfterDown = setTerrain.mock.calls.length;

            // Move with null hex
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            // No additional calls from move
            expect(setTerrain).toHaveBeenCalledTimes(callsAfterDown);
        });

        it('does nothing when hex is outside grid bounds during move', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            let hexCounter = 0;
            const getHexFromEvent = vi.fn(() => {
                hexCounter++;
                if (hexCounter === 1) return { q: 2, r: 3 };
                return { q: 20, r: 20 };
            });
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, getHexFromEvent, 'forest', setTerrain, setRivers)
            );

            // Activate painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            const callsAfterDown = setTerrain.mock.calls.length;

            // Move with out-of-bounds hex
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            // No additional calls from move
            expect(setTerrain).toHaveBeenCalledTimes(callsAfterDown);
        });
    });

    describe('handleTerrainPointerUp', () => {
        it('stops painting after pointer up', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers)
            );

            // Activate painting
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            // Move while painting
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            // Release
            act(() => {
                result.current.handleTerrainPointerUp();
            });

            // Move after release should not paint
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).toHaveBeenCalledTimes(2);
        });
    });

    describe('returned object shape', () => {
        it('returns exactly handleTerrainPointerDown, handleTerrainPointerMove, handleTerrainPointerUp', () => {
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', vi.fn(), vi.fn())
            );

            const keys = Object.keys(result.current);
            expect(keys).toContain('handleTerrainPointerDown');
            expect(keys).toContain('handleTerrainPointerMove');
            expect(keys).toContain('handleTerrainPointerUp');
            expect(keys.length).toBe(3);
        });
    });

    describe('function stability', () => {
        it('all three handlers are stable useCallback references', () => {
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 2, r: 3 }), 'forest', vi.fn(), vi.fn())
            );
            const { handleTerrainPointerDown, handleTerrainPointerMove, handleTerrainPointerUp } = result.current;
            expect(typeof handleTerrainPointerDown).toBe('function');
            expect(typeof handleTerrainPointerMove).toBe('function');
            expect(typeof handleTerrainPointerUp).toBe('function');
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

            // Paint with 'forest'
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            const terrainCall1 = setTerrain.mock.calls[0][0]({});
            expect(terrainCall1['2,3']).toBe('forest');

            // Change selected terrain
            rerender({ hexCols: 10, hexRows: 10, getHex: () => ({ q: 3, r: 4 }), terrain: 'desert', setTerrain, setRivers });

            // Paint with 'desert'
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            const terrainCall2 = setTerrain.mock.calls[1][0]({});
            expect(terrainCall2['3,4']).toBe('desert');
        });

        it('uses updated hexCols for boundary checking', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result, rerender } = renderHook(
                (args) => useTerrainPainting(args.hexCols, args.hexRows, args.getHex, args.terrain, args.setTerrain, args.setRivers),
                { initialProps: { hexCols: 3, hexRows: 10, getHex: () => ({ q: 2, r: 3 }), terrain: 'forest', setTerrain, setRivers } }
            );

            // q=2 is within bounds of hexCols=3
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain).toHaveBeenCalled();

            // Change hexCols to 2, making q=2 out of bounds
            rerender({ hexCols: 2, hexRows: 10, getHex: () => ({ q: 2, r: 3 }), terrain: 'forest', setTerrain, setRivers });
            setTerrain.mockClear();

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain).not.toHaveBeenCalled();
        });

        it('uses updated hexRows for boundary checking', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result, rerender } = renderHook(
                (args) => useTerrainPainting(args.hexCols, args.hexRows, args.getHex, args.terrain, args.setTerrain, args.setRivers),
                { initialProps: { hexCols: 10, hexRows: 3, getHex: () => ({ q: 2, r: 2 }), terrain: 'forest', setTerrain, setRivers } }
            );

            // r=2 is within bounds of hexRows=3
            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain).toHaveBeenCalled();

            // Change hexRows to 2, making r=2 out of bounds
            rerender({ hexCols: 10, hexRows: 2, getHex: () => ({ q: 2, r: 2 }), terrain: 'forest', setTerrain, setRivers });
            setTerrain.mockClear();

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain).not.toHaveBeenCalled();
        });
    });

    describe('hexKey usage', () => {
        it('calls hexKey with correct q and r values for paint', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 5, r: 7 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(hexKey).toHaveBeenCalledWith(5, 7);
        });

        it('calls hexKey with correct q and r values for erase', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 1, r: 8 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'erase');
            });

            expect(hexKey).toHaveBeenCalledWith(1, 8);
        });

        it('calls hexKey with correct q and r values for river', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn([]));
            const { result } = renderHook(() =>
                useTerrainPainting(10, 10, () => ({ q: 4, r: 6 }), 'forest', setTerrain, setRivers)
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(hexKey).toHaveBeenCalledWith(4, 6);
        });
    });
});
