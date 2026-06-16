import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHexMapSSESync from './useHexMapSSESync.js';

describe('useHexMapSSESync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const baseArgs = {
        campaignName: 'test-campaign',
        mapName: 'test-map',
        setGridSize: vi.fn(),
        setTerrain: vi.fn(),
        setRivers: vi.fn(),
        setRoads: vi.fn(),
        setPois: vi.fn(),
        setZoom: vi.fn(),
        setPanX: vi.fn(),
        setPanY: vi.fn(),
        setMarchingOrder: vi.fn(),
        setPartyPosition: vi.fn(),
        setMapData: vi.fn(),
        setWeather: vi.fn(),
        onTravelStateChange: vi.fn(),
    };

    const createSseEvent = (key, data) => ({ key, data });

    describe('initial return shape', () => {
        it('returns an object with handleSSEEvent', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            expect(result.current).toHaveProperty('handleSSEEvent');
            expect(typeof result.current.handleSSEEvent).toBe('function');
        });
    });

    describe('handleSSEEvent - event filtering', () => {
        it('does nothing when event is null', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            act(() => {
                result.current.handleSSEEvent(null);
            });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });

        it('does nothing when event has no data', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            act(() => {
                result.current.handleSSEEvent({ key: 'something' });
            });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });

        it('does nothing when event key does not match expected key', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const wrongEvent = createSseEvent('map-data-wrong-campaign-wrong-map', { gridSize: 20 });
            act(() => {
                result.current.handleSSEEvent(wrongEvent);
            });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });

        it('does nothing when event key matches but data is empty', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const expectedEvent = createSseEvent('map-data-test-campaign-test-map', {});
            act(() => {
                result.current.handleSSEEvent(expectedEvent);
            });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
            expect(baseArgs.setTerrain).not.toHaveBeenCalled();
            expect(baseArgs.setRivers).not.toHaveBeenCalled();
            expect(baseArgs.setRoads).not.toHaveBeenCalled();
            expect(baseArgs.setPois).not.toHaveBeenCalled();
            expect(baseArgs.setZoom).not.toHaveBeenCalled();
            expect(baseArgs.setPanX).not.toHaveBeenCalled();
            expect(baseArgs.setPanY).not.toHaveBeenCalled();
            expect(baseArgs.setMarchingOrder).not.toHaveBeenCalled();
            expect(baseArgs.setPartyPosition).not.toHaveBeenCalled();
            expect(baseArgs.setWeather).not.toHaveBeenCalled();
            expect(baseArgs.setMapData).not.toHaveBeenCalled();
            expect(baseArgs.onTravelStateChange).not.toHaveBeenCalled();
        });
    });

    describe('handleSSEEvent - data fields', () => {
        it('calls setGridSize when data.gridSize is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { gridSize: 30 });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setGridSize).toHaveBeenCalledWith(30);
        });

        it('calls setTerrain when data.terrain is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { terrain: 'forest' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setTerrain).toHaveBeenCalledWith('forest');
        });

        it('calls setRivers when data.rivers is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { rivers: ['river1'] });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setRivers).toHaveBeenCalledWith(['river1']);
        });

        it('calls setRoads when data.roads is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { roads: ['road1'] });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setRoads).toHaveBeenCalledWith(['road1']);
        });

        it('calls setPois when data.pois is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { pois: [{ x: 1, y: 2 }] });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setPois).toHaveBeenCalledWith([{ x: 1, y: 2 }]);
        });

        it('calls setZoom when data.zoom is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { zoom: 2.5 });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setZoom).toHaveBeenCalledWith(2.5);
        });

        it('calls setPanX when data.panX is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { panX: 100 });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setPanX).toHaveBeenCalledWith(100);
        });

        it('calls setPanY when data.panY is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { panY: 200 });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setPanY).toHaveBeenCalledWith(200);
        });

        it('calls setMarchingOrder when data.marchingOrder is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { marchingOrder: ['unit1'] });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setMarchingOrder).toHaveBeenCalledWith(['unit1']);
        });

        it('calls setPartyPosition when data.partyPosition is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { partyPosition: { q: 5, r: 10 } });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setPartyPosition).toHaveBeenCalledWith({ q: 5, r: 10 });
        });

        it('calls setWeather when data.weather is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { weather: 'rainy' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setWeather).toHaveBeenCalledWith('rainy');
        });

        it('calls onTravelStateChange when data.travelState is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { travelState: 'marching' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.onTravelStateChange).toHaveBeenCalledWith('marching');
        });

        it('does not call onTravelStateChange when it is not provided', () => {
            const args = { ...baseArgs, onTravelStateChange: undefined };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = createSseEvent('map-data-test-campaign-test-map', { travelState: 'marching' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            // Should not throw even though onTravelStateChange is undefined
        });
    });

    describe('handleSSEEvent - mapData merge', () => {
        it('calls setMapData with merged data when data.type is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { type: 'map', gridSize: 20, terrain: 'desert' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setMapData).toHaveBeenCalled();
            const callArg = baseArgs.setMapData.mock.calls[0][0];
            expect(typeof callArg).toBe('function');
            // Call the function with null to see the result
            const resultData = callArg(null);
            expect(resultData).toEqual({ type: 'map', gridSize: 20, terrain: 'desert' });
        });

        it('does not call setMapData when data.type is absent', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { gridSize: 20 });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setMapData).not.toHaveBeenCalled();
        });

        it('merges data into existing mapData via functional update', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const existingData = { type: 'map', gridSize: 10 };
            const event = createSseEvent('map-data-test-campaign-test-map', { type: 'map', terrain: 'forest' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            const callArg = baseArgs.setMapData.mock.calls[0][0];
            const resultData = callArg(existingData);
            expect(resultData).toEqual({ type: 'map', gridSize: 10, terrain: 'forest' });
        });
    });

    describe('handleSSEEvent - multiple fields', () => {
        it('calls all relevant setters when multiple fields are present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', {
                gridSize: 25,
                terrain: 'mountain',
                zoom: 1.5,
                panX: 50,
                panY: 75,
                weather: 'clear',
            });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setGridSize).toHaveBeenCalledWith(25);
            expect(baseArgs.setTerrain).toHaveBeenCalledWith('mountain');
            expect(baseArgs.setZoom).toHaveBeenCalledWith(1.5);
            expect(baseArgs.setPanX).toHaveBeenCalledWith(50);
            expect(baseArgs.setPanY).toHaveBeenCalledWith(75);
            expect(baseArgs.setWeather).toHaveBeenCalledWith('clear');
        });

        it('calls all setters when all fields are present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', {
                gridSize: 25,
                terrain: 'mountain',
                rivers: ['r1'],
                roads: ['r2'],
                pois: [{ x: 1 }],
                zoom: 1.5,
                panX: 50,
                panY: 75,
                marchingOrder: ['unit1'],
                partyPosition: { q: 1, r: 2 },
                weather: 'clear',
                travelState: 'resting',
                type: 'map',
            });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setGridSize).toHaveBeenCalledTimes(1);
            expect(baseArgs.setTerrain).toHaveBeenCalledTimes(1);
            expect(baseArgs.setRivers).toHaveBeenCalledTimes(1);
            expect(baseArgs.setRoads).toHaveBeenCalledTimes(1);
            expect(baseArgs.setPois).toHaveBeenCalledTimes(1);
            expect(baseArgs.setZoom).toHaveBeenCalledTimes(1);
            expect(baseArgs.setPanX).toHaveBeenCalledTimes(1);
            expect(baseArgs.setPanY).toHaveBeenCalledTimes(1);
            expect(baseArgs.setMarchingOrder).toHaveBeenCalledTimes(1);
            expect(baseArgs.setPartyPosition).toHaveBeenCalledTimes(1);
            expect(baseArgs.setWeather).toHaveBeenCalledTimes(1);
            expect(baseArgs.onTravelStateChange).toHaveBeenCalledTimes(1);
            expect(baseArgs.setMapData).toHaveBeenCalledTimes(1);
        });
    });

    describe('campaign/map key generation', () => {
        it('uses campaignName and mapName in the expected key', () => {
            const args = {
                ...baseArgs,
                campaignName: 'my-campaign',
                mapName: 'my-map',
            };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = createSseEvent('map-data-my-campaign-my-map', { gridSize: 20 });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setGridSize).toHaveBeenCalledWith(20);
        });

        it('ignores events from different campaign names', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-different-campaign-test-map', { gridSize: 20 });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });

        it('ignores events from different map names', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-different-map', { gridSize: 20 });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });
    });

    describe('SSE equality guard behavior', () => {
        it('does not call setter when value is identical to previous (primitive)', () => {
            const args = { ...baseArgs, setGridSize: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = createSseEvent('map-data-test-campaign-test-map', { gridSize: 20 });
            // First call should invoke the setter
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args.setGridSize).toHaveBeenCalledTimes(1);
            // Second call with same value should be guarded
            act(() => {
                result.current.handleSSEEvent(event);
            });
            // The guard should prevent the second call
            expect(args.setGridSize).toHaveBeenCalledTimes(1);
        });

        it('does not call setter when value is identical (array)', () => {
            const args = { ...baseArgs, setRivers: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = createSseEvent('map-data-test-campaign-test-map', { rivers: ['a', 'b'] });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args.setRivers).toHaveBeenCalledTimes(1);
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args.setRivers).toHaveBeenCalledTimes(1);
        });

        it('does not call setter when value is identical (object)', () => {
            const args = { ...baseArgs, setPartyPosition: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = createSseEvent('map-data-test-campaign-test-map', { partyPosition: { q: 3, r: 4 } });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args.setPartyPosition).toHaveBeenCalledTimes(1);
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args.setPartyPosition).toHaveBeenCalledTimes(1);
        });

        it('calls setter when value changes', () => {
            const args = { ...baseArgs, setGridSize: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event1 = createSseEvent('map-data-test-campaign-test-map', { gridSize: 20 });
            const event2 = createSseEvent('map-data-test-campaign-test-map', { gridSize: 30 });
            act(() => {
                result.current.handleSSEEvent(event1);
            });
            act(() => {
                result.current.handleSSEEvent(event2);
            });
            expect(args.setGridSize).toHaveBeenCalledTimes(2);
            expect(args.setGridSize).toHaveBeenNthCalledWith(1, 20);
            expect(args.setGridSize).toHaveBeenNthCalledWith(2, 30);
        });

        it('handles functional update in setMapData with equality guard', () => {
            const args = { ...baseArgs, setMapData: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            // First call with identical merge result
            const event = createSseEvent('map-data-test-campaign-test-map', { type: 'map' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args.setMapData).toHaveBeenCalledTimes(1);
        });
    });

    describe('returned object shape', () => {
        it('returns exactly handleSSEEvent', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const keys = Object.keys(result.current);
            expect(keys).toEqual(['handleSSEEvent']);
        });
    });

    describe('function stability', () => {
        it('handleSSEEvent is a stable reference (useCallback)', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const handler1 = result.current.handleSSEEvent;
            const handler2 = result.current.handleSSEEvent;
            expect(handler1).toBe(handler2);
        });
    });
});
