// @improved-by-ai
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

        it.each`
            q        | r        | description
            ${-1}    | ${3}     | ${'q < 0'}
            ${10}    | ${3}     | ${'q >= hexCols'}
            ${2}     | ${-1}    | ${'r < 0'}
            ${2}     | ${10}    | ${'r >= hexRows'}
        `('does nothing when hex is outside grid bounds ($description)', ({ q, r }) => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q, r }), 'forest', setTerrain, setRivers);

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

        it('adds river when tool is river and river not present', () => {
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
        });

        it('removes river when tool is river and river already present', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn(['2,3', '4,5']));
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).toHaveBeenCalled();
            const callArg = setRivers.mock.calls[0][0](['2,3', '4,5']);
            expect(callArg).toEqual(['4,5']);
        });

        it('continues painting on move after pointer down', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).toHaveBeenCalledTimes(2);
        });

        it('continues painting rivers on move after pointer down', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn([]));
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'river');
            });

            expect(setRivers).toHaveBeenCalledTimes(2);
        });
    });

    describe('handleTerrainPointerMove', () => {
        it('does nothing when painting has not been activated', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).not.toHaveBeenCalled();
        });

        it('erases terrain during move when tool is erase', () => {
            const initialTerrain = { '2,3': 'forest' };
            const setTerrain = vi.fn((fn) => fn(initialTerrain));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'erase');
            });

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'erase');
            });

            expect(setTerrain).toHaveBeenCalledTimes(2);
        });

        it('does not duplicate river keys during move', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn((fn) => fn(['2,3']));
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'river');
            });

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
            const { result } = createHooks(10, 10, getHexFromEvent, 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            const callsAfterDown = setTerrain.mock.calls.length;

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

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
            const { result } = createHooks(10, 10, getHexFromEvent, 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            const callsAfterDown = setTerrain.mock.calls.length;

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).toHaveBeenCalledTimes(callsAfterDown);
        });
    });

    describe('handleTerrainPointerUp', () => {
        it('stops painting after pointer up', () => {
            const setTerrain = vi.fn((fn) => fn({}));
            const setRivers = vi.fn();
            const { result } = createHooks(10, 10, () => ({ q: 2, r: 3 }), 'forest', setTerrain, setRivers);

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            act(() => {
                result.current.handleTerrainPointerUp();
            });

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0, clientY: 0 }, 'paint');
            });

            expect(setTerrain).toHaveBeenCalledTimes(2);
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

        it('uses updated hexCols for boundary checking', () => {
            const setTerrain = vi.fn();
            const setRivers = vi.fn();
            const { result, rerender } = renderHook(
                (args) => useTerrainPainting(args.hexCols, args.hexRows, args.getHex, args.terrain, args.setTerrain, args.setRivers),
                { initialProps: { hexCols: 3, hexRows: 10, getHex: () => ({ q: 2, r: 3 }), terrain: 'forest', setTerrain, setRivers } }
            );

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain).toHaveBeenCalled();

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

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain).toHaveBeenCalled();

            rerender({ hexCols: 10, hexRows: 2, getHex: () => ({ q: 2, r: 2 }), terrain: 'forest', setTerrain, setRivers });
            setTerrain.mockClear();

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0, clientY: 0 }, 'paint');
            });
            expect(setTerrain).not.toHaveBeenCalled();
        });
    });
});
