// @maintained-by-ai
// Lane: useSSESync = the map's handleSSEEvent input->output contract, bytes pinned here
// (key filter, field dispatch, setMapData merge semantics, guarded echo suppression).
//
// Subscription seams owned elsewhere, not duplicated in this file:
// | seam                                        | owner                                                     |
// | one shared connection via subscribeToSSE  | subscriber.test.jsx (Subscriber -> sseClient.js, #841)  |
// |     never a raw EventSource               |                                                           |
// | Map.jsx <Subscriber> -> combined handler  | Map-tool-handlers.test.jsx (handlers.mapSSE receives    |
// |     -> this hook (Map.jsx:205-209, 359) |     the routed event, :419)                             |
// | deep-equality guard internals             | src/hooks/runtime/useSSEEqualityGuard.test.js           |
// | overlay event bodies (#873) / sse (#872) | useSpellOverlay.test.js / sseHandlers owner lanes       |
//
// Old->new map: 16 old tests consolidated into 7 behaviors below —
// filter x4 -> block 2; gridSize/placedItems x4 -> blocks 3+5;
// mapData x7 + multi-field x1 + "returns function" x1 -> blocks 4+6 (adds revealed gap);
// surface x1 -> block 1; key-retarget is new coverage.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useSSESync from './useSSESync.js';

const VALID_KEY = 'map-data-test-campaign-test-map';

function renderSync(props = {}) {
    const args = {
        campaignName: 'test-campaign',
        mapName: 'test-map',
        setGridSize: vi.fn(),
        setMapData: vi.fn(),
        setPlacedItems: vi.fn(),
        ...props,
    };
    const { result, rerender } = renderHook(
        ({ campaignName, mapName }) => useSSESync({ ...args, campaignName, mapName }),
        { initialProps: { campaignName: args.campaignName, mapName: args.mapName } }
    );
    return { args, result, rerender };
}

const mapEvent = (data, key = VALID_KEY) => ({ key, data });

function expectNoDispatches(args) {
    expect(args.setGridSize).not.toHaveBeenCalled();
    expect(args.setMapData).not.toHaveBeenCalled();
    expect(args.setPlacedItems).not.toHaveBeenCalled();
}

