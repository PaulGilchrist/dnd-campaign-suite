// MA-0367: dc_success 'full' math — the Infernal Glaive save gates ONLY the
// wound clause, so the attack damage stands FULL on success AND failure, and
// Evasion never halves it (there is no half-damage outcome to halve). Every
// 'half'/'none' row must stay byte-identical (MA-0218/MA-0298 semantics).
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave, computeDamageAfterEvasion } from './applyDamage.js';

describe('MA-0367 computeDamageAfterSave dc_success "full"', () => {
    it('fails save → full rawDamage', () => {
        expect(computeDamageAfterSave(11, false, 'full')).toBe(11);
    });

    it('succeeds save → still FULL rawDamage (not halved, not zero)', () => {
        expect(computeDamageAfterSave(11, true, 'full')).toBe(11);
    });

    it("'half' row stays halved on success (byte-identical)", () => {
        expect(computeDamageAfterSave(11, true, 'half')).toBe(5);
        expect(computeDamageAfterSave(11, false, 'half')).toBe(11);
    });

    it("'none' row stays zero on success (MA-0218 regression)", () => {
        expect(computeDamageAfterSave(11, true, 'none')).toBe(0);
        expect(computeDamageAfterSave(11, false, 'none')).toBe(11);
    });
});

describe('MA-0367 computeDamageAfterEvasion dc_success "full"', () => {
    it('evasion ACTIVE on a full row does NOT halve — full on fail and success', () => {
        expect(computeDamageAfterEvasion(11, false, 'full', true)).toBe(11);
        expect(computeDamageAfterEvasion(11, true, 'full', true)).toBe(11);
    });

    it('evasion on a half row keeps the canonical 0 / half behaviour', () => {
        expect(computeDamageAfterEvasion(11, true, 'half', true)).toBe(0);
        expect(computeDamageAfterEvasion(11, false, 'half', true)).toBe(5);
    });
});
