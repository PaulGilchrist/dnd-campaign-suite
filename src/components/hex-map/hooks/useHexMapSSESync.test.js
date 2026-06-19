// @improved-by-ai
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

        it('does nothing when event key has extra segments', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const extraKeyEvent = createSseEvent('map-data-test-campaign-test-map-extra', { gridSize: 20 });
            act(() => {
                result.current.handleSSEEvent(extraKeyEvent);
            });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });

        it('does nothing when data is a string instead of an object', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const stringDataEvent = { key: 'map-data-test-campaign-test-map', data: 'not-an-object' };
            act(() => {
                result.current.handleSSEEvent(stringDataEvent);
            });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });
    });

    describe('handleSSEEvent - data fields', () => {
        it.each`
            field               | setter                | value
            ${'gridSize'}       | ${'setGridSize'}      | ${30}
            ${'terrain'}        | ${'setTerrain'}       | ${'forest'}
            ${'rivers'}         | ${'setRivers'}        | ${['river1']}
            ${'roads'}          | ${'setRoads'}         | ${['road1']}
            ${'pois'}           | ${'setPois'}          | ${{ x: 1, y: 2 }}
            ${'zoom'}           | ${'setZoom'}          | ${2.5}
            ${'panX'}           | ${'setPanX'}          | ${100}
            ${'panY'}           | ${'setPanY'}          | ${200}
            ${'marchingOrder'}  | ${'setMarchingOrder'} | ${['unit1']}
            ${'partyPosition'}  | ${'setPartyPosition'} | ${{ q: 5, r: 10 }}
            ${'weather'}        | ${'setWeather'}       | ${'rainy'}
            ${'travelState'}    | ${'onTravelStateChange'} | ${'marching'}
        `('calls $setter when data.$field is present', ({ field, setter, value }) => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            const event = createSseEvent('map-data-test-campaign-test-map', { [field]: value });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(baseArgs[setter]).toHaveBeenCalledWith(value);
        });

        it('does not call onTravelStateChange when it is not provided', () => {
            const args = { ...baseArgs, onTravelStateChange: undefined };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = createSseEvent('map-data-test-campaign-test-map', { travelState: 'marching' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
        });

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

        it('calls each setter exactly once when all fields are present', () => {
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

        it('calls setMapData with functional update merging multiple fields', () => {
            const args = { ...baseArgs, setMapData: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const existingData = { type: 'map', gridSize: 10, terrain: 'desert', zoom: 1.0 };
            const event = createSseEvent('map-data-test-campaign-test-map', { type: 'map', gridSize: 30, zoom: 2.0, weather: 'clear' });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args.setMapData).toHaveBeenCalledTimes(1);
            const callArg = args.setMapData.mock.calls[0][0];
            const merged = callArg(existingData);
            expect(merged).toEqual({ type: 'map', gridSize: 30, terrain: 'desert', zoom: 2.0, weather: 'clear' });
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
        it.each`
            field               | setter                | value
            ${'gridSize'}       | ${'setGridSize'}      | ${20}
            ${'rivers'}         | ${'setRivers'}        | ${['a', 'b']}
            ${'partyPosition'}  | ${'setPartyPosition'} | ${{ q: 3, r: 4 }}
        `('does not call setter when value is identical to previous ($field)', ({ field, setter, value }) => {
            const args = { ...baseArgs, [setter]: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = createSseEvent('map-data-test-campaign-test-map', { [field]: value });
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args[setter]).toHaveBeenCalledTimes(1);
            act(() => {
                result.current.handleSSEEvent(event);
            });
            expect(args[setter]).toHaveBeenCalledTimes(1);
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
        it('handleSSEEvent is stable across rerenders when deps have not changed', () => {
            const { result, rerender } = renderHook(() => useHexMapSSESync(baseArgs));
            const handler1 = result.current.handleSSEEvent;
            rerender();
            const handler2 = result.current.handleSSEEvent;
            expect(handler1).toBe(handler2);
        });

        it('handleSSEEvent changes when campaignName changes', () => {
            const { result, rerender } = renderHook(
                ({ campaignName }) => useHexMapSSESync({ ...baseArgs, campaignName }),
                { initialProps: { campaignName: 'test-campaign' } }
            );
            const handler1 = result.current.handleSSEEvent;
            rerender({ campaignName: 'new-campaign' });
            const handler2 = result.current.handleSSEEvent;
            expect(handler1).not.toBe(handler2);
        });
    });
});
