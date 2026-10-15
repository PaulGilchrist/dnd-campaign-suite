// @maintained-by-ai
// Unit tests for resourceCheck.js — three small pure/logic-light functions over
// stable contracts (runtime-store key construction, fallback precedence, arithmetic).
// Deterministic with mocked module boundaries; no churn expected as the app changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    clearRuntimeState: vi.fn(),
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
    runtimeState.setRuntimeValue.mockReturnValue(undefined);
    classFeatures.getClassFeatures.mockReturnValue(null);
});

function createPlayerStats(name, level, classLevels) {
    const stats = { name, level };
    if (classLevels !== undefined) {
        stats.class = { class_levels: classLevels };
    }
    return stats;
}

// ── getResourceAmount ──────────────────────────────────────────

describe('getResourceAmount', () => {
    describe('focusPoints resource', () => {
        it('returns focus_points from the matching classLevel entry without consulting getClassFeatures', () => {
            const playerStats = createPlayerStats('Cleric', 5, [
                { level: 1, focus_points: 1 },
                { level: 5, focus_points: 3 },
                { level: 17, focus_points: 4 },
            ]);

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(3);
            expect(classFeatures.getClassFeatures).not.toHaveBeenCalled();
        });

        it('falls back to getClassFeatures maxFocusPoints when classLevel.focus_points is falsy', () => {
            const playerStats = createPlayerStats('Monk', 3, [{ level: 3, focus_points: undefined }]);
            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 2 });

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(2);
        });

        it('returns 0 when no class_level entry matches and getClassFeatures offers no cap', () => {
            expect(getResourceAmount(createPlayerStats('Fighter', 1, []), 'focusPoints')).toBe(0);
            expect(getResourceAmount(createPlayerStats('Fighter', 1), 'focusPoints')).toBe(0);
            expect(getResourceAmount({ name: 'NPC', level: 1 }, 'focusPoints')).toBe(0);
            expect(getResourceAmount(createPlayerStats('Wizard', 10, [{ level: 1 }, { level: 4 }]), 'focusPoints')).toBe(0);
        });
    });

    describe('tracked resources', () => {
        it('builds the runtime key by lowercasing and stripping whitespace, returning the stored value as a number', () => {
            runtimeState.getRuntimeValue.mockReturnValue('3');

            const result = getResourceAmount({ name: 'Monk' }, '  Flurry  ');

            expect(result).toBe(3);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Monk', 'flurryUses');
        });

        it('falls back to _trackedResources current when the stored value is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'Warlock',
                _trackedResources: { pactwordUses: { current: 2 } },
            };

            const result = getResourceAmount(playerStats, 'Pact Word');

            expect(result).toBe(2);
        });

        it('prefers the stored value over _trackedResources when both are present', () => {
            runtimeState.getRuntimeValue.mockReturnValue(7);

            const playerStats = {
                name: 'Barbarian',
                _trackedResources: { rageUses: { current: 99 } },
            };

            const result = getResourceAmount(playerStats, 'Rage');

            expect(result).toBe(7);
        });

        it('returns 0 when no stored value and the tracked-resources fallback is absent', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            expect(getResourceAmount({ name: 'Wizard' }, 'Arcane Recovery')).toBe(0);
            expect(getResourceAmount({ name: 'Monk', _trackedResources: { kiPointsUses: {} } }, 'Ki Points')).toBe(0);
        });
    });
});

// ── spendResource ──────────────────────────────────────────────

describe('spendResource', () => {
    it('subtracts the amount from the stored value and writes the result back through the runtime store', () => {
        runtimeState.getRuntimeValue.mockReturnValue(5);

        const result = spendResource('Fighter', 'Rage', 1, 'TestCampaign');

        expect(result).toBe(4);
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', 'TestCampaign');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', 4, 'TestCampaign');
    });

    it('treats a null stored value as 0 before subtracting', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = spendResource('Wizard', 'Arcane', 1, 'TestCampaign');

        expect(result).toBe(-1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Wizard', 'Arcane', -1, 'TestCampaign');
    });

    it('never clamps: overspending goes negative and a negative amount adds back', () => {
        runtimeState.getRuntimeValue.mockReturnValue(2);
        expect(spendResource('Rogue', 'Sneak', 5, 'TestCampaign')).toBe(-3);

        runtimeState.getRuntimeValue.mockReturnValue(3);
        expect(spendResource('Fighter', 'Rage', -2, 'TestCampaign')).toBe(5);
    });
});

// ── checkResourceRemaining ─────────────────────────────────────

describe('checkResourceRemaining', () => {
    it('returns the stored value as remaining and reports canUse', () => {
        runtimeState.getRuntimeValue.mockReturnValue(3);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 3, canUse: true });
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', 'TestCampaign');
    });

    it('defaults remaining to maxUses when the stored value is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = checkResourceRemaining('Rage', 2, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 2, canUse: true });
    });

    it('reports canUse false when remaining is 0', () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 0, canUse: false });
    });
});
