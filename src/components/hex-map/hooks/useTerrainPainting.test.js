// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTerrainPainting from './useTerrainPainting.js';
import { TOOL_PAINT, TOOL_ERASE, TOOL_RIVER } from '../../../config/outdoorConfig.js';

const HEX = { q: 2, r: 3 };
const HEX_KEY = '2,3';

const setup = ({
    hexCols = 10,
    hexRows = 10,
    getHex = () => HEX,
    selectedTerrain = 'forest',
} = {}) => {
    const setTerrain = vi.fn();
    const setRivers = vi.fn();
    const { result } = renderHook(() =>
        useTerrainPainting({ hexCols, hexRows, getHexFromEvent: getHex, selectedTerrain, setTerrain, setRivers })
    );
    return { result, setTerrain, setRivers };
};

// Applies the nth functional updater captured by a mock to `initialState`.
const applyUpdater = (mock, callIndex, initialState) => mock.mock.calls[callIndex][0](initialState);

describe('useTerrainPainting', () => {
    describe('handleTerrainPointerDown', () => {
        it('does nothing when the event resolves to no hex', () => {
            const { result, setTerrain, setRivers } = setup({ getHex: () => null });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it.each([
            ['negative column', { q: -1, r: 3 }],
            ['negative row', { q: 2, r: -1 }],
            ['column at the grid edge', { q: 10, r: 3 }],
            ['row at the grid edge', { q: 2, r: 10 }],
        ])('ignores hexes outside the grid (%s)', (_, hex) => {
            const { result, setTerrain, setRivers } = setup({ getHex: () => hex });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('paints the selected terrain onto the hex', () => {
            const { result, setTerrain, setRivers } = setup({ selectedTerrain: 'mountains' });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });

            expect(setRivers).not.toHaveBeenCalled();
            expect(applyUpdater(setTerrain, 0, {})).toEqual({ [HEX_KEY]: 'mountains' });
        });

        it('keeps terrain already painted on other hexes', () => {
            const { result, setTerrain } = setup({ selectedTerrain: 'mountains' });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });

            expect(applyUpdater(setTerrain, 0, { '4,5': 'desert' })).toEqual({
                [HEX_KEY]: 'mountains',
                '4,5': 'desert',
            });
        });

        it('removes the terrain from the hex when erasing', () => {
            const { result, setTerrain, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_ERASE);
            });

            expect(setRivers).not.toHaveBeenCalled();
            expect(applyUpdater(setTerrain, 0, { [HEX_KEY]: 'forest', '4,5': 'desert' })).toEqual({
                '4,5': 'desert',
            });
        });

        it('leaves the terrain map unchanged when erasing an unpainted hex', () => {
            const initial = { '4,5': 'desert' };
            const { result, setTerrain } = setup();

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_ERASE);
            });

            expect(applyUpdater(setTerrain, 0, initial)).toEqual(initial);
        });

        it('adds a river when the hex has none', () => {
            const { result, setTerrain, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_RIVER);
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(applyUpdater(setRivers, 0, [])).toEqual([HEX_KEY]);
        });

        it('removes a river when the hex already has one', () => {
            const { result, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_RIVER);
            });

            expect(applyUpdater(setRivers, 0, [HEX_KEY])).toEqual([]);
        });
    });

    describe('handleTerrainPointerMove', () => {
        it('does not paint when the pointer was never pressed', () => {
            const { result, setTerrain } = setup();

            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_PAINT);
            });

            expect(setTerrain).not.toHaveBeenCalled();
        });

        it('does not add rivers when the pointer was never pressed', () => {
            const { result, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_RIVER);
            });

            expect(setRivers).not.toHaveBeenCalled();
        });

        it('paints the hex under the pointer while dragging', () => {
            const { result, setTerrain } = setup({ selectedTerrain: 'mountains' });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_PAINT);
            });

            expect(applyUpdater(setTerrain, 0, {})).toEqual({ [HEX_KEY]: 'mountains' });
        });

        it('paints each hex visited while dragging', () => {
            const getHex = (e) => (e.clientX < 5 ? HEX : { q: 4, r: 5 });
            const { result, setTerrain } = setup({ getHex, selectedTerrain: 'mountains' });

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0 }, TOOL_PAINT);
            });
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10 }, TOOL_PAINT);
            });

            expect(applyUpdater(setTerrain, 0, {})).toEqual({ [HEX_KEY]: 'mountains' });
            expect(applyUpdater(setTerrain, 1, {})).toEqual({ '4,5': 'mountains' });
        });

        it('ignores hexes outside the grid while dragging', () => {
            const getHex = (e) => (e.clientX === 0 ? HEX : { q: -1, r: 3 });
            const { result, setTerrain } = setup({ getHex });

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0 }, TOOL_PAINT);
            });
            expect(setTerrain).toHaveBeenCalledTimes(1);

            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10 }, TOOL_PAINT);
            });

            expect(setTerrain).toHaveBeenCalledTimes(1);
        });

        it('adds new rivers while dragging without toggling existing ones off', () => {
            const getHex = (e) => (e.clientX < 5 ? HEX : { q: 4, r: 5 });
            const { result, setRivers } = setup({ getHex });

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0 }, TOOL_RIVER);
            });
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10 }, TOOL_RIVER);
            });

            const downResult = applyUpdater(setRivers, 0, []);
            expect(applyUpdater(setRivers, 1, downResult)).toEqual([HEX_KEY, '4,5']);
        });

        it('does not duplicate a river when dragging over a hex that already has one', () => {
            const { result, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_RIVER);
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_RIVER);
            });

            const downResult = applyUpdater(setRivers, 0, []);
            expect(applyUpdater(setRivers, 1, downResult)).toEqual([HEX_KEY]);
        });
    });

    describe('handleTerrainPointerUp', () => {
        it('stops terrain painting until the pointer is pressed again', () => {
            const { result, setTerrain } = setup({ selectedTerrain: 'mountains' });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });
            expect(setTerrain).toHaveBeenCalledTimes(1);

            act(() => {
                result.current.handleTerrainPointerUp();
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_PAINT);
            });
            expect(setTerrain).toHaveBeenCalledTimes(1);

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_PAINT);
            });
            expect(setTerrain).toHaveBeenCalledTimes(3);
        });

        it('stops river painting until the pointer is pressed again', () => {
            const { result, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_RIVER);
            });
            expect(setRivers).toHaveBeenCalledTimes(1);

            act(() => {
                result.current.handleTerrainPointerUp();
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_RIVER);
            });
            expect(setRivers).toHaveBeenCalledTimes(1);

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_RIVER);
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_RIVER);
            });
            expect(setRivers).toHaveBeenCalledTimes(3);
        });
    });
});
