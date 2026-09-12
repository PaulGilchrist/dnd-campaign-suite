// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePoiManagement from './usePoiManagement.js';
import { isRoadConnectable, findHexPath } from '../../../services/maps/hexMapUtils.js';
import { TOOL_NONE, TOOL_POI, TOOL_ROAD } from '../../../config/outdoorConfig.js';

vi.mock('../../../services/maps/hexMapUtils.js', () => ({
    isRoadConnectable: vi.fn(),
    findHexPath: vi.fn(),
}));

const DEFAULT_HEX = { q: 2, r: 0 };
const DEFAULT_PATH = [
    { q: 1, r: 0 },
    { q: 2, r: 0 },
    { q: 3, r: 0 },
];

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
    beforeEach(() => {
        vi.clearAllMocks();
        isRoadConnectable.mockImplementation((typeA, typeB) =>
            ['city', 'settlement'].includes(typeA) && ['city', 'settlement'].includes(typeB)
        );
        findHexPath.mockImplementation(() => DEFAULT_PATH);
    });

    describe('handlePoiContextMenu', () => {
        it('sets selectedPoiMenu to the poi id and coordinates', () => {
            const { result } = setup();
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            expect(result.current.selectedPoiMenu).toEqual({ id: 'poi-1', q: 1, r: 0 });
        });

        it('does nothing for an unknown poi id', () => {
            const { result } = setup();
            act(() => {
                result.current.handlePoiContextMenu('missing-poi');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleTogglePoiVisibility', () => {
        it('toggles visible on the target poi and leaves the rest unchanged', () => {
            const { result, setPois } = setup();
            act(() => {
                result.current.handleTogglePoiVisibility('poi-1');
            });
            const nextPois = applyUpdater(setPois, 0, basePois);
            expect(nextPois).toHaveLength(3);
            expect(nextPois.find(p => p.id === 'poi-1').visible).toBe(false);
            expect(nextPois.find(p => p.id === 'poi-2').visible).toBe(true);
            expect(nextPois.find(p => p.id === 'poi-3').visible).toBe(false);
        });

        it('closes the selected poi menu when toggled', () => {
            const { result } = setup();
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            act(() => {
                result.current.handleTogglePoiVisibility('poi-1');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleDeletePoi', () => {
        const roads = [
            { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: ['1,0', '2,0'] },
            { id: 'road-2', fromPoiId: 'poi-2', toPoiId: 'poi-3', hexes: ['3,0', '4,0'] },
            { id: 'road-3', fromPoiId: 'poi-1', toPoiId: 'poi-3', hexes: ['1,0', '2,0', '3,0'] },
        ];

        it('removes the poi and every road that has it as an endpoint', () => {
            const { result, setPois, setRoads } = setup({ roads });
            act(() => {
                result.current.handleDeletePoi('poi-2');
            });
            const nextPois = applyUpdater(setPois, 0, basePois);
            expect(nextPois).toHaveLength(2);
            expect(nextPois.find(p => p.id === 'poi-2')).toBeUndefined();
            const nextRoads = applyUpdater(setRoads, 0, roads);
            expect(nextRoads.map(r => r.id)).toEqual(['road-3']);
        });

        it('closes the selected poi menu when deleted', () => {
            const { result } = setup({ roads });
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            act(() => {
                result.current.handleDeletePoi('poi-1');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleRenamePoi', () => {
        it('updates the label on the target poi and clears rename and menu state', () => {
            const { result, setPois } = setup();
            act(() => {
                result.current.handleRenamePoi('poi-1', 'New City Name');
            });
            const nextPois = applyUpdater(setPois, 0, basePois);
            expect(nextPois.find(p => p.id === 'poi-1').label).toBe('New City Name');
            expect(nextPois.find(p => p.id === 'poi-2').label).toBe('Settlement B');
            expect(result.current.showRename).toBeNull();
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleLinkMap', () => {
        it('sets linkedMap on the target poi and clears the menu', () => {
            const { result, setPois } = setup();
            act(() => {
                result.current.handleLinkMap('poi-1', 'dungeon-map.json');
            });
            const nextPois = applyUpdater(setPois, 0, basePois);
            expect(nextPois.find(p => p.id === 'poi-1').linkedMap).toBe('dungeon-map.json');
            expect(nextPois.find(p => p.id === 'poi-2').linkedMap).toBeUndefined();
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleUnlinkMap', () => {
        const poisWithMap = [
            { ...basePois[0], linkedMap: 'some-map.json' },
            { ...basePois[1], linkedMap: 'map2.json' },
            basePois[2],
        ];

        it('removes linkedMap from the target poi and keeps other maps', () => {
            const { result, setPois } = setup({ pois: poisWithMap });
            act(() => {
                result.current.handleUnlinkMap('poi-1');
            });
            const nextPois = applyUpdater(setPois, 0, poisWithMap);
            expect(nextPois.find(p => p.id === 'poi-1').linkedMap).toBeUndefined();
            expect(nextPois.find(p => p.id === 'poi-2').linkedMap).toBe('map2.json');
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleRemoveRoads', () => {
        const roads = [
            { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: [] },
            { id: 'road-2', fromPoiId: 'poi-3', toPoiId: 'poi-1', hexes: [] },
            { id: 'road-3', fromPoiId: 'poi-2', toPoiId: 'poi-3', hexes: [] },
        ];

        it('removes roads that have the poi as either endpoint', () => {
            const { result, setRoads } = setup({ roads });
            act(() => {
                result.current.handleRemoveRoads('poi-1');
            });
            const nextRoads = applyUpdater(setRoads, 0, roads);
            expect(nextRoads.map(r => r.id)).toEqual(['road-3']);
        });
    });

    describe('handlePoiPointerDown', () => {
        it('starts dragging for non-road tools and stops the event', () => {
            const { result } = setup({ tool: TOOL_POI });
            const event = pointerEvent();
            act(() => {
                result.current.handlePoiPointerDown('poi-1', event);
            });
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(result.current.poiDragging).toEqual({ poiId: 'poi-1', startQ: 1, startR: 0 });
        });

        it('does not start dragging for an unknown poi', () => {
            const { result } = setup({ tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerDown('missing-poi', pointerEvent());
            });
            expect(result.current.poiDragging).toBeNull();
        });

        it('creates a road between two connectable pois on the second click', () => {
            const { result, setRoads } = setup({ tool: TOOL_ROAD });
            const event = pointerEvent();
            act(() => {
                result.current.handlePoiPointerDown('poi-1', event);
            });
            expect(result.current.roadStartPoiId).toBe('poi-1');

            act(() => {
                result.current.handlePoiPointerDown('poi-2', event);
            });
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(isRoadConnectable).toHaveBeenCalledWith('settlement', 'settlement');
            expect(findHexPath).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'poi-1', q: 1, r: 0 }),
                expect.objectContaining({ id: 'poi-2', q: 3, r: 0 }),
                hexCols,
                hexRows,
                baseTerrain
            );
            const nextRoads = applyUpdater(setRoads, 0, baseRoads);
            expect(nextRoads).toHaveLength(1);
            expect(nextRoads[0]).toMatchObject({
                fromPoiId: 'poi-1',
                toPoiId: 'poi-2',
                hexes: ['1,0', '2,0', '3,0'],
            });
            expect(nextRoads[0].id).toMatch(/^road-/);
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

        it('removes the existing road between the two pois instead of creating a duplicate', () => {
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
            expect(findHexPath).not.toHaveBeenCalled();
            const nextRoads = applyUpdater(setRoads, 0, roads);
            expect(nextRoads).toEqual([]);
            expect(result.current.roadStartPoiId).toBeNull();
        });

        it('does not arm road selection for non-connectable poi types', () => {
            const { result, setRoads } = setup({ tool: TOOL_ROAD });
            act(() => {
                result.current.handlePoiPointerDown('poi-3', pointerEvent());
            });
            expect(isRoadConnectable).toHaveBeenCalledWith('dungeon', 'dungeon');
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });

        it('cancels a pending road selection when the second poi is not connectable', () => {
            const { result, setRoads } = setup({ tool: TOOL_ROAD });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-3', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });

        it('ignores an unknown poi with the road tool', () => {
            const { result, setRoads } = setup({ tool: TOOL_ROAD });
            act(() => {
                result.current.handlePoiPointerDown('missing-poi', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });

        it('clears the pending road when no path is found between the pois', () => {
            const { result, setRoads } = setup({ tool: TOOL_ROAD });
            findHexPath.mockReturnValue(null);
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-2', pointerEvent());
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });
    });

    describe('handlePoiPointerMove', () => {
        it('moves the dragged poi to the hex under the pointer', () => {
            const getHex = vi.fn(() => ({ q: 4, r: 1 }));
            const { result, setPois, setRoads } = setup({ getHex, tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            const nextPois = applyUpdater(setPois, 0, basePois);
            expect(nextPois.find(p => p.id === 'poi-1')).toMatchObject({ q: 4, r: 1 });
            expect(nextPois.find(p => p.id === 'poi-2')).toMatchObject({ q: 3, r: 0 });
            expect(setRoads).not.toHaveBeenCalled();
        });

        it('does nothing when no poi is being dragged', () => {
            const { result, setPois } = setup({ tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            expect(setPois).not.toHaveBeenCalled();
        });

        it('does nothing when the event does not resolve to a hex', () => {
            const getHex = vi.fn(() => null);
            const { result, setPois } = setup({ getHex, tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            expect(setPois).not.toHaveBeenCalled();
        });

        it.each([
            ['negative column', { q: -1, r: 0 }],
            ['negative row', { q: 0, r: -1 }],
            ['column at the grid edge', { q: hexCols, r: 0 }],
            ['row at the grid edge', { q: 0, r: hexRows }],
        ])('does not move the poi to an out-of-bounds hex (%s)', (_, hex) => {
            const getHex = vi.fn(() => hex);
            const { result, setPois } = setup({ getHex, tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            expect(setPois).not.toHaveBeenCalled();
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
        it('clears the dragging state', () => {
            const { result } = setup({ tool: TOOL_POI });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerUp();
            });
            expect(result.current.poiDragging).toBeNull();
        });

        it('re-paths roads connected to the poi after it is dropped at a new position', () => {
            const roads = [
                { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: ['1,0', '2,0', '3,0'] },
            ];
            const { result, rerender, setPois, setRoads, getHex } = setup({
                roads,
                getHex: vi.fn(() => ({ q: 4, r: 1 })),
                tool: TOOL_POI,
            });
            findHexPath.mockReturnValue([{ q: 9, r: 9 }, { q: 8, r: 8 }]);

            act(() => {
                result.current.handlePoiPointerDown('poi-1', pointerEvent());
            });
            act(() => {
                result.current.handlePoiPointerMove({});
            });
            const nextPois = applyUpdater(setPois, 0, basePois);
            rerender({
                pois: nextPois,
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
            expect(findHexPath).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'poi-1', q: 4, r: 1 }),
                expect.objectContaining({ id: 'poi-2' }),
                hexCols,
                hexRows,
                baseTerrain
            );
            expect(nextRoads[0].hexes).toEqual(['9,9', '8,8']);
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
