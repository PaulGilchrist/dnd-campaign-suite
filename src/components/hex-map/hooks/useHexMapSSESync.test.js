// @cleaned-by-ai
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

    describe('event filtering', () => {
        it('returns { handleSSEEvent } when initialized', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            expect(Object.keys(result.current)).toEqual(['handleSSEEvent']);
        });

        it('does not dispatch when event is null or missing data', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            act(() => { result.current.handleSSEEvent(null); });
            act(() => { result.current.handleSSEEvent({ key: 'x' }); });
            act(() => { result.current.handleSSEEvent({ key: 'map-data-test-campaign-test-map', data: 'not-an-object' }); });
            act(() => { result.current.handleSSEEvent({ key: 'map-data-test-campaign-test-map', data: {} }); });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });

        it('ignores events with wrong campaign or map name', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-different-campaign-test-map', { gridSize: 20 })); });
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-test-campaign-different-map', { gridSize: 20 })); });
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-test-campaign-test-map-extra', { gridSize: 20 })); });
            expect(baseArgs.setGridSize).not.toHaveBeenCalled();
        });
    });

    describe('field dispatch', () => {
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
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-test-campaign-test-map', { [field]: value })); });
            expect(baseArgs[setter]).toHaveBeenCalledWith(value);
        });
    });

    describe('mapData merge', () => {
        it('calls setMapData with merged data when data.type is present', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-test-campaign-test-map', { type: 'map', gridSize: 20, terrain: 'desert' })); });
            expect(baseArgs.setMapData).toHaveBeenCalled();
            const callArg = baseArgs.setMapData.mock.calls[0][0];
            expect(callArg(null)).toEqual({ type: 'map', gridSize: 20, terrain: 'desert' });
        });

        it('does not call setMapData when data.type is absent', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-test-campaign-test-map', { gridSize: 20 })); });
            expect(baseArgs.setMapData).not.toHaveBeenCalled();
        });

        it('merges data into existing mapData via functional update', () => {
            const { result } = renderHook(() => useHexMapSSESync(baseArgs));
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-test-campaign-test-map', { type: 'map', terrain: 'forest' })); });
            const callArg = baseArgs.setMapData.mock.calls[0][0];
            expect(callArg({ type: 'map', gridSize: 10 })).toEqual({ type: 'map', gridSize: 10, terrain: 'forest' });
        });
    });

    describe('SSE equality guard', () => {
        it.each`
            field               | setter                | value
            ${'gridSize'}       | ${'setGridSize'}      | ${20}
            ${'rivers'}         | ${'setRivers'}        | ${['a', 'b']}
            ${'partyPosition'}  | ${'setPartyPosition'} | ${{ q: 3, r: 4 }}
        `('does not call setter when value is identical to previous ($field)', ({ field, setter, value }) => {
            const args = { ...baseArgs, [setter]: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = createSseEvent('map-data-test-campaign-test-map', { [field]: value });
            act(() => { result.current.handleSSEEvent(event); });
            expect(args[setter]).toHaveBeenCalledTimes(1);
            act(() => { result.current.handleSSEEvent(event); });
            expect(args[setter]).toHaveBeenCalledTimes(1);
        });

        it('calls setter when value changes', () => {
            const args = { ...baseArgs, setGridSize: vi.fn() };
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-test-campaign-test-map', { gridSize: 20 })); });
            act(() => { result.current.handleSSEEvent(createSseEvent('map-data-test-campaign-test-map', { gridSize: 30 })); });
            expect(args.setGridSize).toHaveBeenCalledTimes(2);
            expect(args.setGridSize).toHaveBeenNthCalledWith(1, 20);
            expect(args.setGridSize).toHaveBeenNthCalledWith(2, 30);
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
