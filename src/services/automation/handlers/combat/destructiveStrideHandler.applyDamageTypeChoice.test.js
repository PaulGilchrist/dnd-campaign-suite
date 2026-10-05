// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageTypeChoice } from './destructiveStrideHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

// CLA-113: the numeric +20 speed_boost grant rides addExpiration (CLA-067 lane).
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestMonk',
        level: 5,
        class: {
            class_levels: [
                { level: 1, martial_arts_die: 4 },
                { level: 5, martial_arts_die: 6 },
            ],
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Destructive Stride',
        automation: {
            type: 'destructive_stride',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        if (key in mocks) {
            return mocks[key];
        }
        return undefined;
    });
}

const combatSummaryWithTargets = {
    creatures: [
        { name: 'TestMonk', type: 'player', currentHp: 50, maxHp: 50, size: 'Medium' },
        { name: 'Goblin', type: 'monster', currentHp: 7, maxHp: 7, size: 'Small' },
        { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 15, size: 'Medium' },
    ],
};

describe('destructiveStrideHandler — applyDamageTypeChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('damage type validation', () => {
        it('returns null for undefined chosenType', async () => {
            const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, undefined);
            expect(result).toBeNull();
        });

        it('returns null for null chosenType', async () => {
            const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, null);
            expect(result).toBeNull();
        });

        it('returns null for empty string chosenType', async () => {
            const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, '');
            expect(result).toBeNull();
        });

        it('returns null for invalid damage type', async () => {
            const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Poison');
            expect(result).toBeNull();
        });

        it('returns null for case-insensitive mismatch', async () => {
            const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'fire');
            expect(result).toBeNull();
        });

        it('returns null for completely unrelated string', async () => {
            const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'bludgeoning');
            expect(result).toBeNull();
        });
    });

    describe('valid damage types', () => {
        const validTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

        for (const type of validTypes) {
            it(`returns modal for valid type: ${type}`, async () => {
                setupRuntimeMocks({});
                combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

                const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, type);

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('destructiveStrideTarget');
            });
        }
    });

    describe('runtime state changes', () => {
        it('sets destructiveStrideDamageType to the chosen type', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'destructiveStrideDamageType',
                'Fire',
                campaignName,
            );
        });

        it('sets destructiveStrideActive to true', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Cold');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'destructiveStrideActive',
                true,
                campaignName,
            );
        });

        it('calls setRuntimeValue three times (damage type + active flag + CLA-113 speed_buff)', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Lightning');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(3);
            const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(a => a[1] === 'activeBuffs');
            expect(buffsCall[2]).toEqual([
                { name: 'Destructive Stride', effect: 'speed_boost', speedBonus: 20, duration: 'until_end_of_turn' },
            ]);
        });

        it('CLA-113: dedupes a re-Stride speed_buff in-window (no stacking)', async () => {
            setupRuntimeMocks({
                'TestMonk:activeBuffs:TestCampaign': [
                    { name: 'Destructive Stride', effect: 'speed_boost', speedBonus: 20, duration: 'until_end_of_turn' },
                    { name: 'Blessing', effect: 'other' },
                ],
            });
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Cold');

            const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(a => a[1] === 'activeBuffs');
            const strideBuffs = buffsCall[2].filter(b => b.name === 'Destructive Stride');
            expect(strideBuffs.length).toBe(1);
            expect(buffsCall[2].find(b => b.name === 'Blessing')).toBeDefined();
        });

        it('CLA-113: registers name-scoped remove_active_buff clock anchored to the monk', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            const { addExpiration } = await import('../../../rules/effects/expirations.js');

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');

            expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
                attackerName: 'TestMonk',
                effects: [{ type: 'remove_active_buff', buffName: 'Destructive Stride' }],
                campaignName,
                expireOnCreatureName: 'TestMonk',
            }));
        });
    });

    describe('martial arts die calculation', () => {
        it('uses martial arts die from matching class level', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const action = makeAction();
            const result = await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Fire');

            expect(result.payload.martialArtsDie).toBe(6);
        });

        it('uses martial arts die from level 1 when player is level 1', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const stats = makePlayerStats({ level: 1 });
            const action = makeAction();
            const result = await applyDamageTypeChoice(action, stats, campaignName, 'Fire');

            expect(result.payload.martialArtsDie).toBe(4);
        });

        it('falls back to 4 when no matching class level found', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const stats = makePlayerStats({
                level: 10,
                class: {
                    class_levels: [
                        { level: 1, martial_arts_die: 4 },
                    ],
                },
            });
            const action = makeAction();
            const result = await applyDamageTypeChoice(action, stats, campaignName, 'Fire');

            expect(result.payload.martialArtsDie).toBe(4);
        });

        it('falls back to 4 when class_levels is empty', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const stats = makePlayerStats({
                class: { class_levels: [] },
            });
            const action = makeAction();
            const result = await applyDamageTypeChoice(action, stats, campaignName, 'Fire');

            expect(result.payload.martialArtsDie).toBe(4);
        });
    });

    describe('targets extraction', () => {
        it('excludes the player character from targets', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const action = makeAction();
            const result = await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Acid');

            const targets = result.payload.targets;
            expect(targets.length).toBe(2);
            expect(targets.every(t => t.name !== 'TestMonk')).toBe(true);
        });

        it('includes monsters as targets', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const action = makeAction();
            const result = await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Thunder');

            const targets = result.payload.targets;
            const targetNames = targets.map(t => t.name);
            expect(targetNames).toContain('Goblin');
            expect(targetNames).toContain('Orc');
        });

        it('includes target properties: name, type, currentHp, maxHp, size', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const action = makeAction();
            const result = await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Fire');

            const targets = result.payload.targets;
            expect(targets[0]).toHaveProperty('name');
            expect(targets[0]).toHaveProperty('type');
            expect(targets[0]).toHaveProperty('currentHp');
            expect(targets[0]).toHaveProperty('maxHp');
            expect(targets[0]).toHaveProperty('size');
        });

        it('handles combatSummary with no creatures', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue({ creatures: [] });

            const action = makeAction();
            const result = await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Fire');

            expect(result.payload.targets).toEqual([]);
        });
    });

    describe('combatSummary null/missing', () => {
        it('returns modal with empty targets when combatSummary is null', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(null);

            const action = makeAction();
            const result = await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Fire');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('destructiveStrideTarget');
            expect(result.payload.targets).toEqual([]);
        });
    });

    describe('logging', () => {
        it('logs the ability use to campaign log', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const action = makeAction();
            await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Fire');

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestMonk',
                abilityName: 'Destructive Stride',
                description: expect.stringContaining('Destructive Stride activated — Speed +20 ft (speed_boost) until end of turn, damage type set to Fire (d6).'),
            }));
        });

        it('logs the correct martial arts die in description', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const action = makeAction();
            await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Cold');

            const callArgs = logService.addEntry.mock.calls[0][1];
            expect(callArgs.description).toContain('d6');
        });

        it('catches and logs errors from addEntry without throwing', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            logService.addEntry.mockRejectedValue(new Error('log failure'));

            const action = makeAction();
            const result = await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Fire');

            expect(result).toBeDefined();
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('modal payload structure', () => {
        it('includes action, playerStats, campaignName, chosenType, martialArtsDie, targets in payload', async () => {
            setupRuntimeMocks({});
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const action = makeAction();
            const result = await applyDamageTypeChoice(action, makePlayerStats(), campaignName, 'Lightning');

            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBeDefined();
            expect(result.payload.campaignName).toBe(campaignName);
            expect(result.payload.chosenType).toBe('Lightning');
            expect(typeof result.payload.martialArtsDie).toBe('number');
            expect(Array.isArray(result.payload.targets)).toBe(true);
        });
    });
});

