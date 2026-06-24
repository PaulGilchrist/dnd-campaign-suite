// @improved-by-ai
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
        it('returns focus_points from the matching classLevel entry', () => {
            const playerStats = createPlayerStats('Cleric', 5, [
                { level: 1, focus_points: 1 },
                { level: 5, focus_points: 3 },
                { level: 17, focus_points: 4 },
            ]);

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(3);
            expect(classFeatures.getClassFeatures).not.toHaveBeenCalled();
        });

        it('returns the highest classLevel at or below the player level', () => {
            const playerStats = createPlayerStats('Monk', 11, [
                { level: 1, focus_points: 2 },
                { level: 6, focus_points: 3 },
                { level: 11, focus_points: 4 },
                { level: 17, focus_points: 5 },
            ]);

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(4);
        });

        it('falls back to maxFocusPoints when classLevel.focus_points is undefined', () => {
            const playerStats = createPlayerStats('Monk', 3, [{ level: 3, focus_points: undefined }]);
            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 2 });

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(2);
        });

        it('falls back to maxFocusPoints when classLevel.focus_points is null', () => {
            const playerStats = createPlayerStats('Monk', 3, [{ level: 3, focus_points: null }]);
            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 5 });

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(5);
        });

        it('falls back to maxFocusPoints when classLevel.focus_points is 0', () => {
            const playerStats = createPlayerStats('Monk', 3, [{ level: 3, focus_points: 0 }]);
            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 3 });

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(3);
        });

        it('returns 0 when no classLevel matches the player level and getClassFeatures returns null', () => {
            const playerStats = createPlayerStats('Wizard', 10, [
                { level: 1 },
                { level: 4 },
            ]);
            classFeatures.getClassFeatures.mockReturnValue(null);

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(0);
        });

        it('returns 0 when class_levels is empty', () => {
            const playerStats = createPlayerStats('Fighter', 1, []);

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(0);
        });

        it('returns 0 when class is undefined', () => {
            const playerStats = { name: 'NPC', level: 1 };

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(0);
        });

        it('throws TypeError when playerStats is null', () => {
            expect(() => getResourceAmount(null, 'focusPoints')).toThrow(TypeError);
        });

        it('throws TypeError when playerStats is undefined', () => {
            expect(() => getResourceAmount(undefined, 'focusPoints')).toThrow(TypeError);
        });

        it('returns 0 when getClassFeatures returns null and no matching classLevel exists', () => {
            const playerStats = createPlayerStats('Rogue', 5, [{ level: 5, focus_points: undefined }]);
            classFeatures.getClassFeatures.mockReturnValue(null);

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(0);
        });
    });

    describe('non-focusPoints resources', () => {
        it('returns the stored runtime value converted to a number', () => {
            runtimeState.getRuntimeValue.mockReturnValue('3');

            const result = getResourceAmount({ name: 'Barbarian' }, 'Rage');

            expect(result).toBe(3);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'rageUses');
        });

        it('returns the stored runtime value when it is already a number', () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const result = getResourceAmount({ name: 'Ranger' }, 'Favored Enemy');

            expect(result).toBe(5);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Ranger', 'favoredenemyUses');
        });

        it('builds the key by lowercasing and stripping whitespace from the resource name', () => {
            runtimeState.getRuntimeValue.mockReturnValue(2);

            getResourceAmount({ name: 'Monk' }, '  Flurry  ');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Monk', 'flurryUses');
        });

        it('collapses multiple consecutive spaces into none for the key', () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            getResourceAmount({ name: 'Paladin' }, 'Divine    Smite');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Paladin', 'divinesmiteUses');
        });

        it('lowercases camelCase resource names for the key', () => {
            runtimeState.getRuntimeValue.mockReturnValue(4);

            getResourceAmount({ name: 'Sorcerer' }, 'SorceryPoints');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Sorcerer', 'sorcerypointsUses');
        });

        it('preserves underscores in resource names for the key', () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            getResourceAmount({ name: 'Cleric' }, 'Channel_Energy');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Cleric', 'channel_energyUses');
        });

        it('falls back to _trackedResources when stored value is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'Warlock',
                _trackedResources: { pactwordUses: { current: 2 } },
            };

            const result = getResourceAmount(playerStats, 'Pact Word');

            expect(result).toBe(2);
        });

        it('falls back to _trackedResources when stored value is undefined', () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const playerStats = {
                name: 'Warlock',
                _trackedResources: { pactwordUses: { current: 2 } },
            };

            const result = getResourceAmount(playerStats, 'Pact Word');

            expect(result).toBe(2);
        });

        it('returns 0 when stored value is null and _trackedResources is missing', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = getResourceAmount({ name: 'Wizard' }, 'Arcane Recovery');

            expect(result).toBe(0);
        });

        it('returns 0 when stored value is null and _trackedResources is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = getResourceAmount({ name: 'Bard', _trackedResources: null }, 'Jack of All Trades');

            expect(result).toBe(0);
        });

        it('returns 0 when stored value is null and _trackedResources is undefined', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = getResourceAmount({ name: 'Druid', _trackedResources: undefined }, 'Wild Shape');

            expect(result).toBe(0);
        });

        it('returns 0 when tracked resource current is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'Monk',
                _trackedResources: { kiPointsUses: { current: null } },
            };

            const result = getResourceAmount(playerStats, 'Ki Points');

            expect(result).toBe(0);
        });

        it('returns 0 when tracked resource current is undefined', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'Monk',
                _trackedResources: { kiPointsUses: { current: undefined } },
            };

            const result = getResourceAmount(playerStats, 'Ki Points');

            expect(result).toBe(0);
        });

        it('does not read _trackedResources when stored value is present', () => {
            runtimeState.getRuntimeValue.mockReturnValue(7);

            const playerStats = {
                name: 'Barbarian',
                _trackedResources: { rageUses: { current: 99 } },
            };

            const result = getResourceAmount(playerStats, 'Rage');

            expect(result).toBe(7);
        });

        it('returns 0 when playerStats is an empty object', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = getResourceAmount({}, 'Some Resource');

            expect(result).toBe(0);
        });

        it('returns 0 when _trackedResources[key] entry exists but has no current property', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'Monk',
                _trackedResources: { kiPointsUses: {} },
            };

            const result = getResourceAmount(playerStats, 'Ki Points');

            expect(result).toBe(0);
        });
    });
});

