// @maintained-by-ai 2026-11-26
// Unit tests for resourceCheck.js — automation-side resource gating over three
// small pure/logic-light functions. Pins the observable contracts only: the
// focusPoints level-table precedence lane, the server-first store → _trackedResources
// pool precedence, and the exact read/write seam through the runtime store.
// Key *casing* is pinned once in src/services/shared/usesKey.test.js; here we only
// pin that getResourceAmount ROUTES through that derivation. spendResource/
// checkResourceRemaining take the caller-supplied canonical key verbatim.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { getResourceAmount, spendResource, checkResourceRemaining } from './resourceCheck.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as classFeatures from '../../character/classFeatures.js';

// ── Helpers ────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
    classFeatures.getClassFeatures.mockReturnValue(null);
});

function createPlayerStats(name, level, classLevels) {
    const stats = { name, level };
    if (classLevels !== undefined) {
        stats.class = { class_levels: classLevels };
    }
    return stats;
}

// ── getResourceAmount: focusPoints lane ────────────────────────

describe('getResourceAmount — focusPoints lane', () => {
    it('the class_levels row matching the current level wins over every other source', () => {
        // Conflicting values from every other lane so precedence is observable
        // by value, not call order.
        classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 9 });
        runtimeState.getRuntimeValue.mockReturnValue(9);
        const playerStats = createPlayerStats('Cleric', 5, [
            { level: 1, focus_points: 1 },
            { level: 5, focus_points: 3 },
            { level: 17, focus_points: 4 },
        ]);

        expect(getResourceAmount(playerStats, 'focusPoints')).toBe(3);
        // Pin the special-cased lane: focus points come from the level table even
        // though trackedResources also seeds a `focusPoints` runtime row.
        expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([undefined, 0])(
        'a falsy focus_points (%s) on the matching row falls back to the features cap',
        (focusPoints) => {
            const playerStats = createPlayerStats('Monk', 3, [{ level: 3, focus_points: focusPoints }]);
            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 2 });

            expect(getResourceAmount(playerStats, 'focusPoints')).toBe(2);
        },
    );

    it('returns 0 when no row matches exactly and the features table offers no cap', () => {
        // No class object at all.
        expect(getResourceAmount({ name: 'NPC', level: 1 }, 'focusPoints')).toBe(0);
        // Rows exist but none matches the level (exact match, not nearest).
        expect(getResourceAmount(createPlayerStats('Wizard', 10, [{ level: 1 }, { level: 4 }]), 'focusPoints')).toBe(0);
    });
});

// ── getResourceAmount: tracked-resource lane ───────────────────

describe('getResourceAmount — tracked-resource lane', () => {
    it('routes through the shared uses-key derivation and coerces the stored value to a number', () => {
        runtimeState.getRuntimeValue.mockReturnValue('3');

        // Casing rules are pinned in usesKey.test.js; this pins the ROUTE:
        // name → getRuntimeUsesKey → two-arg runtime read (no campaign here).
        expect(getResourceAmount({ name: 'Monk' }, '  Flurry  ')).toBe(3);
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Monk', 'flurryUses');
    });

    it.each([
        ['server-first: the runtime store wins over _trackedResources', 7, { rageUses: { current: 99 } }, 7],
        ['a stored 0 is a real value, not a fallback trigger', 0, { rageUses: { current: 5 } }, 0],
        ['null store falls back to _trackedResources.current', null, { rageUses: { current: 2 } }, 2],
        ['a tracked entry without current falls through to 0', null, { rageUses: {} }, 0],
        ['absent everywhere is 0', null, undefined, 0],
    ])('%s', (_label, stored, trackedResources, expected) => {
        runtimeState.getRuntimeValue.mockReturnValue(stored);
        const playerStats = {
            name: 'Hero',
            ...(trackedResources ? { _trackedResources: trackedResources } : {}),
        };

        expect(getResourceAmount(playerStats, 'Rage')).toBe(expected);
    });
});

// ── spendResource ──────────────────────────────────────────────

describe('spendResource', () => {
    it.each([
        ['subtracts the amount from the stored value', 5, 1, 4],
        ['treats a null store as 0 before subtracting', null, 1, -1],
        ['never clamps: overspending goes negative', 2, 5, -3],
        ['a negative amount adds the resource back', 3, -2, 5],
    ])('%s', (_label, stored, amount, expected) => {
        runtimeState.getRuntimeValue.mockReturnValue(stored);

        // Canonical camelCase key passed verbatim — pins that spendResource does
        // NOT re-derive via getRuntimeUsesKey.
        expect(spendResource('Fighter', 'rageUses', amount, 'TestCampaign')).toBe(expected);
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter', 'rageUses', 'TestCampaign');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter', 'rageUses', expected, 'TestCampaign');
    });
});

// ── checkResourceRemaining ─────────────────────────────────────

describe('checkResourceRemaining', () => {
    it.each([
        ['the stored value is the remaining count', 3, 4, { remaining: 3, canUse: true }],
        ['a null store defaults remaining to maxUses', null, 2, { remaining: 2, canUse: true }],
        ['an exhausted pool blocks use', 0, 4, { remaining: 0, canUse: false }],
        ['a negative store (overspent latch) blocks use', -1, 4, { remaining: -1, canUse: false }],
        ['a null store with maxUses 0 blocks use', null, 0, { remaining: 0, canUse: false }],
    ])('%s', (_label, stored, maxUses, expected) => {
        runtimeState.getRuntimeValue.mockReturnValue(stored);

        expect(checkResourceRemaining('rageUses', maxUses, 'Fighter', 'TestCampaign')).toEqual(expected);
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter', 'rageUses', 'TestCampaign');
    });
});
