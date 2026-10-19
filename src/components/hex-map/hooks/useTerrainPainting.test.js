// @maintained-by-ai
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
        it.each([
            ['no hex at all', null],
            ['negative column', { q: -1, r: 3 }],
            ['negative row', { q: 2, r: -1 }],
            ['column past the last column', { q: 10, r: 3 }],
            ['row past the last row', { q: 2, r: 10 }],
        ])('writes nothing when the event resolves to %s', (_, hex) => {
            const { result, setTerrain, setRivers } = setup({ getHex: () => hex });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('paints the selected terrain on the hex, preserving terrain on other hexes', () => {
            const { result, setTerrain, setRivers } = setup({ selectedTerrain: 'mountains' });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });

            expect(setTerrain).toHaveBeenCalledTimes(1);
            expect(setRivers).not.toHaveBeenCalled();
            expect(applyUpdater(setTerrain, 0, { '4,5': 'desert' })).toEqual({
                '4,5': 'desert',
                [HEX_KEY]: 'mountains',
            });
        });

        it('erasing removes only the targeted hex', () => {
            const { result, setTerrain, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_ERASE);
            });

            expect(setRivers).not.toHaveBeenCalled();
            expect(applyUpdater(setTerrain, 0, { [HEX_KEY]: 'forest', '4,5': 'desert' })).toEqual({
                '4,5': 'desert',
            });
        });

        it('toggles a river on the hex without touching terrain', () => {
            const { result, setTerrain, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_RIVER);
            });

            expect(setTerrain).not.toHaveBeenCalled();
            const updater = setRivers.mock.calls[0][0];
            expect(updater([])).toEqual([HEX_KEY]);
            expect(updater([HEX_KEY])).toEqual([]);
        });
    });

    describe('handleTerrainPointerMove', () => {
        it('writes nothing for paint or river drags before the pointer was pressed', () => {
            const { result, setTerrain, setRivers } = setup();

            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_PAINT);
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_RIVER);
            });

            expect(setTerrain).not.toHaveBeenCalled();
            expect(setRivers).not.toHaveBeenCalled();
        });

        it('paints each hex visited while dragging, preserving earlier paints', () => {
            const getHex = (e) => (e.clientX < 5 ? HEX : { q: 4, r: 5 });
            const { result, setTerrain } = setup({ getHex, selectedTerrain: 'mountains' });

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0 }, TOOL_PAINT);
            });
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10 }, TOOL_PAINT);
            });

            const afterDown = applyUpdater(setTerrain, 0, {});
            expect(afterDown).toEqual({ [HEX_KEY]: 'mountains' });
            expect(applyUpdater(setTerrain, 1, afterDown)).toEqual({
                [HEX_KEY]: 'mountains',
                '4,5': 'mountains',
            });
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

        it('river drags append new hexes without duplicating or toggling existing ones', () => {
            const getHex = (e) => (e.clientX < 5 ? HEX : { q: 4, r: 5 });
            const { result, setRivers } = setup({ getHex });

            act(() => {
                result.current.handleTerrainPointerDown({ clientX: 0 }, TOOL_RIVER);
            });
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 10 }, TOOL_RIVER);
            });
            act(() => {
                result.current.handleTerrainPointerMove({ clientX: 0 }, TOOL_RIVER);
            });

            const afterDown = applyUpdater(setRivers, 0, []);
            const afterNewHex = applyUpdater(setRivers, 1, afterDown);
            expect(afterNewHex).toEqual([HEX_KEY, '4,5']);
            expect(applyUpdater(setRivers, 2, afterNewHex)).toEqual([HEX_KEY, '4,5']);
        });
    });

    describe('handleTerrainPointerUp', () => {
        it('paints only while the pointer is held down, in both lanes', () => {
            const { result, setTerrain, setRivers } = setup({ selectedTerrain: 'mountains' });

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_PAINT);
            });
            expect(setTerrain).toHaveBeenCalledTimes(2);

            act(() => {
                result.current.handleTerrainPointerUp();
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_PAINT);
            });
            expect(setTerrain).toHaveBeenCalledTimes(2);

            act(() => {
                result.current.handleTerrainPointerDown({}, TOOL_PAINT);
            });
            act(() => {
                result.current.handleTerrainPointerMove({}, TOOL_PAINT);
            });
            expect(setTerrain).toHaveBeenCalledTimes(4);

            // The river lane shares the same press gate: down toggles once,
            // then moves after release are ignored.
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
        });
    });
});
