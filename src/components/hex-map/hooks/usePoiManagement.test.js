// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePoiManagement from './usePoiManagement.js';
import { TOOL_NONE, TOOL_POI, TOOL_ROAD } from '../../../config/outdoorConfig.js';

// hexMapUtils is pure (no side effects, no DOM) — kept real, not mocked.
// findHexPath on an open all-plains grid returns the unique optimal path
// between two hexes 2 steps apart on the same row, so created-road hexes
// are pinned exactly; repaths are checked by endpoints + optimal length.

const DEFAULT_HEX = { q: 2, r: 0 };

const basePois = [
    { id: 'poi-1', label: 'City A', type: 'city', q: 1, r: 0, visible: true },
    { id: 'poi-2', label: 'Settlement B', type: 'settlement', q: 3, r: 0, visible: true },
    { id: 'poi-3', label: 'Dungeon C', type: 'dungeon', q: 5, r: 0, visible: false },
];
const baseRoads = [];
const baseTerrain = {};
const hexCols = 10;
const hexRows = 10;

const setup = ({ getHex, ...overrides } = {}) => {
    const setPois = vi.fn();
    const setRoads = vi.fn();
    const props = {
        pois: basePois,
        setPois,
        roads: baseRoads,
        setRoads,
        terrain: baseTerrain,
        hexCols,
        hexRows,
        getHexFromEvent: getHex ?? vi.fn(() => DEFAULT_HEX),
        tool: TOOL_NONE,
        ...overrides,
    };
    const hook = renderHook(
        (options) => usePoiManagement(options),
        { initialProps: props }
    );
    return { ...hook, setPois, setRoads, getHex: props.getHexFromEvent };
};

const applyUpdater = (mock, callIndex, initialState) => mock.mock.calls[callIndex][0](initialState);
const pointerEvent = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() });

