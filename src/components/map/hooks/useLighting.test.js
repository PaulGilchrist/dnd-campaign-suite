// @maintained-by-ai: 2026-11-22
/**
 * Deferred plan C — useLighting hook contract (fog hook stays single-purpose
 * and owns its own suite; ray math is owned by lighting.test.js).
 * Owns: the OFF fast path returns null without touching the wall/door/ray
 * machinery at all, on-state yields the computeLighting sets, and input
 * changes (token drag, door toggle, flag flip) re-derive live.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const computeSpy = vi.hoisted(() => vi.fn(() => ({ bright: new Set(['1,1']), dim: new Set(['2,2']) })));
vi.mock('../../../services/maps/lighting.js', async () => {
    const actual = await vi.importActual('../../../services/maps/lighting.js');
    return { ...actual, computeLighting: computeSpy };
});

import useLighting from './useLighting.js';

const players = [{ name: 'A', gridX: 1, gridY: 1 }];
const placedItems = [{ id: 'n1', type: 'npc', name: 'Goblin', gridX: 3, gridY: 3, open: undefined }];

beforeEach(() => computeSpy.mockClear());

describe('useLighting (plan C)', () => {
    it('flag OFF (absent/false) ⇒ null and ZERO computation — today\'s map, byte-identical lane', () => {
        const { result, rerender } = renderHook(
            ({ flag }) => useLighting(flag, players, new Set(), placedItems, 30),
            { initialProps: { flag: undefined } },
        );
        expect(result.current).toBeNull();
        rerender({ flag: false });
        expect(result.current).toBeNull();
        expect(computeSpy).not.toHaveBeenCalled();
    });

    it('flag ON ⇒ sources/doors/walls/grid fed to the ray pass; sets returned verbatim', () => {
        const walls = new Set(['9,9']);
        const { result } = renderHook(() => useLighting(true, players, walls, placedItems, 30));
        expect(computeSpy).toHaveBeenCalledTimes(1);
        const [sources, effWalls, closedDoors, gridSize] = computeSpy.mock.calls[0];
        expect(sources.map(s => s.name)).toEqual(['A', 'Goblin']);
        expect(effWalls.has('9,9')).toBe(true);
        expect(closedDoors.size).toBe(0); // no door rows
        expect(gridSize).toBe(30);
        expect([...result.current.bright]).toEqual(['1,1']);
    });

    it('zero grid size short-circuits to null even with the flag on', () => {
        const { result } = renderHook(() => useLighting(true, players, new Set(), placedItems, 0));
        expect(result.current).toBeNull();
        expect(computeSpy).not.toHaveBeenCalled();
    });

    it('a token move re-derives (the drag lane lights live)', () => {
        const { result, rerender } = renderHook(
            ({ ps }) => useLighting(true, ps, new Set(), [], 30),
            { initialProps: { ps: players } },
        );
        expect(computeSpy).toHaveBeenCalledTimes(1);
        rerender({ ps: [{ ...players[0], gridX: 7 }] });
        expect(computeSpy).toHaveBeenCalledTimes(2);
        expect(computeSpy.mock.calls[1][0][0].gridX).toBe(7);
        expect(result.current).toBeTruthy();
    });
});
