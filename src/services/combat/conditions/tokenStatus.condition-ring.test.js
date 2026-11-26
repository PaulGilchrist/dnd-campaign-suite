// @maintained-by-ai 2026-11-25
// ─── Lane: tokenStatus.hasTokenStatusIndicators (Item 5 condition-ring law) ───
// The uniform "wears a condition ring" predicate must answer from the ONE
// registry derivation the chips use — never a second read of the raw
// buckets. Chip building/limits/dedupe stay in tokenStatus.test.js.
import { describe, it, expect } from 'vitest';
import {
    hasTokenStatusIndicators,
    buildTokenStatusIndicators,
    TOKEN_CONDITION_RING_RADIUS,
} from './tokenStatus.js';

describe('hasTokenStatusIndicators', () => {
    it('false for empty/absent data', () => {
        expect(hasTokenStatusIndicators('Thorin', null, null)).toBe(false);
        expect(hasTokenStatusIndicators('Thorin', [], [])).toBe(false);
    });

    it('true when a condition is present, matching the chip derivation', () => {
        expect(hasTokenStatusIndicators('Thorin', ['poisoned'], [])).toBe(true);
        expect(hasTokenStatusIndicators('Thorin', ['not-a-known-key'], [])).toBe(true);
        expect(hasTokenStatusIndicators('Thorin', ['poisoned'], [])
            === (buildTokenStatusIndicators('Thorin', ['poisoned'], []).length > 0)).toBe(true);
    });

    it('true for a campaign targetEffect aimed at THIS creature only', () => {
        const effects = [{ target: 'Gimli', effect: 'sanctuary', source: 'Cleric' }];
        expect(hasTokenStatusIndicators('Thorin', [], effects)).toBe(false);
        expect(hasTokenStatusIndicators('Gimli', [], effects)).toBe(true);
    });

    it('garbage-tolerant like the chip builder (never throws on odd condition input)', () => {
        expect(() => hasTokenStatusIndicators('Thorin', 'prone', [])).not.toThrow();
    });
});

describe('TOKEN_CONDITION_RING_RADIUS', () => {
    it('clears the shared 20px token disc', () => {
        expect(TOKEN_CONDITION_RING_RADIUS).toBeGreaterThan(20);
    });
});