describe('usePoiManagement', () => {
    it('opens the POI menu at the clicked poi and leaves it untouched for unknown ids', () => {
        const { result } = setup();
        act(() => {
            result.current.handlePoiContextMenu('poi-1');
        });
        expect(result.current.selectedPoiMenu).toEqual({ id: 'poi-1', q: 1, r: 0 });

        act(() => {
            result.current.handlePoiContextMenu('missing-poi');
        });
        expect(result.current.selectedPoiMenu).toEqual({ id: 'poi-1', q: 1, r: 0 });
    });

    it('toggles visibility of exactly the target poi and closes the menu', () => {
        const { result, setPois } = setup();
        act(() => {
            result.current.handlePoiContextMenu('poi-1');
        });
        act(() => {
            result.current.handleTogglePoiVisibility('poi-1');
        });
        expect(applyUpdater(setPois, 0, basePois)).toEqual([
            { id: 'poi-1', label: 'City A', type: 'city', q: 1, r: 0, visible: false },
            basePois[1],
            basePois[2],
        ]);
        expect(result.current.selectedPoiMenu).toBeNull();
    });

    it('deletes the poi and every road touching it, and closes the menu', () => {
        const roads = [
            { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: ['1,0', '2,0'] },
            { id: 'road-2', fromPoiId: 'poi-2', toPoiId: 'poi-3', hexes: ['3,0', '4,0'] },
            { id: 'road-3', fromPoiId: 'poi-1', toPoiId: 'poi-3', hexes: ['1,0', '2,0', '3,0'] },
        ];
        const { result, setPois, setRoads } = setup({ roads });
        // The named confirm lives in POIContextMenu.jsx (menu layer, mirroring the
        // indoor token-removal lane) — the handler stays confirm-free so the menu
        // gates exactly once (no double-confirm on the accept leg).
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        act(() => {
            result.current.handlePoiContextMenu('poi-1');
        });
        act(() => {
            result.current.handleDeletePoi('poi-2');
        });
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
        expect(applyUpdater(setPois, 0, basePois)).toEqual([basePois[0], basePois[2]]);
        expect(applyUpdater(setRoads, 0, roads).map(r => r.id)).toEqual(['road-3']);
        expect(result.current.selectedPoiMenu).toBeNull();
    });

    it('renames the target poi only and clears rename plus menu state', () => {
        const { result, setPois } = setup();
        act(() => {
            result.current.handleRenamePoi('poi-1', 'New City Name');
        });
        expect(applyUpdater(setPois, 0, basePois)).toEqual([
            { id: 'poi-1', label: 'New City Name', type: 'city', q: 1, r: 0, visible: true },
            basePois[1],
            basePois[2],
        ]);
        expect(result.current.showRename).toBeNull();
        expect(result.current.selectedPoiMenu).toBeNull();
    });

    it('trims surrounding whitespace before committing a rename', () => {
        const { result, setPois } = setup();
        act(() => {
            result.current.handleRenamePoi('poi-1', '  Old Bridge  ');
        });
        expect(applyUpdater(setPois, 0, basePois)[0].label).toBe('Old Bridge');
    });

    it.each([
        { name: 'spaces only', newLabel: '   ' },
        { name: 'empty string', newLabel: '' },
        { name: 'tabs and newlines', newLabel: '\t\n ' },
        { name: 'non-string value', newLabel: undefined },
    ])('keeps the previous label for a whitespace-only rename ($name) but still closes the editor and menu', ({ newLabel }) => {
        const { result, setPois } = setup();
        act(() => {
            result.current.handlePoiContextMenu('poi-1');
        });
        act(() => {
            result.current.handleRenamePoi('poi-1', newLabel);
        });
        expect(setPois).not.toHaveBeenCalled();
        expect(result.current.showRename).toBeNull();
        expect(result.current.selectedPoiMenu).toBeNull();
    });

    it('links then unlinks a map on the target poi without disturbing other pois', () => {
        const { result, setPois } = setup();
        act(() => {
            result.current.handleLinkMap('poi-1', 'dungeon-map.json');
        });
        const linked = applyUpdater(setPois, 0, basePois);
        expect(linked).toEqual([
            { ...basePois[0], linkedMap: 'dungeon-map.json' },
            basePois[1],
            basePois[2],
        ]);
        expect(result.current.selectedPoiMenu).toBeNull();

        act(() => {
            result.current.handleLinkMap('poi-2', 'map2.json');
        });
        const linkedBoth = applyUpdater(setPois, 1, linked);
        act(() => {
            result.current.handleUnlinkMap('poi-1');
        });
        const unlinked = applyUpdater(setPois, 2, linkedBoth);
        expect(unlinked[0].linkedMap).toBeUndefined();
        expect(unlinked[1].linkedMap).toBe('map2.json');
        expect(unlinked[2].linkedMap).toBeUndefined();
    });

    it('removes roads having the poi as either endpoint', () => {
        const roads = [
            { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: [] },
            { id: 'road-2', fromPoiId: 'poi-3', toPoiId: 'poi-1', hexes: [] },
            { id: 'road-3', fromPoiId: 'poi-2', toPoiId: 'poi-3', hexes: [] },
        ];
        const { result, setRoads } = setup({ roads });
        act(() => {
            result.current.handleRemoveRoads('poi-1');
        });
        expect(applyUpdater(setRoads, 0, roads)).toEqual([roads[2]]);
    });

    describe('handlePoiPointerDown', () => {
        it('starts a drag at the poi position and claims the event', () => {
            const { result } = setup({ tool: TOOL_POI });
            const event = pointerEvent();
            act(() => {
                result.current.handlePoiPointerDown('poi-1', event);
            });
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(result.current.poiDragging).toEqual({ poiId: 'poi-1', startQ: 1, startR: 0 });
        });

        it.each([
            ['poi tool', TOOL_POI],
            ['road tool', TOOL_ROAD],
        ])('ignores an unknown poi (%s)', (_name, tool) => {
            const { result, setRoads } = setup({ tool });
            act(() => {
                result.current.handlePoiPointerDown('missing-poi', pointerEvent());
            });
            expect(result.current.poiDragging).toBeNull();
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });
    });

    describe('road tool selection', () => {
        it('creates a road between two connectable pois on the second click and disarms', () => {
            const { result, setRoads } = setup({ tool: TOOL_ROAD });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBe('poi-1');

            act(() => {
                result.current.handlePoiPointerDown('poi-2', pointerEvent());
            });
            expect(applyUpdater(setRoads, 0, baseRoads)).toEqual([{
                id: expect.stringMatching(/^road-\d+-[a-z0-9]+$/),
                fromPoiId: 'poi-1',
                toPoiId: 'poi-2',
                hexes: ['1,0', '2,0', '3,0'],
            }]);
            expect(result.current.roadStartPoiId).toBeNull();
        });

        it('cancels the pending road when the same poi is clicked again', () => {
            const { result, setRoads } = setup({ tool: TOOL_ROAD });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });

        it('removes the existing road between two pois instead of creating a duplicate', () => {
            const roads = [
                { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: ['1,0', '2,0', '3,0'] },
            ];
            const { result, setRoads } = setup({ roads, tool: TOOL_ROAD });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-2', pointerEvent());
            });
            expect(applyUpdater(setRoads, 0, roads)).toEqual([]);
            expect(result.current.roadStartPoiId).toBeNull();
        });

        it('never arms or completes a road through a non-connectable poi type', () => {
            const { result, setRoads } = setup({ tool: TOOL_ROAD });
            act(() => {
                result.current.handlePoiPointerDown('poi-3', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBeNull();

            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBe('poi-1');

            act(() => {
                result.current.handlePoiPointerDown('poi-3', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });

        it('clears the pending road when no path exists between the pois', () => {
            // hexCols of 2 makes q=3 unreachable for the real A* pathfinder.
            const { result, setRoads } = setup({ tool: TOOL_ROAD, hexCols: 2 });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBe('poi-1');

            act(() => {
                result.current.handlePoiPointerDown('poi-2', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });
    });

    describe('handlePoiPointerMove', () => {
        it('moves only the dragged poi to the hex under the pointer', () => {
            const getHex = vi.fn(() => ({ q: 4, r: 1 }));
            const { result, setPois } = setup({ getHex, tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            expect(applyUpdater(setPois, 0, basePois)).toEqual([
                { ...basePois[0], q: 4, r: 1 },
                basePois[1],
                basePois[2],
            ]);
        });

        it('does nothing without an active drag or an unresolved hex', () => {
            const getHex = vi.fn(() => ({ q: 4, r: 1 }));
            const { result, setPois } = setup({ getHex, tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            getHex.mockReturnValue(null);
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            expect(setPois).not.toHaveBeenCalled();
        });

        it('rejects every out-of-bounds hex but still allows a valid one', () => {
            const getHex = vi.fn();
            const { result, setPois } = setup({ getHex, tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            for (const hex of [{ q: -1, r: 0 }, { q: 0, r: -1 }, { q: hexCols, r: 0 }, { q: 0, r: hexRows }]) {
                getHex.mockReturnValue(hex);
                act(() => {
                    result.current.handlePoiPointerMove({});
                });
            }
            expect(setPois).not.toHaveBeenCalled();

            getHex.mockReturnValue({ q: 4, r: 1 });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            expect(setPois).toHaveBeenCalledTimes(1);
        });

        it('does not move the poi onto a hex occupied by another poi', () => {
            const getHex = vi.fn(() => ({ q: 3, r: 0 }));
            const { result, setPois } = setup({ getHex, tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            expect(setPois).not.toHaveBeenCalled();
        });
    });

    describe('handlePoiPointerUp', () => {
        it('re-paths connected roads to the dropped position and clears the drag', () => {
            const roads = [
                { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: ['1,0', '2,0', '3,0'] },
                { id: 'road-2', fromPoiId: 'poi-2', toPoiId: 'poi-3', hexes: ['3,0', '4,0'] },
            ];
            const getHex = vi.fn(() => ({ q: 4, r: 1 }));
            const { result, rerender, setPois, setRoads } = setup({ roads, getHex, tool: TOOL_POI });

            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            const movedPois = applyUpdater(setPois, 0, basePois);
            rerender({
                pois: movedPois,
                setPois,
                roads,
                setRoads,
                terrain: baseTerrain,
                hexCols,
                hexRows,
                getHexFromEvent: getHex,
                tool: TOOL_POI,
            });
            act(() => {
                result.current.handlePoiPointerUp();
            });

            const nextRoads = applyUpdater(setRoads, 0, roads);
            const repathed = nextRoads.find(r => r.id === 'road-1');
            expect(repathed.hexes[0]).toBe('4,1');
            expect(repathed.hexes.at(-1)).toBe('3,0');
            expect(repathed.hexes).toHaveLength(3);
            expect(nextRoads.find(r => r.id === 'road-2')).toEqual(roads[1]);
            expect(result.current.poiDragging).toBeNull();
        });

        it('does not touch roads when nothing was dragged', () => {
            const { result, setRoads } = setup();
            act(() => {
                result.current.handlePoiPointerUp();
            });
            expect(setRoads).not.toHaveBeenCalled();
        });
    });
});
