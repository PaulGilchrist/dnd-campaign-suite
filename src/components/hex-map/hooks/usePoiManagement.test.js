import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePoiManagement from './usePoiManagement.js';
import * as hexMapUtils from '../../../services/maps/hexMapUtils.js';

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

    describe('initial state', () => {
        it('returns selectedPoiMenu as null initially', () => {
            const { result } = render();
            expect(result.current.selectedPoiMenu).toBeNull();
        });

        it('returns showRename as null initially', () => {
            const { result } = render();
            expect(result.current.showRename).toBeNull();
        });

        it('returns poiDragging as null initially', () => {
            const { result } = render();
            expect(result.current.poiDragging).toBeNull();
        });

        it('returns roadStartPoiId as null initially', () => {
            const { result } = render();
            expect(result.current.roadStartPoiId).toBeNull();
        });
    });

    describe('returned object shape', () => {
        it('returns all expected properties', () => {
            const { result } = render();
            const keys = Object.keys(result.current);
            expect(keys).toContain('selectedPoiMenu');
            expect(keys).toContain('setSelectedPoiMenu');
            expect(keys).toContain('showRename');
            expect(keys).toContain('setShowRename');
            expect(keys).toContain('poiDragging');
            expect(keys).toContain('roadStartPoiId');
            expect(keys).toContain('setRoadStartPoiId');
            expect(keys).toContain('handlePoiPointerDown');
            expect(keys).toContain('handlePoiPointerMove');
            expect(keys).toContain('handlePoiPointerUp');
            expect(keys).toContain('handlePoiContextMenu');
            expect(keys).toContain('handleTogglePoiVisibility');
            expect(keys).toContain('handleDeletePoi');
            expect(keys).toContain('handleRenamePoi');
            expect(keys).toContain('handleLinkMap');
            expect(keys).toContain('handleUnlinkMap');
            expect(keys).toContain('handleRemoveRoads');
        });

        it('returns state setters as functions', () => {
            const { result } = render();
            expect(typeof result.current.setSelectedPoiMenu).toBe('function');
            expect(typeof result.current.setShowRename).toBe('function');
            expect(typeof result.current.setRoadStartPoiId).toBe('function');
        });

        it('returns all handlers as functions', () => {
            const { result } = render();
            const handlers = [
                'handlePoiPointerDown',
                'handlePoiPointerMove',
                'handlePoiPointerUp',
                'handlePoiContextMenu',
                'handleTogglePoiVisibility',
                'handleDeletePoi',
                'handleRenamePoi',
                'handleLinkMap',
                'handleUnlinkMap',
                'handleRemoveRoads',
            ];
            for (const h of handlers) {
                expect(typeof result.current[h]).toBe('function');
            }
        });
    });

    describe('handlePoiContextMenu', () => {
        it('sets selectedPoiMenu when called with a valid poiId', () => {
            const { result } = render();
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            expect(result.current.selectedPoiMenu).toEqual({ id: 'poi-1', q: 1, r: 0 });
        });

        it('returns poi properties matching the found poi', () => {
            const { result } = render();
            act(() => {
                result.current.handlePoiContextMenu('poi-2');
            });
            expect(result.current.selectedPoiMenu.id).toBe('poi-2');
            expect(result.current.selectedPoiMenu.q).toBe(3);
            expect(result.current.selectedPoiMenu.r).toBe(0);
        });

        it('does nothing when poiId does not exist', () => {
            const { result } = render();
            act(() => {
                result.current.handlePoiContextMenu('nonexistent');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleTogglePoiVisibility', () => {
        it('toggles visible from true to false', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleTogglePoiVisibility('poi-1');
            });
            expect(setPois).toHaveBeenCalledWith(expect.any(Function));
            // Extract the function argument and call it to verify behavior
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[0].visible).toBe(false);
            expect(result2[1].visible).toBe(true);
            expect(result2[2].visible).toBe(false);
        });

        it('toggles visible from false to true', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleTogglePoiVisibility('poi-3');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[2].visible).toBe(true);
        });

        it('clears selectedPoiMenu after toggling', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            expect(result.current.selectedPoiMenu).not.toBeNull();
            act(() => {
                result.current.handleTogglePoiVisibility('poi-1');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });

        it('only toggles the specified poi, leaves others unchanged', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleTogglePoiVisibility('poi-1');
            });
            const call = setPois.mock.calls[0][0];
            const updated = call(basePois);
            expect(updated[0].visible).toBe(false);
            expect(updated[1].visible).toBe(true);
            expect(updated[2].visible).toBe(false);
        });
    });

    describe('handleDeletePoi', () => {
        it('removes the poi from the pois array', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads });
            act(() => {
                result.current.handleDeletePoi('poi-2');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2.length).toBe(2);
            expect(result2.find(p => p.id === 'poi-2')).toBeUndefined();
        });

        it('removes roads connected to the deleted poi', () => {
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
            const roadUpdater = setRoads.mock.calls[0][0];
            const result2 = roadUpdater(roads);
            expect(result2.length).toBe(1);
            expect(result2[0].id).toBe('road-3');
        });

        it('clears selectedPoiMenu after deleting', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads });
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            expect(result.current.selectedPoiMenu).not.toBeNull();
            act(() => {
                result.current.handleDeletePoi('poi-1');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleRenamePoi', () => {
        it('updates the label of the specified poi', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleRenamePoi('poi-1', 'New City Name');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[0].label).toBe('New City Name');
            expect(result2[1].label).toBe('Settlement B');
        });

        it('clears showRename after renaming', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.setShowRename('poi-1');
            });
            expect(result.current.showRename).toBe('poi-1');
            act(() => {
                result.current.handleRenamePoi('poi-1', 'Renamed');
            });
            expect(result.current.showRename).toBeNull();
        });

        it('clears selectedPoiMenu after renaming', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            act(() => {
                result.current.handleRenamePoi('poi-1', 'Renamed');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleLinkMap', () => {
        it('sets linkedMap on the specified poi', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleLinkMap('poi-1', 'dungeon-map.json');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[0].linkedMap).toBe('dungeon-map.json');
        });

        it('does not affect other pois', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handleLinkMap('poi-1', 'map1.json');
            });
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[1].linkedMap).toBeUndefined();
            expect(result2[2].linkedMap).toBeUndefined();
        });

        it('clears selectedPoiMenu after linking', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            act(() => {
                result.current.handleLinkMap('poi-1', 'map1.json');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleUnlinkMap', () => {
        it('removes linkedMap from the specified poi', () => {
            const poisWithMap = [
                { ...basePois[0], linkedMap: 'some-map.json' },
                basePois[1],
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
        });

        it('does not affect other pois linkedMaps', () => {
            const poisWithMap = [
                { ...basePois[0], linkedMap: 'map1.json' },
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
            expect(result2[1].linkedMap).toBe('map2.json');
        });

        it('clears selectedPoiMenu after unlinking', () => {
            const setPois = vi.fn();
            const { result } = render({ setPois });
            act(() => {
                result.current.handlePoiContextMenu('poi-1');
            });
            act(() => {
                result.current.handleUnlinkMap('poi-1');
            });
            expect(result.current.selectedPoiMenu).toBeNull();
        });
    });

    describe('handleRemoveRoads', () => {
        it('removes all roads connected to the specified poi', () => {
            const setRoads = vi.fn();
            const roads = [
                { id: 'road-1', fromPoiId: 'poi-1', toPoiId: 'poi-2', hexes: [] },
                { id: 'road-2', fromPoiId: 'poi-1', toPoiId: 'poi-3', hexes: [] },
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

        it('removes nothing when poi has no roads', () => {
            const setRoads = vi.fn();
            const roads = [
                { id: 'road-1', fromPoiId: 'poi-2', toPoiId: 'poi-3', hexes: [] },
            ];
            const { result } = render({ roads, setRoads });
            act(() => {
                result.current.handleRemoveRoads('poi-1');
            });
            const updaterFn = setRoads.mock.calls[0][0];
            const result2 = updaterFn(roads);
            expect(result2.length).toBe(1);
        });

        it('removes roads where poi is either from or to', () => {
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

    describe('handlePoiPointerDown — non-road tool', () => {
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

        it('does nothing when poiId does not exist', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'poi' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('nonexistent', mockEvent);
            });
            expect(result.current.poiDragging).toBeNull();
        });
    });

    describe('handlePoiPointerDown — road tool', () => {
        it('sets roadStartPoiId when first poi is clicked', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBe('poi-1');
        });

        it('clears roadStartPoiId when clicking the same poi again', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBe('poi-1');
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBeNull();
        });

        it('creates a road when clicking a different connectable poi', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-2', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).toHaveBeenCalledWith(expect.any(Function));
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
            expect(setRoads).toHaveBeenCalledWith(expect.any(Function));
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

        it('does not create a road when findHexPath returns null', () => {
            vi.mocked(hexMapUtils.findHexPath).mockReturnValue(null);
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-2', mockEvent);
            });
            expect(setRoads).not.toHaveBeenCalled();
            expect(result.current.roadStartPoiId).toBeNull();
        });
    });

    describe('handlePoiPointerMove', () => {
        it('does nothing when not dragging', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads });
            const mockEvent = { clientX: 100, clientY: 100 };
            act(() => {
                result.current.handlePoiPointerMove(mockEvent);
            });
            expect(setPois).not.toHaveBeenCalled();
        });

        it('updates poi position when dragging over a valid hex', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            getHexFromEvent.mockReturnValue({ q: 4, r: 1 });
            const { result } = render({ setPois, setRoads });
            const mockEvent = { clientX: 100, clientY: 100 };

            // First start dragging
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });

            // Then move
            act(() => {
                result.current.handlePoiPointerMove(mockEvent);
            });

            expect(setPois).toHaveBeenCalledWith(expect.any(Function));
            const updaterFn = setPois.mock.calls[0][0];
            const result2 = updaterFn(basePois);
            expect(result2[0].q).toBe(4);
            expect(result2[0].r).toBe(1);
        });

        it('does not move poi when hex is out of bounds (negative q)', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            getHexFromEvent.mockReturnValue({ q: -1, r: 0 });
            const { result } = render({ setPois, setRoads });
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });
            act(() => {
                result.current.handlePoiPointerMove({ clientX: 0, clientY: 0 });
            });
            expect(setPois).not.toHaveBeenCalled();
        });

        it('does not move poi when hex q exceeds grid width', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            getHexFromEvent.mockReturnValue({ q: 10, r: 0 });
            const { result } = render({ setPois, setRoads });
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });
            act(() => {
                result.current.handlePoiPointerMove({ clientX: 0, clientY: 0 });
            });
            expect(setPois).not.toHaveBeenCalled();
        });

        it('does not move poi when hex r exceeds grid height', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            getHexFromEvent.mockReturnValue({ q: 0, r: 10 });
            const { result } = render({ setPois, setRoads });
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });
            act(() => {
                result.current.handlePoiPointerMove({ clientX: 0, clientY: 0 });
            });
            expect(setPois).not.toHaveBeenCalled();
        });

        it('does not move poi when target hex already has another poi', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            getHexFromEvent.mockReturnValue({ q: 3, r: 0 });
            const { result } = render({ setPois, setRoads });
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });
            act(() => {
                result.current.handlePoiPointerMove({ clientX: 0, clientY: 0 });
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

        it('does not call setRoads when not dragging', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads });
            act(() => {
                result.current.handlePoiPointerUp();
            });
            expect(setRoads).not.toHaveBeenCalled();
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

        it('does not update road when findHexPath returns null', () => {
            vi.mocked(hexMapUtils.findHexPath).mockReturnValue(null);
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
            getHexFromEvent.mockReturnValue({ q: 99, r: 99 });
            const { result } = render({ setPois, setRoads, roads });
            const downEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', downEvent);
            });
            act(() => {
                result.current.handlePoiPointerMove({ clientX: 0, clientY: 0 });
            });
            act(() => {
                result.current.handlePoiPointerUp();
            });
            expect(setRoads).toHaveBeenCalled();
        });
    });

    describe('state setters', () => {
        it('setSelectedPoiMenu updates selectedPoiMenu', () => {
            const { result } = render();
            act(() => {
                result.current.setSelectedPoiMenu({ id: 'poi-1', q: 1, r: 0 });
            });
            expect(result.current.selectedPoiMenu).toEqual({ id: 'poi-1', q: 1, r: 0 });
        });

        it('setShowRename updates showRename', () => {
            const { result } = render();
            act(() => {
                result.current.setShowRename('poi-1');
            });
            expect(result.current.showRename).toBe('poi-1');
        });

        it('setRoadStartPoiId updates roadStartPoiId', () => {
            const { result } = render();
            act(() => {
                result.current.setRoadStartPoiId('poi-1');
            });
            expect(result.current.roadStartPoiId).toBe('poi-1');
        });
    });

    describe('function stability', () => {
        it('handlers are stable useCallback references when props do not change', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const { result } = render({ setPois, setRoads });
            const down1 = result.current.handlePoiPointerDown;
            const move1 = result.current.handlePoiPointerMove;
            const up1 = result.current.handlePoiPointerUp;
            const context1 = result.current.handlePoiContextMenu;
            expect(down1).toBe(result.current.handlePoiPointerDown);
            expect(move1).toBe(result.current.handlePoiPointerMove);
            expect(up1).toBe(result.current.handlePoiPointerUp);
            expect(context1).toBe(result.current.handlePoiContextMenu);
        });
    });

    describe('roadStartPoiId clearing on mismatched poi lookup', () => {
        it('does not set roadStartPoiId when poi does not exist in pois array', () => {
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const pois = [
                { id: 'poi-2', label: 'Settlement B', type: 'settlement', q: 3, r: 0, visible: true },
            ];
            const { result } = render({ setPois, setRoads, pois, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBeNull();
        });

        it('clears roadStartPoiId when fromPoi is not found during road creation with both pois in array', () => {
            vi.mocked(hexMapUtils.findHexPath).mockReturnValue(null);
            const setPois = vi.fn();
            const setRoads = vi.fn();
            const pois = [
                { id: 'poi-1', label: 'City A', type: 'city', q: 1, r: 0, visible: true },
                { id: 'poi-2', label: 'Settlement B', type: 'settlement', q: 3, r: 0, visible: true },
            ];
            const { result } = render({ setPois, setRoads, pois, tool: 'road' });
            const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
            act(() => {
                result.current.handlePoiPointerDown('poi-1', mockEvent);
            });
            act(() => {
                result.current.handlePoiPointerDown('poi-2', mockEvent);
            });
            expect(result.current.roadStartPoiId).toBeNull();
            expect(setRoads).not.toHaveBeenCalled();
        });
    });
});