// ── spendResource ──────────────────────────────────────────────

describe('spendResource', () => {
    it('subtracts amount from current value and stores the result', () => {
        runtimeState.getRuntimeValue.mockReturnValue(5);

        const result = spendResource('Fighter', 'Rage', 1, 'TestCampaign');

        expect(result).toBe(4);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', 4, 'TestCampaign');
    });

    it('treats null stored value as 0 before subtracting', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = spendResource('Wizard', 'Arcane', 1, 'TestCampaign');

        expect(result).toBe(-1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Wizard', 'Arcane', -1, 'TestCampaign');
    });

    it('treats undefined stored value as 0 before subtracting', () => {
        runtimeState.getRuntimeValue.mockReturnValue(undefined);

        const result = spendResource('Wizard', 'Arcane', 1, 'TestCampaign');

        expect(result).toBe(-1);
    });

    it('allows spending more than available, resulting in negative', () => {
        runtimeState.getRuntimeValue.mockReturnValue(2);

        const result = spendResource('Rogue', 'Sneak', 5, 'TestCampaign');

        expect(result).toBe(-3);
    });

    it('handles string current values by converting to Number', () => {
        runtimeState.getRuntimeValue.mockReturnValue('8');

        const result = spendResource('Sorcerer', 'Points', 3, 'TestCampaign');

        expect(result).toBe(5);
    });

    it('spends amount 0 leaving current unchanged', () => {
        runtimeState.getRuntimeValue.mockReturnValue(5);

        const result = spendResource('Fighter', 'Rage', 0, 'TestCampaign');

        expect(result).toBe(5);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', 5, 'TestCampaign');
    });

    it('handles campaignName as undefined', () => {
        runtimeState.getRuntimeValue.mockReturnValue(4);

        const result = spendResource('Druid', 'Wild', 1, undefined);

        expect(result).toBe(3);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Druid', 'Wild', 3, undefined);
    });

    it('passes resourceNameOrKey directly without transformation when used as a raw key', () => {
        runtimeState.getRuntimeValue.mockReturnValue(6);

        spendResource('Barbarian', 'rageUses', 2, 'TestCampaign');

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'rageUses', 'TestCampaign');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Barbarian', 'rageUses', 4, 'TestCampaign');
    });

    it('handles negative amount (adds back to resource)', () => {
        runtimeState.getRuntimeValue.mockReturnValue(3);

        const result = spendResource('Fighter', 'Rage', -2, 'TestCampaign');

        expect(result).toBe(5);
    });

    it('handles NaN amount resulting in NaN', () => {
        runtimeState.getRuntimeValue.mockReturnValue(5);

        const result = spendResource('Fighter', 'Rage', NaN, 'TestCampaign');

        expect(result).toBe(NaN);
    });

    it('handles amount of 0 when stored value is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = spendResource('Fighter', 'Rage', 0, 'TestCampaign');

        expect(result).toBe(0);
    });
});

// ── checkResourceRemaining ─────────────────────────────────────

describe('checkResourceRemaining', () => {
    it('returns remaining from stored value when present', () => {
        runtimeState.getRuntimeValue.mockReturnValue(3);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 3, canUse: true });
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', 'TestCampaign');
    });

    it('returns maxUses as remaining when stored value is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = checkResourceRemaining('Rage', 2, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 2, canUse: true });
    });

    it('returns maxUses as remaining when stored value is undefined', () => {
        runtimeState.getRuntimeValue.mockReturnValue(undefined);

        const result = checkResourceRemaining('Rage', 2, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 2, canUse: true });
    });

    it('returns canUse false when remaining is 0', () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 0, canUse: false });
    });

    it('returns canUse false when remaining is negative', () => {
        runtimeState.getRuntimeValue.mockReturnValue(-1);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: -1, canUse: false });
    });

    it('returns canUse true when remaining is positive', () => {
        runtimeState.getRuntimeValue.mockReturnValue(1);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 1, canUse: true });
    });

    it('handles string stored values by converting to Number', () => {
        runtimeState.getRuntimeValue.mockReturnValue('2');

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 2, canUse: true });
    });

    it('passes resourceKey directly without transformation', () => {
        runtimeState.getRuntimeValue.mockReturnValue(5);

        checkResourceRemaining('focusPoints', 10, 'Cleric', 'TestCampaign');

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Cleric', 'focusPoints', 'TestCampaign');
    });

    it('returns canUse false when maxUses is 0 and stored value is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = checkResourceRemaining('Rage', 0, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 0, canUse: false });
    });

    it('returns canUse false when maxUses is negative and stored value is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = checkResourceRemaining('Rage', -1, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: -1, canUse: false });
    });

    it('handles campaignName as undefined', () => {
        runtimeState.getRuntimeValue.mockReturnValue(3);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', undefined);

        expect(result).toEqual({ remaining: 3, canUse: true });
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', undefined);
    });
});
