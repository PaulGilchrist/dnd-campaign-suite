import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHexMapSSESync from './useHexMapSSESync.js';

const VALID_KEY = 'map-data-test-campaign-test-map';

function createArgs(overrides = {}) {
    return {
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
        ...overrides,
    };
}

function makeEvent(data, key = VALID_KEY) {
    return { key, data };
}

function expectNoDispatch(args) {
    Object.values(args).forEach(value => {
        if (typeof value === 'function') {
            expect(value).not.toHaveBeenCalled();
        }
    });
}

function invokeSetMapData(args) {
    expect(args.setMapData).toHaveBeenCalledTimes(1);
    return args.setMapData.mock.calls[0][0];
}

describe('useHexMapSSESync', () => {
    describe('API shape', () => {
        it('exposes a handleSSEEvent callback', () => {
            const { result } = renderHook(() => useHexMapSSESync(createArgs()));
            expect(result.current).toEqual({ handleSSEEvent: expect.any(Function) });
        });
    });

    describe('event filtering', () => {
        it('ignores null or missing events without dispatching anything', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(null); });
            act(() => { result.current.handleSSEEvent(undefined); });
            act(() => { result.current.handleSSEEvent({}); });
            act(() => { result.current.handleSSEEvent({ key: VALID_KEY }); });
            expectNoDispatch(args);
        });

        it('ignores non-object event.data values', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent(null)); });
            act(() => { result.current.handleSSEEvent(makeEvent('not-an-object')); });
            act(() => { result.current.handleSSEEvent(makeEvent([1, 2, 3])); });
            act(() => { result.current.handleSSEEvent(makeEvent(42)); });
            expectNoDispatch(args);
        });

        it('ignores empty data objects', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({})); });
            expectNoDispatch(args);
        });

        it('ignores fields explicitly set to undefined', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: undefined, terrain: undefined })); });
            expectNoDispatch(args);
        });

        it('ignores events whose key does not exactly match campaign and map', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20 }, 'map-data-different-campaign-test-map')); });
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20 }, 'map-data-test-campaign-different-map')); });
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20 }, 'map-data-test-campaign-test-map-extra')); });
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20 }, 'extra-map-data-test-campaign-test-map')); });
            expectNoDispatch(args);
        });
    });

    describe('field dispatch', () => {
        it.each`
            field               | setter                  | value
            ${'gridSize'}       | ${'setGridSize'}        | ${30}
            ${'terrain'}        | ${'setTerrain'}         | ${'forest'}
            ${'rivers'}         | ${'setRivers'}          | ${['river1']}
            ${'roads'}          | ${'setRoads'}           | ${['road1']}
            ${'pois'}           | ${'setPois'}            | ${{ x: 1, y: 2 }}
            ${'zoom'}           | ${'setZoom'}            | ${2.5}
            ${'panX'}           | ${'setPanX'}            | ${100}
            ${'panY'}           | ${'setPanY'}            | ${200}
            ${'marchingOrder'}  | ${'setMarchingOrder'}   | ${['unit1']}
            ${'partyPosition'}  | ${'setPartyPosition'}   | ${{ q: 5, r: 10 }}
            ${'weather'}        | ${'setWeather'}         | ${'rainy'}
            ${'travelState'}    | ${'onTravelStateChange'} | ${'marching'}
        `('dispatches $field to $setter when present', ({ field, setter, value }) => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ [field]: value })); });
            expect(args[setter]).toHaveBeenCalledWith(value);
        });

        it('dispatches every present field from a single event', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => {
                result.current.handleSSEEvent(makeEvent({
                    gridSize: 15,
                    terrain: 'swamp',
                    rivers: ['river1'],
                    travelState: 'resting',
                }));
            });
            expect(args.setGridSize).toHaveBeenCalledWith(15);
            expect(args.setTerrain).toHaveBeenCalledWith('swamp');
            expect(args.setRivers).toHaveBeenCalledWith(['river1']);
            expect(args.onTravelStateChange).toHaveBeenCalledWith('resting');
            expect(args.setMapData).not.toHaveBeenCalled();
        });
    });

    describe('travelState dispatch', () => {
        it('does not call onTravelStateChange when travelState is absent', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20 })); });
            expect(args.onTravelStateChange).not.toHaveBeenCalled();
            expect(args.setGridSize).toHaveBeenCalledWith(20);
        });

        it('passes through falsy travelState values because only undefined is suppressed', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ travelState: null })); });
            expect(args.onTravelStateChange).toHaveBeenCalledWith(null);
        });

        it('calls onTravelStateChange on every event, even with identical values', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = makeEvent({ travelState: 'marching' });
            act(() => { result.current.handleSSEEvent(event); });
            act(() => { result.current.handleSSEEvent(event); });
            expect(args.onTravelStateChange).toHaveBeenCalledTimes(2);
        });

        it('skips travelState without a callback but still dispatches other fields', () => {
            const args = createArgs({ onTravelStateChange: undefined });
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20, travelState: 'marching' })); });
            expect(args.setGridSize).toHaveBeenCalledWith(20);
        });
    });

    describe('mapData merge', () => {
        it('calls setMapData with a functional update when data.type is present', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => {
                result.current.handleSSEEvent(makeEvent({ type: 'map', gridSize: 20, terrain: 'desert' }));
            });
            const updater = invokeSetMapData(args);
            expect(updater(null)).toEqual({ type: 'map', gridSize: 20, terrain: 'desert' });
            expect(args.setGridSize).toHaveBeenCalledWith(20);
        });

        it('merges the payload into existing mapData instead of replacing it', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ type: 'map', terrain: 'forest' })); });
            const updater = invokeSetMapData(args);
            expect(updater({ type: 'map', gridSize: 10 })).toEqual({ type: 'map', gridSize: 10, terrain: 'forest' });
        });

        it('merges even when only type is present, preserving existing fields', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ type: 'map' })); });
            const updater = invokeSetMapData(args);
            expect(updater({ gridSize: 10, zoom: 2 })).toEqual({ gridSize: 10, zoom: 2, type: 'map' });
        });

        it('does not call setMapData when data.type is absent', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20 })); });
            expect(args.setMapData).not.toHaveBeenCalled();
        });
    });

    describe('SSE equality guard wiring', () => {
        it('does not re-dispatch when a primitive value is unchanged', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            const event = makeEvent({ gridSize: 20 });
            act(() => { result.current.handleSSEEvent(event); });
            act(() => { result.current.handleSSEEvent(event); });
            expect(args.setGridSize).toHaveBeenCalledTimes(1);
        });

        it('does not re-dispatch when an object value is deep-equal', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ partyPosition: { q: 3, r: 4 } })); });
            act(() => { result.current.handleSSEEvent(makeEvent({ partyPosition: { q: 3, r: 4 } })); });
            expect(args.setPartyPosition).toHaveBeenCalledTimes(1);
        });

        it('dispatches again once the value actually changes', () => {
            const args = createArgs();
            const { result } = renderHook(() => useHexMapSSESync(args));
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20 })); });
            act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 30 })); });
            expect(args.setGridSize).toHaveBeenCalledTimes(2);
            expect(args.setGridSize).toHaveBeenNthCalledWith(1, 20);
            expect(args.setGridSize).toHaveBeenNthCalledWith(2, 30);
        });
    });

    describe('function stability', () => {
        it('keeps handleSSEEvent stable when no deps change', () => {
            const args = createArgs();
            const { result, rerender } = renderHook(() => useHexMapSSESync(args));
            const handler = result.current.handleSSEEvent;
            rerender();
            expect(result.current.handleSSEEvent).toBe(handler);
        });

        it('creates a new handleSSEEvent when campaignName changes', () => {
            const args = createArgs();
            const { result, rerender } = renderHook(
                ({ campaignName }) => useHexMapSSESync({ ...args, campaignName }),
                { initialProps: { campaignName: 'test-campaign' } }
            );
            const handler = result.current.handleSSEEvent;
            rerender({ campaignName: 'other-campaign' });
            expect(result.current.handleSSEEvent).not.toBe(handler);
        });

        it('creates a new handleSSEEvent when mapName changes', () => {
            const args = createArgs();
            const { result, rerender } = renderHook(
                ({ mapName }) => useHexMapSSESync({ ...args, mapName }),
                { initialProps: { mapName: 'test-map' } }
            );
            const handler = result.current.handleSSEEvent;
            rerender({ mapName: 'other-map' });
            expect(result.current.handleSSEEvent).not.toBe(handler);
        });
    });
});
