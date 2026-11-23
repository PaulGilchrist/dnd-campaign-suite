/**
 * Deferred plan C — lighting math: torch radii (20+20 ft = 4+4 cells at the
 * 5 ft grid; 'dim' halves), the absent-key bright default, Chebyshev square
 * radii, wall/closed-door shadowing via the shared ray model, multi-source
 * union with bright-beats-dim, and the off/no-sources empty shape.
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

    it('sources = every PC token plus creature props (doors/barrels never emit)', () => {
        const src = lightSources(
            [{ name: 'A', gridX: 1, gridY: 1 }],
            [{ type: 'npc', gridX: 2, gridY: 2 }, { type: 'monster', gridX: 3, gridY: 3 }, { type: 'door', gridX: 4, gridY: 4 }, { type: 'barrel', gridX: 5, gridY: 5 }],
        );
        expect(src).toHaveLength(3);
    });
});

const open = new Set();
const noDoors = new Set();

describe('computeLighting (plan C)', () => {
    it('open room: full square bright/dim bands; the far corners belong to neither', () => {
        const { bright, dim } = computeLighting([{ gridX: 10, gridY: 10, light: 'bright' }], open, noDoors, 30);
        expect(bright.size).toBe(9 * 9); // 4+4+1 cells square
        expect(dim.size).toBe(17 * 17 - 9 * 9);
        expect(bright.has('10,10')).toBe(true);
        expect(bright.has('14,10')).toBe(true);
        expect(dim.has('15,10')).toBe(true);
        expect(dim.has('18,10')).toBe(true); // d=8 is the dim edge (4 bright + 4 extension)
        expect(dim.has('19,10')).toBe(false); // beyond: unlit
        expect(bright.has('0,0')).toBe(false);
    });

    it('a wall strips its shadow column from both bands', () => {
        const walls = new Set(['10,9']); // wall directly north of the torch
        const { bright, dim } = computeLighting([{ gridX: 10, gridY: 10 }], walls, noDoors, 30);
        expect(bright.has('10,8')).toBe(false); // behind the wall — no light
        expect(bright.has('10,10')).toBe(true); // the source cell itself stays lit
        expect(dim.has('10,6')).toBe(false);
    });

    it('a closed door blocks; opening it lets the light through', () => {
        const closedDoor = new Set(['10,9']);
        const blocked = computeLighting([{ gridX: 10, gridY: 10 }], open, closedDoor, 30);
        expect(blocked.bright.has('10,8')).toBe(false);
        const opened = computeLighting([{ gridX: 10, gridY: 10 }], open, noDoors, 30);
        expect(opened.bright.has('10,8')).toBe(true);
    });

    it("'none' emits nothing; 'dim' lights the half band", () => {
        const none = computeLighting([{ gridX: 10, gridY: 10, light: 'none' }], open, noDoors, 30);
        expect(none.bright.size).toBe(0);
        expect(none.dim.size).toBe(0);
        const dim = computeLighting([{ gridX: 10, gridY: 10, light: 'dim' }], open, noDoors, 30);
        expect(dim.bright.size).toBe(5 * 5);
        expect(dim.dim.size).toBe(9 * 9 - 5 * 5);
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

    it('degrades clean: zero grid, no sources, malformed tokens', () => {
        expect(computeLighting([{ gridX: 1, gridY: 1 }], open, noDoors, 0).bright.size).toBe(0);
        expect(computeLighting(null, open, noDoors, 30).bright.size).toBe(0);
        expect(computeLighting([{ gridX: null, gridY: 2 }], open, noDoors, 30).bright.size).toBe(0);
    });

    it('clips at the board edge (never emits off-grid keys)', () => {
        const { bright, dim } = computeLighting([{ gridX: 0, gridY: 0 }], open, noDoors, 30);
        [...bright, ...dim].forEach(k => {
            const [x, y] = k.split(',').map(Number);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeGreaterThanOrEqual(0);
        });
    });
});