describe('destructiveStrideHandler — applyDamageTypeChoice payload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns modal with chosenType set correctly for Acid', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Acid');
        expect(result.payload.chosenType).toBe('Acid');
    });

    it('returns modal with chosenType set correctly for Cold', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Cold');
        expect(result.payload.chosenType).toBe('Cold');
    });

    it('returns modal with chosenType set correctly for Fire', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');
        expect(result.payload.chosenType).toBe('Fire');
    });

    it('returns modal with chosenType set correctly for Lightning', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Lightning');
        expect(result.payload.chosenType).toBe('Lightning');
    });

    it('returns modal with chosenType set correctly for Thunder', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Thunder');
        expect(result.payload.chosenType).toBe('Thunder');
    });

    it('computes martialArtsDie from class level matching player level', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const stats = makePlayerStats({ level: 5 });
        const result = await applyDamageTypeChoice(makeAction(), stats, campaignName, 'Fire');
        expect(result.payload.martialArtsDie).toBe(6);
    });

    it('computes martialArtsDie from level 1 class level', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const stats = makePlayerStats({ level: 1 });
        const result = await applyDamageTypeChoice(makeAction(), stats, campaignName, 'Fire');
        expect(result.payload.martialArtsDie).toBe(4);
    });

    it('uses martialArtsDie 4 as fallback when no class level matches', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const stats = makePlayerStats({
            level: 20,
            class: { class_levels: [{ level: 2, martial_arts_die: 8 }] },
        });
        const result = await applyDamageTypeChoice(makeAction(), stats, campaignName, 'Fire');
        expect(result.payload.martialArtsDie).toBe(4);
    });

    it('uses martialArtsDie 4 as fallback when class_levels is undefined', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const stats = makePlayerStats({ class: {} });
        const result = await applyDamageTypeChoice(makeAction(), stats, campaignName, 'Fire');
        expect(result.payload.martialArtsDie).toBe(4);
    });

    it('excludes the player from targets list', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');
        const targetNames = result.payload.targets.map(t => t.name);
        expect(targetNames).not.toContain('TestMonk');
    });

    it('includes all non-player creatures as targets', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');
        const targetNames = result.payload.targets.map(t => t.name);
        expect(targetNames).toContain('Goblin');
        expect(targetNames).toContain('Orc');
    });

    it('returns empty targets when combatSummary has no creatures', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue({ creatures: [] });

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');
        expect(result.payload.targets).toEqual([]);
    });

    it('returns empty targets when combatSummary is null', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(null);

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');
        expect(result.payload.targets).toEqual([]);
    });

    it('sets runtime values before returning modal', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Thunder');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk',
            'destructiveStrideDamageType',
            'Thunder',
            campaignName,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk',
            'destructiveStrideActive',
            true,
            campaignName,
        );
    });

    it('logs ability use with correct description format', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Acid');

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestMonk',
            abilityName: 'Destructive Stride',
            description: expect.stringContaining('Acid'),
        }));
    });

    it('does not throw when addEntry rejects', async () => {
        setupRuntimeMocks({});
        combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

        logService.addEntry.mockRejectedValue(new Error('log error'));

        const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');
        expect(result.type).toBe('modal');
    });
});
