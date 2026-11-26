// @maintained-by-ai 2026-11-19
// Lane: useLastKnownPositions = the per-client position-memory oracle behind
// last-known-position mode (roadmap Item 7). It decides WHO ghosts: recording
// happens only while a creature token is unfogged on this client, ghosts are
// produced only for fogged (never-revealed-cell) creature tokens with a
// memory, and the whole lane is null on the GM client and while the map
// toggle is OFF (with the cache dropped — re-arm never leaks stale truth).
// The oracle is CACHE-CALLER-agnostic (a pure ref-cache hook): Map.jsx hoists
// the call above its 2D/3D conditional so the memory survives view flips —
// that flip-persistence seam (and the drop-at-unmount page-boundary law) is
// pinned in Map.ghost-flip.test.jsx. The rendering half (ghost marker/cull/
// live snap) lives in PlacedItems.last-known.test.jsx; the map-data flag's
// SSE lane is pinned in useSSESync.test.js.
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import useLastKnownPositions from './useLastKnownPositions.js';

const token = (over = {}) => ({
    id: 'gob-1', type: 'monster', name: 'Goblin 1',
    gridX: 2, gridY: 2, visible: true, ...over,
});

// fog cells as the production Set of "x,y" keys (useFogOfWar's output).
const fogOf = (...cells) => new Set(cells);

function renderPositions(items, fog, enabled = true, isLocalhost = false) {
    return renderHook(
        ({ items, fog, enabled, isLocalhost }) =>
            useLastKnownPositions(items, fog, enabled, isLocalhost),
        { initialProps: { items, fog, enabled, isLocalhost } },
    );
}

describe('useLastKnownPositions', () => {
    it('is a total no-op (null) while disabled and on the GM lane', () => {
        expect(renderPositions([token()], new Set(), false).result.current).toBeNull();
        expect(renderPositions([token()], new Set(), true, true).result.current).toBeNull();
    });

    it('records only while visible: live token = no ghost; fogged move ghosts at the LAST-SEEN cell; further fog hops do not move the ghost', () => {
        const { result, rerender } = renderPositions([token()], new Set());
        expect(result.current.size).toBe(0); // seen at (2,2), nothing to ghost

        rerender({ items: [token({ gridX: 5, gridY: 5 })], fog: fogOf('5,5'), enabled: true, isLocalhost: false });
        expect(result.current.get('gob-1')).toEqual({ gridX: 2, gridY: 2 });

        rerender({ items: [token({ gridX: 8, gridY: 1 })], fog: fogOf('8,1'), enabled: true, isLocalhost: false });
        expect(result.current.get('gob-1')).toEqual({ gridX: 2, gridY: 2 }); // frozen
    });

    it('a token never seen outside fog ghosts nothing (no pre-cognition)', () => {
        const { result } = renderPositions([token()], fogOf('2,2'));
        expect(result.current.size).toBe(0);
    });

    it('re-reveal paints truth: unfogged again the token is live (no ghost) and memory follows the new position', () => {
        const { result, rerender } = renderPositions([token()], new Set());
        rerender({ items: [token({ gridX: 5, gridY: 5 })], fog: fogOf('5,5'), enabled: true, isLocalhost: false });
        expect(result.current.get('gob-1')).toEqual({ gridX: 2, gridY: 2 });

        rerender({ items: [token({ gridX: 6, gridY: 6 })], fog: new Set(), enabled: true, isLocalhost: false });
        expect(result.current.size).toBe(0); // live at (6,6)
        rerender({ items: [token({ gridX: 9, gridY: 9 })], fog: fogOf('9,9'), enabled: true, isLocalhost: false });
        expect(result.current.get('gob-1')).toEqual({ gridX: 6, gridY: 6 }); // memory refreshed while seen
    });

    it('npc tokens join the lane; prop rows are neither recorded nor ghosted', () => {
        const items = [
            token({ id: 'npc-1', type: 'npc' }),
            token({ id: 'bar-1', type: 'barrel', name: undefined }),
        ];
        const { result, rerender } = renderPositions(items, new Set());
        const fogged = items.map(i => ({ ...i, gridX: 4, gridY: 4 }));
        rerender({ items: fogged, fog: fogOf('4,4'), enabled: true, isLocalhost: false });
        expect(result.current.get('npc-1')).toEqual({ gridX: 2, gridY: 2 });
        expect(result.current.has('bar-1')).toBe(false);
    });

    it('hidden (visible:false) and removed tokens leave the memory — no ghost from forgotten ground', () => {
        const hide = renderPositions([token()], new Set());
        rerenderTo(hide, [token({ visible: false })], new Set());
        rerenderTo(hide, [token({ gridX: 7, gridY: 7 })], fogOf('7,7'));
        expect(hide.result.current.size).toBe(0); // hidden while seen → memory dropped

        const drop = renderPositions([token()], new Set());
        rerenderTo(drop, [], new Set());
        rerenderTo(drop, [token({ gridX: 7, gridY: 7 })], fogOf('7,7'));
        expect(drop.result.current.size).toBe(0); // removed → memory gone
    });

    it('toggle OFF drops the cache: an OFF stretch renders null and the later re-arm ghosts nothing stale', () => {
        const { result, rerender } = renderPositions([token()], new Set());
        rerender({ items: [token()], fog: new Set(), enabled: false, isLocalhost: false });
        expect(result.current).toBeNull();

        rerender({ items: [token({ gridX: 7, gridY: 7 })], fog: fogOf('7,7'), enabled: true, isLocalhost: false });
        expect(result.current.size).toBe(0); // (2,2) memory belonged to the ON stretch
    });

    it('missing/undefined item lists and fog inputs are inert', () => {
        const { result, rerender } = renderPositions(undefined, undefined);
        expect(result.current.size).toBe(0);
        rerender({ items: [token()], fog: undefined, enabled: true, isLocalhost: false });
        rerender({ items: undefined, fog: fogOf('2,2'), enabled: true, isLocalhost: false });
        expect(result.current.size).toBe(0);
    });
});

function rerenderTo(hook, items, fog) {
    hook.rerender({ items, fog, enabled: true, isLocalhost: false });
}
