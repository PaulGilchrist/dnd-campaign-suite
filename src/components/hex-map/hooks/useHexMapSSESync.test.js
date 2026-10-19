// @maintained-by-ai
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

// Sweep every setter: each entry in expectedCalls ({ setterName: [args...] })
// must have been called exactly once with those args; every other setter
// must not have been called at all. Catches cross-wiring and extra dispatches.
function expectExactDispatches(args, expectedCalls) {
    Object.entries(args).forEach(([name, fn]) => {
        if (typeof fn !== 'function') return;
        if (name in expectedCalls) {
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith(...expectedCalls[name]);
        } else {
            expect(fn).not.toHaveBeenCalled();
        }
    });
}

describe('useHexMapSSESync', () => {
    it('exposes a handleSSEEvent callback', () => {
        const { result } = renderHook(() => useHexMapSSESync(createArgs()));
        expect(result.current).toEqual({ handleSSEEvent: expect.any(Function) });
    });

    it('ignores malformed events and keys that do not match this campaign and map', () => {
        const args = createArgs();
        const { result } = renderHook(() => useHexMapSSESync(args));
        const malformed = [
            null,
            undefined,
            {},
            { key: VALID_KEY },
            makeEvent(null),
            makeEvent('not-an-object'),
            makeEvent([1, 2, 3]),
            makeEvent(42),
            makeEvent({}),
            makeEvent({ gridSize: undefined, terrain: undefined }),
            makeEvent({ gridSize: 20 }, 'map-data-different-campaign-test-map'),
            makeEvent({ gridSize: 20 }, 'map-data-test-campaign-different-map'),
            makeEvent({ gridSize: 20 }, 'map-data-test-campaign-test-map-extra'),
            makeEvent({ gridSize: 20 }, 'extra-map-data-test-campaign-test-map'),
        ];
        malformed.forEach(event => {
            act(() => { result.current.handleSSEEvent(event); });
        });
        expectExactDispatches(args, {});

        // Positive control: a well-formed matching event does dispatch.
        act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20 })); });
        expectExactDispatches(args, { setGridSize: [20] });
    });

    it.each`
        field               | setter                   | value
        ${'gridSize'}       | ${'setGridSize'}         | ${30}
        ${'terrain'}        | ${'setTerrain'}          | ${'forest'}
        ${'rivers'}         | ${'setRivers'}           | ${['river1']}
        ${'roads'}          | ${'setRoads'}            | ${['road1']}
        ${'pois'}           | ${'setPois'}             | ${{ x: 1, y: 2 }}
        ${'zoom'}           | ${'setZoom'}             | ${2.5}
        ${'panX'}           | ${'setPanX'}             | ${100}
        ${'panY'}           | ${'setPanY'}             | ${200}
        ${'marchingOrder'}  | ${'setMarchingOrder'}    | ${['unit1']}
        ${'partyPosition'}  | ${'setPartyPosition'}    | ${{ q: 5, r: 10 }}
        ${'weather'}        | ${'setWeather'}          | ${'rainy'}
        ${'travelState'}    | ${'onTravelStateChange'} | ${'marching'}
        ${'travelState'}    | ${'onTravelStateChange'} | ${null}
    `('dispatches $field ($value) to $setter and nothing else', ({ field, setter, value }) => {
        const args = createArgs();
        const { result } = renderHook(() => useHexMapSSESync(args));
        act(() => { result.current.handleSSEEvent(makeEvent({ [field]: value })); });
        expectExactDispatches(args, { [setter]: [value] });
    });

    it('dispatches every present field from one event and leaves setMapData alone without a type', () => {
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
        expectExactDispatches(args, {
            setGridSize: [15],
            setTerrain: ['swamp'],
            setRivers: [['river1']],
            onTravelStateChange: ['resting'],
        });
    });

    it('dispatches travelState unguarded: falsy values pass through and identical echoes re-dispatch', () => {
        const args = createArgs();
        const { result } = renderHook(() => useHexMapSSESync(args));
        act(() => { result.current.handleSSEEvent(makeEvent({ travelState: null })); });
        expect(args.onTravelStateChange).toHaveBeenCalledTimes(1);
        expect(args.onTravelStateChange).toHaveBeenCalledWith(null);

        const echo = makeEvent({ travelState: 'marching' });
        act(() => { result.current.handleSSEEvent(echo); });
        act(() => { result.current.handleSSEEvent(echo); });
        expect(args.onTravelStateChange).toHaveBeenCalledTimes(3);
        expect(args.onTravelStateChange).toHaveBeenNthCalledWith(2, 'marching');
        expect(args.onTravelStateChange).toHaveBeenNthCalledWith(3, 'marching');
    });

    it('tolerates a missing onTravelStateChange callback while dispatching other fields', () => {
        const args = createArgs({ onTravelStateChange: undefined });
        const { result } = renderHook(() => useHexMapSSESync(args));
        act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 20, travelState: 'marching' })); });
        expectExactDispatches(args, { setGridSize: [20] });
    });

    it('merges typed events into existing mapData via a functional update', () => {
        const args = createArgs();
        const { result } = renderHook(() => useHexMapSSESync(args));
        act(() => {
            result.current.handleSSEEvent(makeEvent({ type: 'map', gridSize: 20, terrain: 'desert' }));
        });
        // Merge plus field dispatch from one event; setMapData is the only
        // observable output, so inspect the functional updater it receives.
        expect(args.setMapData).toHaveBeenCalledTimes(1);
        const updater = args.setMapData.mock.calls[0][0];
        expect(updater({ type: 'map', gridSize: 10, zoom: 2 })).toEqual({ type: 'map', gridSize: 20, zoom: 2, terrain: 'desert' });
        expect(args.setGridSize).toHaveBeenCalledWith(20);
    });

    it('suppresses SSE echoes identical to current state but dispatches changed values', () => {
        const args = createArgs();
        const { result } = renderHook(() => useHexMapSSESync(args));
        const echo = makeEvent({ gridSize: 20, partyPosition: { q: 3, r: 4 } });
        act(() => { result.current.handleSSEEvent(echo); });
        act(() => { result.current.handleSSEEvent(echo); });
        expect(args.setGridSize).toHaveBeenCalledTimes(1);
        expect(args.setPartyPosition).toHaveBeenCalledTimes(1);
        expect(args.setPartyPosition).toHaveBeenCalledWith({ q: 3, r: 4 });

        act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 30, partyPosition: { q: 3, r: 5 } })); });
        expect(args.setGridSize).toHaveBeenCalledTimes(2);
        expect(args.setGridSize).toHaveBeenNthCalledWith(2, 30);
        expect(args.setPartyPosition).toHaveBeenCalledTimes(2);
        expect(args.setPartyPosition).toHaveBeenNthCalledWith(2, { q: 3, r: 5 });
    });

    it('retargets the expected key when campaignName changes', () => {
        const args = createArgs();
        const { result, rerender } = renderHook(
            ({ campaignName }) => useHexMapSSESync({ ...args, campaignName }),
            { initialProps: { campaignName: 'test-campaign' } }
        );
        const otherKey = 'map-data-other-campaign-test-map';

        // While still on test-campaign, other-campaign events are ignored.
        act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 30 }, otherKey)); });
        expectExactDispatches(args, {});

        rerender({ campaignName: 'other-campaign' });
        act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 30 }, otherKey)); });
        expect(args.setGridSize).toHaveBeenCalledTimes(1);
        expect(args.setGridSize).toHaveBeenCalledWith(30);

        // Old key is no longer accepted (different value proves the key check, not the equality guard).
        act(() => { result.current.handleSSEEvent(makeEvent({ gridSize: 99 }, VALID_KEY)); });
        expect(args.setGridSize).toHaveBeenCalledTimes(1);
    });
});
