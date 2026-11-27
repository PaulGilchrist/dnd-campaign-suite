// @maintained-by-ai 2026-11-26
/**
 * Deferred plan C — lighting math: torch radii (20+20 ft = 4+8 cells at the
 * 5 ft grid; 'dim' halves), the absent-key bright default, Chebyshev square
 * radii, wall/closed-door shadowing via the shared ray model, multi-source
 * union with bright-beats-dim, the emits-nothing shapes ('none', no sources,
 * malformed tokens, zero grid), and board-edge clipping.
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeLightSetting,
    lightRadii,
    lightSources,
    computeLighting,
} from './lighting.js';

describe('lighting settings (plan C)', () => {
    it('absent/unknown keys are the canonical bright default', () => {
        expect(normalizeLightSetting(undefined)).toBe('bright');
        expect(normalizeLightSetting(null)).toBe('bright');
        expect(normalizeLightSetting('torchlight')).toBe('bright');
        expect(normalizeLightSetting('dim')).toBe('dim');
        expect(normalizeLightSetting('none')).toBe('none');
    });

    it('bright = 20 ft clear + 20 ft dim (4/8 cells); dim halves (2/4); none emits nothing', () => {
        expect(lightRadii('bright')).toEqual({ bright: 4, dim: 8 });
        expect(lightRadii(undefined)).toEqual({ bright: 4, dim: 8 });
        expect(lightRadii('dim')).toEqual({ bright: 2, dim: 4 });
        expect(lightRadii('none')).toBeNull();
    });

    it('sources = every PC token plus npc/monster props; doors/barrels never emit', () => {
        const pcs = [{ name: 'A', gridX: 1, gridY: 1 }];
        const items = [
            { type: 'npc', gridX: 2, gridY: 2 },
            { type: 'monster', gridX: 3, gridY: 3 },
            { type: 'door', gridX: 4, gridY: 4 },
            { type: 'barrel', gridX: 5, gridY: 5 },
        ];
        expect(lightSources(pcs, items)).toEqual([pcs[0], items[0], items[1]]);
        expect(lightSources(null, null)).toEqual([]);
    });
});

const open = new Set();
const noDoors = new Set();

describe('computeLighting (plan C)', () => {
    it.each([
        ['bright', 4, 8],
        ['dim', 2, 4],
    ])('%s torch at (10,10): full square bright band r=%d, dim ring to r=%d, unlit beyond', (setting, brightR, dimR) => {
        const { bright, dim } = computeLighting([{ gridX: 10, gridY: 10, light: setting }], open, noDoors, 30);
        expect(bright.size).toBe((2 * brightR + 1) ** 2);
        expect(dim.size).toBe((2 * dimR + 1) ** 2 - (2 * brightR + 1) ** 2);
        expect(bright.has(`${10 + brightR},10`)).toBe(true); // bright edge
        expect(dim.has(`${10 + dimR},10`)).toBe(true);       // dim edge
        expect(dim.has(`${10 + dimR + 1},10`)).toBe(false);  // beyond: unlit tier
        expect(bright.has('0,0')).toBe(false);
    });

    it('a wall strips its shadow cell from both bands; light still spills sideways', () => {
        const walls = new Set(['10,9']); // wall directly north of the torch
        const { bright, dim } = computeLighting([{ gridX: 10, gridY: 10 }], walls, noDoors, 30);
        expect(bright.has('10,10')).toBe(true);  // the source cell itself stays lit
        expect(bright.has('9,10')).toBe(true);   // lateral ray is unblocked
        expect(bright.has('10,8')).toBe(false);  // d=2 behind the wall — no light
        expect(dim.has('10,8')).toBe(false);
        expect(bright.has('10,6')).toBe(false);  // inside the bright radius, still shadowed
        expect(dim.has('10,6')).toBe(false);
    });

    it('a closed door blocks; opening it lets the light through', () => {
        const closedDoor = new Set(['10,9']);
        const blocked = computeLighting([{ gridX: 10, gridY: 10 }], open, closedDoor, 30);
        expect(blocked.bright.has('10,8')).toBe(false);
        const opened = computeLighting([{ gridX: 10, gridY: 10 }], open, noDoors, 30);
        expect(opened.bright.has('10,8')).toBe(true);
    });

    it('multi-source union: one torch\'s bright beats another\'s dim ring', () => {
        const a = computeLighting([{ gridX: 10, gridY: 10 }], open, noDoors, 30);
        const two = computeLighting([
            { gridX: 10, gridY: 10 },
            { gridX: 16, gridY: 10, light: 'dim' }, // its bright square sits in A's dim band
        ], open, noDoors, 30);
        expect(two.bright.size).toBeGreaterThan(a.bright.size);
        const overlap = [...two.bright].filter(k => a.dim.has(k));
        expect(overlap.length).toBeGreaterThan(0);
        overlap.forEach(k => expect(two.dim.has(k)).toBe(false)); // promoted out of dim
    });

    it('emits nothing: \'none\' setting, no sources, malformed token, zero grid', () => {
        const empties = [
            [[{ gridX: 10, gridY: 10, light: 'none' }], open, noDoors, 30],
            [null, open, noDoors, 30],
            [[{ gridX: null, gridY: 2 }], open, noDoors, 30],
            [[{ gridX: 1, gridY: 1 }], open, noDoors, 0],
        ];
        for (const [sources, walls, doors, size] of empties) {
            const { bright, dim } = computeLighting(sources, walls, doors, size);
            expect(bright.size).toBe(0);
            expect(dim.size).toBe(0);
        }
    });

    it.each([0, 29])('clips at the board edge from corner (%d,%d): never emits off-grid keys', (corner) => {
        const { bright, dim } = computeLighting([{ gridX: corner, gridY: corner }], open, noDoors, 30);
        expect(bright.size + dim.size).toBeGreaterThan(0);
        for (const k of [...bright, ...dim]) {
            const [x, y] = k.split(',').map(Number);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(30);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThan(30);
        }
    });
});
