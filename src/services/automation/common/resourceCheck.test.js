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

function resetMocks() {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
    runtimeState.setRuntimeValue.mockReturnValue(undefined);
    classFeatures.getClassFeatures.mockReturnValue(null);
}

// ── Tests ──────────────────────────────────────────────────────

describe('getResourceAmount', () => {
    beforeEach(resetMocks);

    describe('focusPoints special case', () => {
        it('returns focus_points from class_levels when classLevel.focus_points exists', () => {
            const playerStats = {
                name: 'Cleric',
                level: 5,
                class: {
                    class_levels: [
                        { level: 1, focus_points: 1 },
                        { level: 5, focus_points: 3 },
                        { level: 17, focus_points: 4 },
                    ],
                },
            };

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(3);
            expect(classFeatures.getClassFeatures).not.toHaveBeenCalled();
        });

        it('falls back to maxFocusPoints from getClassFeatures when classLevel.focus_points is undefined', () => {
            const playerStats = {
                name: 'Monk',
                level: 3,
                class: {
                    class_levels: [
                        { level: 3, focus_points: undefined },
                    ],
                },
            };

            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 2 });

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(2);
        });

        it('falls back to getClassFeatures when classLevel.focus_points is null', () => {
            const playerStats = {
                name: 'Monk',
                level: 3,
                class: {
                    class_levels: [
                        { level: 3, focus_points: null },
                    ],
                },
            };

            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 5 });

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(5);
        });

        it('uses getClassFeatures maxFocusPoints when classLevel.focus_points is 0 (falsy)', () => {
            const playerStats = {
                name: 'Monk',
                level: 3,
                class: {
                    class_levels: [
                        { level: 3, focus_points: 0 },
                    ],
                },
            };

            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 3 });

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(3);
        });

        it('returns 0 when class_levels does not contain matching level', () => {
            const playerStats = {
                name: 'Wizard',
                level: 10,
                class: {
                    class_levels: [
                        { level: 1 },
                        { level: 4 },
                    ],
                },
            };

            classFeatures.getClassFeatures.mockReturnValue({ maxFocusPoints: 4 });

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(4);
        });

        it('returns 0 when class_levels is empty', () => {
            const playerStats = {
                name: 'Fighter',
                level: 1,
                class: {
                    class_levels: [],
                },
            };

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(0);
        });

        it('returns 0 when class is undefined', () => {
            const playerStats = {
                name: 'NPC',
                level: 1,
            };

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(0);
        });

        it('throws when playerStats is null', () => {
            expect(() => getResourceAmount(null, 'focusPoints')).toThrow(TypeError);
        });

        it('returns 0 when getClassFeatures returns null', () => {
            const playerStats = {
                name: 'Rogue',
                level: 5,
                class: {
                    class_levels: [
                        { level: 5, focus_points: undefined },
                    ],
                },
            };

            classFeatures.getClassFeatures.mockReturnValue(null);

            const result = getResourceAmount(playerStats, 'focusPoints');

            expect(result).toBe(0);
        });
    });

    describe('non-focusPoints resources', () => {
        it('returns stored value when runtime value exists', () => {
            runtimeState.getRuntimeValue.mockReturnValue('3');

            const result = getResourceAmount({ name: 'Barbarian' }, 'Rage');

            expect(result).toBe(3);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'rageUses');
        });

        it('returns stored value when runtime value is a number', () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const result = getResourceAmount({ name: 'Ranger' }, 'Favored Enemy');

            expect(result).toBe(5);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Ranger', 'favoredenemyUses');
        });

        it('strips whitespace from resource name when building key', () => {
            runtimeState.getRuntimeValue.mockReturnValue(2);

            const result = getResourceAmount({ name: 'Monk' }, '  Flurry  ');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Monk', 'flurryUses');
            expect(result).toBe(2);
        });

        it('converts multiple spaces to single removal for key', () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = getResourceAmount({ name: 'Paladin' }, 'Divine    Smite');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Paladin', 'divinesmiteUses');
            expect(result).toBe(1);
        });

        it('lowercases camelCase resource names for key', () => {
            runtimeState.getRuntimeValue.mockReturnValue(4);

            const result = getResourceAmount({ name: 'Sorcerer' }, 'SorceryPoints');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Sorcerer', 'sorcerypointsUses');
            expect(result).toBe(4);
        });

        it('returns tracked resource current when stored value is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'Warlock',
                _trackedResources: {
                    pactwordUses: { current: 2 },
                },
            };

            const result = getResourceAmount(playerStats, 'Pact Word');

            expect(result).toBe(2);
        });

        it('returns 0 when stored value is null and no tracked resource exists', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = { name: 'Wizard' };

            const result = getResourceAmount(playerStats, 'Arcane Recovery');

            expect(result).toBe(0);
        });

        it('returns 0 when stored value is null and _trackedResources is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = { name: 'Bard', _trackedResources: null };

            const result = getResourceAmount(playerStats, 'Jack of All Trades');

            expect(result).toBe(0);
        });

        it('returns 0 when stored value is null and _trackedResources is undefined', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = { name: 'Druid', _trackedResources: undefined };

            const result = getResourceAmount(playerStats, 'Wild Shape');

            expect(result).toBe(0);
        });

        it('returns 0 when tracked resource current is null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'Monk2',
                _trackedResources: {
                    kiPointsUses: { current: null },
                },
            };

            const result = getResourceAmount(playerStats, 'Ki Points');

            expect(result).toBe(0);
        });

        it('returns 0 when tracked resource current is undefined', () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'Monk3',
                _trackedResources: {
                    kiPointsUses: { current: undefined },
                },
            };

            const result = getResourceAmount(playerStats, 'Ki Points');

            expect(result).toBe(0);
        });

        it('does not access _trackedResources when stored value is not null', () => {
            runtimeState.getRuntimeValue.mockReturnValue(7);

            const playerStats = {
                name: 'Barbarian2',
                _trackedResources: {
                    rageUses: { current: 99 },
                },
            };

            const result = getResourceAmount(playerStats, 'Rage');

            expect(result).toBe(7);
        });

        it('preserves underscores in resource names for key', () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = getResourceAmount({ name: 'Cleric' }, 'Channel_Energy');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Cleric', 'channel_energyUses');
            expect(result).toBe(1);
        });
    });
});

