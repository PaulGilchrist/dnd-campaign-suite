// @maintained-by-ai
// senseUtils apex-guard lane (#204-class half-guarded apexes at applyBlindsightSenses :65-era
// and applyTruesightSenses :88-era sites): automation?.tolerant array guards already LOUD
// (console.error + throw immediately below each apex deref), so the file's chosen posture is
// loud — a nullish apex playerStats must hit an explicit readable throw, not a raw V8
// TypeError on '.automation'. Coherence = matching THIS file's loud posture, per fix#204's
// per-file lesson; contrast the tolerant-quiet exemplars (automationPassives.js:19,
// greatWeaponFighting.js:42) which this file deliberately does not mirror.
// Consumer pre-gate: rules-senses.js computeSenses is called by rules.getPlayerStats on the
// stats object it built in-function — the guard arm is unreachable from prod, a misuse tripwire.
// getRuntimeValue is a hermetic seam ONLY (blindsight/truesight never read the store — the
// Third Eye lane owns that runtime key); pinning happens on the pure passives path.
// Owned elsewhere (cite-skip): darkvision folding (rules-senses lanes), the Skulker/Boon-of-
// Truesight disk rows, and the factory-wrapper dormant-copy drift pin in rulesFactory.test.js.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined), // hermetic seam — zero reads asserted below
}));

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { applyBlindsightSenses, applyTruesightSenses } from './senseUtils.js';

describe('applyBlindsightSenses apex guard (#204-class)', () => {
    it('nullish playerStats throws LOUD with exact console byte; senses untouched, store untouched', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const senses = [{ name: 'Darkvision', value: '60 ft.' }];
        expect(() => applyBlindsightSenses(undefined, senses)).toThrow('Missing playerStats: applyBlindsightSenses');
        expect(() => applyBlindsightSenses(null, senses)).toThrow('Missing playerStats: applyBlindsightSenses');
        expect(spy.mock.calls).toEqual([
            ['rules: missing playerStats for blindsight senses'],
            ['rules: missing playerStats for blindsight senses'],
        ]);
        expect(senses).toEqual([{ name: 'Darkvision', value: '60 ft.' }]); // refusal mutates nothing
        expect(getRuntimeValue).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('file posture preserved: apex present but passives missing still throws the pre-existing missing-array guard', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => applyBlindsightSenses({ name: 'Broken' }, [])).toThrow('Missing array: passives for Broken');
        spy.mockRestore();
    });

    it('full-stats behavior byte-intact: no blindsight passive -> senses passthrough by identity', () => {
        const senses = [];
        expect(applyBlindsightSenses({ name: 'X', automation: { passives: [] } }, senses)).toBe(senses);
        expect(applyBlindsightSenses({ name: 'X', automation: { passives: [
            { type: 'passive_buff', effect: 'truesight', range: '60 ft.' },
        ] } }, senses)).toBe(senses); // wrong-effect passive never leaks into blindsight
    });
});

describe('applyTruesightSenses apex guard (#204-class)', () => {
    it('nullish playerStats throws LOUD with exact console byte; senses untouched', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const senses = [];
        expect(() => applyTruesightSenses(undefined, senses)).toThrow('Missing playerStats: applyTruesightSenses');
        expect(() => applyTruesightSenses(null, senses)).toThrow('Missing playerStats: applyTruesightSenses');
        expect(spy.mock.calls).toEqual([
            ['rules: missing playerStats for truesight senses'],
            ['rules: missing playerStats for truesight senses'],
        ]);
        expect(senses).toEqual([]);
        expect(getRuntimeValue).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('file posture preserved: apex present but passives missing still throws the pre-existing missing-array guard', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => applyTruesightSenses({ name: 'Broken' }, [])).toThrow('Missing array: passives for Broken');
        spy.mockRestore();
    });

    it('full-stats behavior byte-intact: truesight passive folds exactly once', () => {
        const senses = [];
        const stats = { name: 'X', automation: { passives: [
            { type: 'passive_buff', effect: 'truesight', range: '120 ft.' },
        ] } };
        expect(applyTruesightSenses(stats, senses)).toBe(senses);
        expect(senses).toEqual([{ name: 'Truesight', value: '120 ft.' }]);
        applyTruesightSenses(stats, senses); // idempotent: .some guard, never a duplicate row
        expect(senses).toHaveLength(1);
    });
});
