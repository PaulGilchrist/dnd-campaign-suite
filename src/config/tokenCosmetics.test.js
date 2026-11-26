// @maintained-by-ai
// ─── Lane: config/tokenCosmetics.js — the ONE palette + canonical row ─────────
// OWNED here: palette shape (fixed ~8 in-theme swatches, unique ids), the
// id→class mapping shared by menu + render (no duplicated hex lists), and
// normalizeTokenCosmetics — the single reader that proves the DEFAULT row
// (absent/null/garbage) is exactly today's behavior: ringColor null (no
// class) and hideLabel false (label renders). Field-home rationale lives in
// the module header; server policing lives in keyValidators.token-cosmetics.test.js.
import { describe, it, expect } from 'vitest';
import {
    TOKEN_COSMETICS_KEY,
    TOKEN_PALETTE,
    isTokenRingId,
    getTokenRingClass,
    normalizeTokenCosmetics,
} from './tokenCosmetics.js';

describe('TOKEN_PALETTE', () => {
    it('is the fixed small swatch set with unique ids and human labels', () => {
        expect(TOKEN_PALETTE.length).toBe(8);
        const ids = TOKEN_PALETTE.map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const entry of TOKEN_PALETTE) {
            expect(entry.id).toMatch(/^[a-z]+$/);
            expect(typeof entry.label).toBe('string');
            expect(entry.label.length).toBeGreaterThan(0);
        }
    });
});

describe('isTokenRingId / getTokenRingClass', () => {
    it('accepts every palette id and maps it to its token-ring-<id> class', () => {
        for (const { id } of TOKEN_PALETTE) {
            expect(isTokenRingId(id)).toBe(true);
            expect(getTokenRingClass(id)).toBe(`token-ring-${id}`);
        }
    });

    it('rejects unknown/off-palette ids (and null/undefined) with false/null', () => {
        for (const bad of ['neon', '#ff0000', 'EMBER', '', null, undefined, 0, {}]) {
            expect(isTokenRingId(bad)).toBe(false);
            expect(getTokenRingClass(bad)).toBeNull();
        }
    });
});

describe('normalizeTokenCosmetics — the canonical default is today', () => {
    it.each([
        ['absent (undefined)', undefined],
        ['null', null],
        ['empty object', {}],
        ['garbage scalar', 'ember'],
        ['array', ['ember']],
        ['off-palette ring id', { ringColor: 'neon' }],
        ['non-boolean hideLabel', { hideLabel: 'yes' }],
    ])('%s normalizes to the untouched default row', (_label, row) => {
        expect(normalizeTokenCosmetics(row)).toEqual({ ringColor: null, hideLabel: false });
    });

    it('keeps a valid palette ring id and a strict boolean hideLabel', () => {
        expect(normalizeTokenCosmetics({ ringColor: 'leaf', hideLabel: true }))
            .toEqual({ ringColor: 'leaf', hideLabel: true });
        expect(normalizeTokenCosmetics({ ringColor: 'leaf', hideLabel: false }))
            .toEqual({ ringColor: 'leaf', hideLabel: false });
    });

    it('exports the one runtime bucket key the row lives under', () => {
        expect(TOKEN_COSMETICS_KEY).toBe('tokenCosmetics');
    });
});
