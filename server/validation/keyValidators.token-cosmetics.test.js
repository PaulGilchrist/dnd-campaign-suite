// @maintained-by-ai
// ─── Lane: keyValidators — tokenCosmetics row policing (Item 5) ───────────────
// The character runtime bucket is the canonical home of a token-cosmetics
// row (src/config/tokenCosmetics.js carries the lane trace); creature-store
// writes ride the wildcard POST chokepoint, so the SAME row shape the client
// renders must be the shape the server admits. OWNED here: pass-through of
// absent/null rows (buckets without the key round-trip byte-identically),
// acceptance of the canonical shape from ANY origin (players write their own
// character keys by design — this is a shape wall, not an authority wall),
// and plain-English refusals naming the offender for off-palette colors,
// unknown fields, non-boolean labels, and non-object rows.
import { describe, it, expect } from 'vitest';
import { validateRuntimeWrite } from './keyValidators.js';
import { TOKEN_PALETTE } from '../../src/config/tokenCosmetics.js';

const ctx = { req: { hostname: '192.168.0.44' }, campaign: 'test-campaign', current: {} };

// Creature-store writes carry an arbitrary character name as the key ⇒ the
// unregistered-key pass-through path runs the property scan.
const writeBucket = (value) => validateRuntimeWrite('FixtureFighter5e', value, ctx);

describe('tokenCosmetics property scan', () => {
    it('passes buckets without the key (byte-identical round-trip doctrine)', () => {
        expect(writeBucket({ activeConditions: ['poisoned'] }).ok).toBe(true);
        expect(writeBucket(null).ok).toBe(true);
    });

    it('accepts null/undefined (the honest unset)', () => {
        expect(writeBucket({ tokenCosmetics: null }).ok).toBe(true);
        expect(writeBucket({ tokenCosmetics: undefined }).ok).toBe(true);
    });

    it.each([
        [{ ringColor: null, hideLabel: false }],
        [{ ringColor: 'ember', hideLabel: true }],
        [{ ringColor: 'slate', hideLabel: null }],
        [{}],
        [{ hideLabel: true }],
    ])('accepts the canonical row %j from a visitor origin', (tokenCosmetics) => {
        const result = writeBucket({ tokenCosmetics });
        expect(result.ok).toBe(true);
        // Shape gate only — never an authority gate on this lane.
        expect(result.reason).toBeUndefined();
    });

    it('accepts every palette id (shares the client palette constant)', () => {
        for (const { id } of TOKEN_PALETTE) {
            expect(writeBucket({ tokenCosmetics: { ringColor: id } }).ok).toBe(true);
        }
    });

    it('refuses an off-palette color, naming it and listing the palette', () => {
        const result = writeBucket({ tokenCosmetics: { ringColor: 'neon' } });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('tokenCosmetics.ringColor');
        expect(result.reason).toContain('"neon"');
        for (const { id } of TOKEN_PALETTE) expect(result.reason).toContain(id);
    });

    it('refuses unknown fields, naming the offender and the known keys', () => {
        const result = writeBucket({ tokenCosmetics: { ringColor: 'gold', glow: true } });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('glow');
        expect(result.reason).toContain('ringColor, hideLabel');
    });

    it('refuses a non-boolean hideLabel', () => {
        const result = writeBucket({ tokenCosmetics: { hideLabel: 'yes' } });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('tokenCosmetics.hideLabel');
        expect(result.reason).toContain('"yes"');
    });

    it('refuses non-object rows', () => {
        for (const bad of ['ember', 42, ['gold']]) {
            const result = writeBucket({ tokenCosmetics: bad });
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('tokenCosmetics must be an object');
        }
    });
});