describe('useSSESync', () => {
    it('exposes exactly { handleSSEEvent }', () => {
        const { result } = renderSync();
        expect(result.current).toEqual({ handleSSEEvent: expect.any(Function) });
    });

    it('ignores malformed events and keys belonging to other campaigns or maps', () => {
        const { args, result } = renderSync();
        const rejected = [
            null,
            undefined,
            {},
            { key: VALID_KEY },
            mapEvent(null),
            mapEvent({ gridSize: 5 }, 'wrong-key'),
            mapEvent({ gridSize: 5 }, 'map-data-other-campaign-test-map'),
            mapEvent({ gridSize: 5 }, 'map-data-test-campaign-other-map'),
            mapEvent({ gridSize: 5 }, 'map-data-test-campaign-test-map-extra'),
        ];
        rejected.forEach(event => {
            act(() => { result.current.handleSSEEvent(event); });
            expectNoDispatches(args);
        });

        // Positive control: a well-formed matching event dispatches.
        act(() => { result.current.handleSSEEvent(mapEvent({ gridSize: 5 })); });
        expect(args.setGridSize).toHaveBeenCalledTimes(1);
        expect(args.setGridSize).toHaveBeenCalledWith(5);
        expect(args.setPlacedItems).not.toHaveBeenCalled();
        expect(args.setMapData).toHaveBeenCalledTimes(1);
    });

    it.each`
        field             | setter             | value
        ${'gridSize'}     | ${'setGridSize'}   | ${10}
        ${'gridSize'}     | ${'setGridSize'}   | ${0}
        ${'placedItems'}  | ${'setPlacedItems'}| ${[{ id: 'item1', x: 1, y: 2 }]}
    `('dispatches $field ($value) to $setter, touches nothing else, and always merges via setMapData', ({ field, setter, value }) => {
        const { args, result } = renderSync();
        act(() => { result.current.handleSSEEvent(mapEvent({ [field]: value })); });
        expect(args[setter]).toHaveBeenCalledTimes(1);
        expect(args[setter]).toHaveBeenCalledWith(value);
        const other = setter === 'setGridSize' ? args.setPlacedItems : args.setGridSize;
        expect(other).not.toHaveBeenCalled();
        // Every accepted event feeds the guarded setMapData merge sink.
        expect(args.setMapData).toHaveBeenCalledTimes(1);
    });

    it('dispatches every present field from a single event', () => {
        const players = [{ id: 'p1' }];
        const placedItems = [{ id: 'item1' }];
        const { args, result } = renderSync();
        act(() => {
            result.current.handleSSEEvent(mapEvent({
                gridSize: 15,
                players,
                walls: ['w1'],
                placedItems,
                revealed: ['r1'],
            }));
        });
        expect(args.setGridSize).toHaveBeenCalledWith(15);
        expect(args.setPlacedItems).toHaveBeenCalledWith(placedItems);
        expect(args.setMapData).toHaveBeenCalledTimes(1);
        expect(args.setMapData.mock.calls[0][0]({ players: [], walls: new Set(), revealed: [] }))
            .toEqual({ players: [{ id: 'p1' }], walls: new Set(['w1']), revealed: ['r1'] });
    });

    it('merges the setMapData update without touching fields the event does not carry', () => {
        const { args, result } = renderSync();
        const prev = { players: [{ id: 'p1' }], walls: new Set(['w1']), revealed: ['r1'], tokens: [7] };

        act(() => { result.current.handleSSEEvent(mapEvent({ gridSize: 5 })); });
        expect(args.setMapData).toHaveBeenCalledTimes(1);
        // gridSize alone must leave players, walls, revealed and unrelated keys intact.
        expect(args.setMapData.mock.calls[0][0](prev)).toEqual(prev);

        act(() => { result.current.handleSSEEvent(mapEvent({ players: [{ id: 'new' }] })); });
        // players provided replaces players only; absent fields survive.
        expect(args.setMapData.mock.calls[1][0](prev))
            .toEqual({ players: [{ id: 'new' }], walls: new Set(['w1']), revealed: ['r1'], tokens: [7] });
    });

    // Backlog ai-dress-belongs-in-map-view live find: an AI Dress applied while
    // the editor is open echoed its snapshot, but the items/pois lanes were not
    // merged — the debounced autosave then re-PUT the stale rows (a dress
    // REMOVE resurrected the token on disk). The lanes now obey the same
    // present-lands law: present lands (null → honest []), absent preserves.
    it('lands items/pois lanes carried by the snapshot; null clears honestly, absence preserves prev', () => {
        const { args, result } = renderSync();
        const prev = { players: [], walls: new Set(), revealed: [], items: [{ id: 'gob-1' }], pois: [{ id: 'poi-a' }] };

        act(() => { result.current.handleSSEEvent(mapEvent({ items: [], pois: [{ id: 'poi-a' }, { id: 'poi-b' }] })); });
        expect(args.setMapData.mock.calls[0][0](prev))
            .toEqual({ players: [], walls: new Set(), revealed: [], items: [], pois: [{ id: 'poi-a' }, { id: 'poi-b' }] });

        act(() => { result.current.handleSSEEvent(mapEvent({ items: null })); });
        expect(args.setMapData.mock.calls[1][0](prev))
            .toEqual({ players: [], walls: new Set(), revealed: [], items: [], pois: [{ id: 'poi-a' }] });

        // Event carries neither lane → prev's items/pois survive byte-identical,
        // and no phantom empty arrays are invented for lane-less documents.
        act(() => { result.current.handleSSEEvent(mapEvent({ gridSize: 5 })); });
        expect(args.setMapData.mock.calls[2][0](prev)).toEqual(prev);
        expect(args.setMapData.mock.calls[2][0]({ players: [], walls: new Set(), revealed: [] }))
            .toEqual({ players: [], walls: new Set(), revealed: [] });
    });

    it.each([
        {
            title: 'converts walls array to a Set',
            data: { walls: ['wA', 'wB'] },
            prev: { players: [], walls: new Set(['old']), revealed: [] },
            expected: { players: [], walls: new Set(['wA', 'wB']), revealed: [] },
        },
        {
            // Key present -> value lands: an empty array is an honest clear.
            title: 'empty walls array clears existing walls',
            data: { walls: [] },
            prev: { players: [], walls: new Set(['kept']), revealed: [] },
            expected: { players: [], walls: new Set(), revealed: [] },
        },
        {
            // Same key-present clear semantics as walls.
            title: 'empty players array clears existing players',
            data: { players: [] },
            prev: { players: [{ id: 'kept' }], walls: new Set(), revealed: [] },
            expected: { players: [], walls: new Set(), revealed: [] },
        },
        {
            // Unified snapshot law (#915): map-data-* payloads are full documents
            // (server/routes/maps.js:170/:303), so an explicit null is an honest
            // clear that LANDS, coerced to the field's empty array domain — it
            // never collapses to stale prev (the old || defect) and never lands
            // as a non-array (the old !==undefined defect on revealed).
            title: 'null players is an honest clear to [], not stale prev',
            data: { players: null },
            prev: { players: [{ id: 'kept' }], walls: new Set(), revealed: [] },
            expected: { players: [], walls: new Set(), revealed: [] },
        },
        {
            title: 'null revealed is an honest clear to [], never a raw null',
            data: { revealed: null },
            prev: { players: [{ id: 'p1' }], walls: new Set(['w1']), revealed: ['r1'] },
            expected: { players: [{ id: 'p1' }], walls: new Set(['w1']), revealed: [] },
        },
        {
            title: 'null walls is an honest clear to an empty Set',
            data: { walls: null },
            prev: { players: [{ id: 'p1' }], walls: new Set(['w1']), revealed: ['r1'] },
            expected: { players: [{ id: 'p1' }], walls: new Set(), revealed: ['r1'] },
        },
        {
            // Partial snapshot: only the present keys clear; absent ones survive.
            title: 'null players and revealed clear together while absent walls survive',
            data: { players: null, revealed: null },
            prev: { players: [{ id: 'kept' }], walls: new Set(['w1']), revealed: ['r1'] },
            expected: { players: [], walls: new Set(['w1']), revealed: [] },
        },
        {
            title: 'empty revealed array replaces previous revealed',
            data: { revealed: [] },
            prev: { players: [], walls: new Set(), revealed: ['r1'] },
            expected: { players: [], walls: new Set(), revealed: [] },
        },
        {
            title: 'missing previous state yields empty players, walls and revealed',
            data: { gridSize: 5 },
            prev: undefined,
            expected: { players: [], walls: new Set(), revealed: [] },
        },
    ])('$title', ({ data, prev, expected }) => {
        const { args, result } = renderSync();
        act(() => { result.current.handleSSEEvent(mapEvent(data)); });
        expect(args.setMapData).toHaveBeenCalledTimes(1);
        expect(args.setMapData.mock.calls[0][0](prev)).toEqual(expected);
    });

    it('suppresses SSE echoes identical to current state but dispatches changed values', () => {
        const { args, result } = renderSync();
        const echo = mapEvent({ gridSize: 10, placedItems: [{ id: 'i1' }], players: [{ id: 'p1' }], walls: ['w1'] });

        act(() => { result.current.handleSSEEvent(echo); });
        const firstMerged = args.setMapData.mock.calls[0][0]({ players: [], walls: new Set(), revealed: [] });
        expect(firstMerged.players).toEqual([{ id: 'p1' }]);

        act(() => { result.current.handleSSEEvent(echo); });
        expect(args.setGridSize).toHaveBeenCalledTimes(1);
        expect(args.setPlacedItems).toHaveBeenCalledTimes(1);
        // The guarded merge resolves to the identical state object, so an echo loop
        // cannot churn map state even though the setter wrapper is invoked again.
        expect(args.setMapData).toHaveBeenCalledTimes(2);
        expect(args.setMapData.mock.calls[1][0](firstMerged)).toBe(firstMerged);

        act(() => { result.current.handleSSEEvent(mapEvent({ gridSize: 12 })); });
        expect(args.setGridSize).toHaveBeenCalledTimes(2);
        expect(args.setGridSize).toHaveBeenNthCalledWith(2, 12);
    });

    it('retargets the expected key when campaignName or mapName changes', () => {
        const otherKey = 'map-data-other-campaign-other-map';
        const { args, result, rerender } = renderSync();

        act(() => { result.current.handleSSEEvent(mapEvent({ gridSize: 30 }, otherKey)); });
        expectNoDispatches(args);

        rerender({ campaignName: 'other-campaign', mapName: 'other-map' });
        act(() => { result.current.handleSSEEvent(mapEvent({ gridSize: 30 }, otherKey)); });
        expect(args.setGridSize).toHaveBeenCalledTimes(1);
        expect(args.setGridSize).toHaveBeenCalledWith(30);

        // Old key no longer accepted (different value proves the key check, not the guard).
        act(() => { result.current.handleSSEEvent(mapEvent({ gridSize: 99 }, VALID_KEY)); });
        expect(args.setGridSize).toHaveBeenCalledTimes(1);
    });
});