describe('spendResource', () => {
    beforeEach(resetMocks);

    it('subtracts amount from current value', () => {
        runtimeState.getRuntimeValue.mockReturnValue(5);

        const result = spendResource('Fighter', 'Rage', 1, 'TestCampaign');

        expect(result).toBe(4);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', 4, 'TestCampaign');
    });

    it('returns 0 when current value is null (defaults to 0 then subtracts)', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = spendResource('Wizard', 'Arcane', 1, 'TestCampaign');

        expect(result).toBe(-1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Wizard', 'Arcane', -1, 'TestCampaign');
    });

    it('handles spending more than available (goes negative)', () => {
        runtimeState.getRuntimeValue.mockReturnValue(2);

        const result = spendResource('Rogue', 'Sneak', 5, 'TestCampaign');

        expect(result).toBe(-3);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Rogue', 'Sneak', -3, 'TestCampaign');
    });

    it('spends the exact amount specified', () => {
        runtimeState.getRuntimeValue.mockReturnValue(10);

        const result = spendResource('Paladin', 'Smite', 3, 'TestCampaign');

        expect(result).toBe(7);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Paladin', 'Smite', 7, 'TestCampaign');
    });

    it('spends amount 1 when only amount is provided', () => {
        runtimeState.getRuntimeValue.mockReturnValue(3);

        const result = spendResource('Monk', 'Flurry', 1, 'TestCampaign');

        expect(result).toBe(2);
    });

    it('handles string current values by converting to Number', () => {
        runtimeState.getRuntimeValue.mockReturnValue('8');

        const result = spendResource('Sorcerer', 'Points', 3, 'TestCampaign');

        expect(result).toBe(5);
    });

    it('handles campaignName as undefined', () => {
        runtimeState.getRuntimeValue.mockReturnValue(4);

        const result = spendResource('Druid', 'Wild', 1, undefined);

        expect(result).toBe(3);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Druid', 'Wild', 3, undefined);
    });

    it('handles resourceNameOrKey as a raw key without transformation', () => {
        runtimeState.getRuntimeValue.mockReturnValue(6);

        spendResource('Barbarian', 'rageUses', 2, 'TestCampaign');

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'rageUses', 'TestCampaign');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Barbarian', 'rageUses', 4, 'TestCampaign');
    });
});

describe('checkResourceRemaining', () => {
    beforeEach(resetMocks);

    it('returns remaining equal to stored value when stored value exists', () => {
        runtimeState.getRuntimeValue.mockReturnValue(3);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 3, canUse: true });
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Fighter', 'Rage', 'TestCampaign');
    });

    it('returns remaining equal to maxUses when stored value is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = checkResourceRemaining('Rage', 2, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 2, canUse: true });
    });

    it('returns remaining equal to maxUses when stored value is undefined', () => {
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

    it('returns canUse true when remaining is greater than 0', () => {
        runtimeState.getRuntimeValue.mockReturnValue(1);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 1, canUse: true });
    });

    it('returns canUse true when maxUses is positive and stored value is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = checkResourceRemaining('Rage', 1, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 1, canUse: true });
    });

    it('returns canUse false when maxUses is 0 and stored value is null', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = checkResourceRemaining('Rage', 0, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 0, canUse: false });
    });

    it('handles string stored values by converting to Number', () => {
        runtimeState.getRuntimeValue.mockReturnValue('2');

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result).toEqual({ remaining: 2, canUse: true });
    });

    it('returns correct canUse when remaining is 1', () => {
        runtimeState.getRuntimeValue.mockReturnValue(1);

        const result = checkResourceRemaining('Rage', 4, 'Fighter', 'TestCampaign');

        expect(result.canUse).toBe(true);
        expect(result.remaining).toBe(1);
    });

    it('passes resourceKey directly without transformation', () => {
        runtimeState.getRuntimeValue.mockReturnValue(5);

        checkResourceRemaining('focusPoints', 10, 'Cleric', 'TestCampaign');

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Cleric', 'focusPoints', 'TestCampaign');
    });
});
