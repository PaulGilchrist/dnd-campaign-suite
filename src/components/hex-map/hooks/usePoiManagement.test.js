// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePoiManagement from './usePoiManagement.js';
vi.mock('../../../services/maps/hexMapUtils.js', () => ({
    isRoadConnectable: vi.fn((typeA, typeB) =>
        ['city', 'settlement'].includes(typeA) && ['city', 'settlement'].includes(typeB)
    ),
    findHexPath: vi.fn(() => [
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
    ]),
}));

vi.mock('../../../config/outdoorConfig.js', () => ({
    TOOL_ROAD: 'road',
}));

describe('usePoiManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const basePois = [
        { id: 'poi-1', label: 'City A', type: 'city', q: 1, r: 0, visible: true },
        { id: 'poi-2', label: 'Settlement B', type: 'settlement', q: 3, r: 0, visible: true },
        { id: 'poi-3', label: 'Dungeon C', type: 'dungeon', q: 5, r: 0, visible: false },
    ];
    const baseRoads = [];
    const baseTerrain = {};
    const hexCols = 10;
    const hexRows = 10;
    const getHexFromEvent = vi.fn(() => ({ q: 2, r: 0 }));

    const render = (propsOverrides = {}) =>
        renderHook(
            ({ pois, setPois, roads, setRoads, terrain, hexCols, hexRows, getHexFromEvent, tool }) =>
                usePoiManagement(pois, setPois, roads, setRoads, terrain, hexCols, hexRows, getHexFromEvent, tool),
            {
                initialProps: {
                    pois: basePois,
                    setPois: vi.fn(),
                    roads: baseRoads,
                    setRoads: vi.fn(),
                    terrain: baseTerrain,
                    hexCols,
                    hexRows,
                    getHexFromEvent,
                    tool: 'none',
                    ...propsOverrides,
                },
            }
        );

    describe('handlePoiContextMenu', () => {
        it('sets selectedPoiMenu with poi coordinates when called with a valid poiId', () => {
            const { result } = render();
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            expect(result.current.selectedPoiMenu).toEqual({ id: 'poi-1', q: 1, r: 0 });
        });
    });

    describe('handleTogglePoiVisibility', () => {
        it('toggles visible for the specified poi and clears the menu', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleTogglePoiVisibility('poi-1');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[0].visible).toBe(false);
            expect(result2[1].visible).toBe(true);
            expect(result2[2].visible).toBe(false);
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleDeletePoi', () => {
        it('removes the poi and its connected roads', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const roads = [
                { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: ['1,0', '2,0'] },
                { id: 'road-2', fromPoiId: 'poi-2', toPoiId: 'poi-3', hexes: ['3,0', '4,0'] },
                { id: 'road-3', fromPoiId: 'poi-1', toPoiId: 'poi-3', hexes: ['1,0', '2,0', '3,0'] },
            ];
            const { result } = render({ setPois, setRoads, roads });
            act(() => {
                result.current.handleDeletePoi('poi-2');
            });
            const poiUpdater = setPois.mock.calls[0][0];
            const poisResult = poiUpdater(basePois);
            expect(poisResult.length).toBe(2);
            expect(poisResult.find(p => p.id === 'poi-2')).toBeUndefined();
            const roadUpdater = setRoads.mock.calls[0][0];
            const roadsResult = roadUpdater(roads);
            expect(roadsResult.length).toBe(1);
            expect(roadsResult[0].id).toBe('road-3');
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleRenamePoi', () => {
        it('updates the label and clears rename state', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleRenamePoi('poi-1', 'New City Name');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[0].label).toBe('New City Name');
            expect(result2[1].label).toBe('Settlement B');
            expect(result.current.showRename).toBeNull();
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleLinkMap', () => {
        it('sets linkedMap on the specified poi and clears the menu', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleLinkMap('poi-1', 'dungeon-map.json');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[0].linkedMap).toBe('dungeon-map.json');
            expect(result2[1].linkedMap).toBeUndefined();
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleUnlinkMap', () => {
        it('removes linkedMap from the specified poi and clears the menu', () => {
            const poisWithMap = [
                { ...basePois[0], linkedMap: 'some-map.json' },
                { ...basePois[1], linkedMap: 'map2.json' },
                basePois[2],
            ];
            const setPois = vi.fn();
            const { result } = render({ pois: poisWithMap, setPois });
            act(() => {
                result.current.handleUnlinkMap('poi-1');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(poisWithMap);
            expect(result2[0].linkedMap).toBeUndefined();
            expect(result2[1].linkedMap).toBe('map2.json');
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleRemoveRoads', () => {
        it('removes all roads where poi is either fromPoiId or toPoiId', () => {
            const setRoads = vi.fn();
            const roads = [
                { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: [] },
                { id: 'road-2', fromPoiId: 'poi-3', toPoiId: 'poi-1', hexes: [] },
                { id: 'road-3', fromPoiId: 'poi-2', toPoiId: 'poi-3', hexes: [] },
            ];
            const { result } = render({ roads, setRoads });
            act(() => {
                result.current.handleRemoveRoads('poi-1');
            });
            const updaterFn = setRoads.mock.calls[0][0];
            const result2 = updaterFn(roads);
            expect(result2.length).toBe(1);
            expect(result2[0].id).toBe('road-3');
        });
    });

    describe('handlePoiPointerDown', () => {
        it('sets poiDragging when tool is not road', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'poi' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockEvent.stopPropagation).toHaveBeenCalled();
            expect(result.current.poiDragging).toEqual({ poiId: 'poi-1', startQ: 1, startR: 0 });
        });

        it('creates a road when clicking two connectable pois with road tool', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };

            // First click: sets roadStartPoiId
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBe('poi-1');

            // Second click on different poi: creates road and clears start
            act(() => {
                result.current.handlePoiPointerDown('poi-2', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).toHaveBeenCalledWith(expect.any(Function));
        });

        it('clears roadStartPoiId when clicking the same poi again', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBeNull();
        });

        it('removes existing road when clicking a poi that already has a road to the start', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const roads = [
                {
                    id: 'road-1',
                    fromPoiId: 'poi-1',
                    toPoiId: 'poi-2',
                    hexes: ['1,0', '2,0', '3,0'],
                },
            ];
            const { result } = render({ setPois, setRoads, tool: 'road', roads });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-2', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBeNull();
            const updaterFn = setRoads.mock.calls[0][0];
            const roadsResult = updaterFn(roads);
            expect(roadsResult.length).toBe(0);
        });

        it('does not start road selection for non-connectable poi types', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-3', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBeNull();
        });
    });

    describe('handlePoiPointerMove', () => {
        it('updates poi position when dragging over a valid hex', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            getHexFromEvent.mockReturnValue({ q: 4, r: 1 });
            const { result } = render({ setPois, setRoads });
            const mockEvent = { clientX: 100, clientY: 100 };

            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });

            act(() => {
                result.current.handlePoiPointerMove(mockEvent);
            });

            expect(setPois).toHaveBeenCalledWith(expect.any(Function));
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[0].q).toBe(4);
            expect(result2[0].r).toBe(1);
        });

        it('does not move poi when target hex is out of bounds or occupied', () => {
            const outOfBoundsCases = [
                { q: -1, r: 0 },
                { q: 10, r: 0 },
                { q: 0, r: 10 },
            ];
            for (const hex of outOfBoundsCases) {
                getHexFromEvent.mockReturnValue(hex);
                const setPois = vi.fn();
                const setRoads = vi.fn();
                const { result } = render({ setPois, setRoads });
                const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
                act(() => {
                    result.current.handlePoiPointerDown('poi-1', downEvent);
                });
                act(() => {
                    result.current.handlePoiPointerMove({ clientX: 0, clientY: 0 });
                });
                expect(setPois).not.toHaveBeenCalled();
            }

            getHexFromEvent.mockReturnValue({ q: 3, r: 0 });
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result: occupiedResult } = render({ setPois, setRoads });
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                occupiedResult.current.handlePoiPointerDown('poi-1', downEvent);
            });
            act(() => {
                occupiedResult.current.handlePoiPointerMove({ clientX: 0, clientY: 0 });
            });
            expect(setPois).not.toHaveBeenCalled();
        });
    });

    describe('handlePoiPointerUp', () => {
        it('clears poiDragging', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads });
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });
            expect(result.current.poiDragging).not.toBeNull();
            act(() => {
                result.current.handlePoiPointerUp();
            });
            expect(result.current.poiDragging).toBeNull();
        });

        it('updates road hexes when poi was dragged and connected to another poi', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const roads = [
                {
                    id: 'road-1',
                    fromPoiId: 'poi-1',
                    toPoiId: 'poi-2',
                    hexes: ['1,0', '2,0', '3,0'],
                },
            ];
            getHexFromEvent.mockReturnValue({ q: 4, r: 1 });
            const { result } = render({ setPois, setRoads, roads });
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });
            act(() => {
                result.current.handlePoiPointerMove({ clientX: 100, clientY: 100 });
            });
            act(() => {
                result.current.handlePoiPointerUp();
            });
            expect(setRoads).toHaveBeenCalledWith(expect.any(Function));
        });
    });
});
