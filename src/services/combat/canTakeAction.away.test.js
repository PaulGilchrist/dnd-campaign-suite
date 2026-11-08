// @maintained-by-ai
// Split-party gates in the enforcement pair: the pure awayDenial (runs after
// the mode master-switch, before the condition gate) and assertCanAct's
// combatSummary-row read. Base lanes live in canTakeAction.test.js /
// assertCanAct.test.js — only away deltas are pinned here.
import { describe, it, expect } from 'vitest';
import { canTakeAction } from './canTakeAction.js';

const ON = { mode: 'on', turnLock: true };
const OFF = { mode: 'off' };

describe('canTakeAction — split-party away gate', () => {
    it('enforcement ON + away ⇒ denied with the rejoin instruction', () => {
        const result = canTakeAction({ enforcement: ON, creatureName: 'Ann', isAway: true });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Ann is away from the party');
        expect(result.reason).toContain('rejoin');
    });
    it('away outranks the condition gate (right reason first)', () => {
        const result = canTakeAction({
            enforcement: ON, creatureName: 'Ann', isAway: true,
            cannotAct: true, cannotActReason: 'Stunned',
        });
        expect(result.reason).toContain('away from the party');
    });
    it('enforcement OFF stays byte-identical (away is advisory without enforcement)', () => {
        expect(canTakeAction({ enforcement: OFF, creatureName: 'Ann', isAway: true }))
            .toEqual({ allowed: true, reason: null });
    });
    it('present creatures unaffected (default false)', () => {
        expect(canTakeAction({ enforcement: ON, creatureName: 'Ann', activeCreatureName: 'Ann' }).allowed).toBe(true);
    });
});
