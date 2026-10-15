// @maintained-by-ai
// Destructive Stride — applyDamageTypeChoice lane (first of quad; siblings cover
// handle / applyTargetChoice / skipTargetChoice in their own files).
// Deterministic handler-contract tests over stable seams: the case-sensitive
// DAMAGE_TYPES guard, runtime-store writes (damage type + active flag + CLA-113
// speed_buff), martial-arts die derivation, target extraction, campaign log line,
// and the { type:'modal', modalName:'destructiveStrideTarget' } handoff consumed by
// CharSpecialActions.jsx modal dispatch (registration lives there, lines 56-57 —
// verified present, no dropped-chooser bug in this family).
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageTypeChoice } from './destructiveStrideHandler.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
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

const SPEED_BUFF = {
    name: 'Destructive Stride',
    effect: 'speed_boost',
    speedBonus: 20,
    duration: 'until_end_of_turn',
};

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

function setupRuntimeMocks(mocks = {}) {
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

    describe('damage type validation (case-sensitive DAMAGE_TYPES guard)', () => {
        const invalidTypes = [undefined, null, '', 'Poison', 'fire', 'bludgeoning'];

        for (const invalid of invalidTypes) {
            it(`returns null with zero side effects for ${JSON.stringify(invalid)}`, async () => {
                const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, invalid);

                expect(result).toBeNull();
                expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
                expect(addExpiration).not.toHaveBeenCalled();
                expect(combatData.getCombatSummary).not.toHaveBeenCalled();
                expect(logService.addEntry).not.toHaveBeenCalled();
            });
        }
    });

    describe('valid damage types', () => {
        const validTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

        for (const type of validTypes) {
            it(`opens the target modal with chosenType ${type}`, async () => {
                setupRuntimeMocks();
                combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

                const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, type);

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('destructiveStrideTarget');
                expect(result.payload.chosenType).toBe(type);
            });
        }
    });

    describe('runtime state writes', () => {
        it('writes damage type, active flag, and CLA-113 speed_buff — exactly three sets', async () => {
            setupRuntimeMocks();
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(3);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'destructiveStrideDamageType', 'Fire', campaignName,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'destructiveStrideActive', true, campaignName,
            );
            const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(a => a[1] === 'activeBuffs');
            expect(buffsCall).toEqual(['TestMonk', 'activeBuffs', [SPEED_BUFF], campaignName]);
        });

        it('CLA-113: re-Stride in-window refreshes the speed_buff without stacking, preserving other buffs', async () => {
            setupRuntimeMocks({
                'TestMonk:activeBuffs:TestCampaign': [SPEED_BUFF, { name: 'Blessing', effect: 'other' }],
            });
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Cold');

            const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(a => a[1] === 'activeBuffs');
            expect(buffsCall[2]).toEqual([{ name: 'Blessing', effect: 'other' }, SPEED_BUFF]);
        });

        it('CLA-113: registers name-scoped remove_active_buff clock anchored to the monk', async () => {
            setupRuntimeMocks();
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');

            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'TestMonk',
                targetName: 'TestMonk',
                effects: [{ type: 'remove_active_buff', buffName: 'Destructive Stride' }],
                campaignName,
                rounds: undefined,
                expireOnCreatureName: 'TestMonk',
            });
        });
    });

    describe('martial arts die', () => {
        const matchedLevels = [
            { level: 5, expected: 6 },
            { level: 1, expected: 4 },
        ];

        for (const { level, expected } of matchedLevels) {
            it(`uses the martial_arts_die of the class_levels entry matching level ${level}`, async () => {
                setupRuntimeMocks();
                combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

                const result = await applyDamageTypeChoice(
                    makeAction(), makePlayerStats({ level }), campaignName, 'Fire',
                );

                expect(result.payload.martialArtsDie).toBe(expected);
            });
        }

        const fallbackCases = [
            ['no class_levels entry matches', { level: 10, class: { class_levels: [{ level: 1, martial_arts_die: 8 }] } }],
            ['class_levels is empty', { class: { class_levels: [] } }],
            ['class_levels is undefined', { class: {} }],
        ];

        for (const [label, overrides] of fallbackCases) {
            it(`falls back to d4 when ${label}`, async () => {
                setupRuntimeMocks();
                combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

                const result = await applyDamageTypeChoice(
                    makeAction(), makePlayerStats(overrides), campaignName, 'Fire',
                );

                expect(result.payload.martialArtsDie).toBe(4);
            });
        }
    });

    describe('targets extraction', () => {
        it('payload.targets is the exact non-player roster with full properties', async () => {
            setupRuntimeMocks();
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Acid');

            expect(result.payload.targets).toEqual([
                { name: 'Goblin', type: 'monster', currentHp: 7, maxHp: 7, size: 'Small' },
                { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 15, size: 'Medium' },
            ]);
        });

        const emptyCases = [
            ['combatSummary is null', null],
            ['combatSummary has no creatures', { creatures: [] }],
        ];

        for (const [label, summary] of emptyCases) {
            it(`targets is empty when ${label}`, async () => {
                setupRuntimeMocks();
                combatData.getCombatSummary.mockReturnValue(summary);

                const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');

                expect(result.type).toBe('modal');
                expect(result.payload.targets).toEqual([]);
            });
        }
    });

    describe('logging', () => {
        it('logs ability_use with the exact activation line', async () => {
            setupRuntimeMocks();
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestMonk',
                abilityName: 'Destructive Stride',
                description: 'Destructive Stride activated — Speed +20 ft (speed_boost) until end of turn, damage type set to Fire (d6).',
            }));
        });

        it('swallows addEntry rejection — still returns the modal and logs console.error', async () => {
            setupRuntimeMocks();
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            logService.addEntry.mockRejectedValueOnce(new Error('log failure'));

            const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Fire');

            expect(result.type).toBe('modal');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[DestructiveStride] Error logging:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    describe('modal payload composition', () => {
        it('payload is exactly { action, playerStats, campaignName, chosenType, martialArtsDie, targets }', async () => {
            setupRuntimeMocks();
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await applyDamageTypeChoice(action, playerStats, campaignName, 'Lightning');

            expect(Object.keys(result.payload).sort()).toEqual(
                ['action', 'campaignName', 'chosenType', 'martialArtsDie', 'playerStats', 'targets'],
            );
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
            expect(result.payload.campaignName).toBe(campaignName);
            expect(result.payload.chosenType).toBe('Lightning');
            expect(result.payload.martialArtsDie).toBe(6);
            expect(result.payload.targets).toEqual([
                { name: 'Goblin', type: 'monster', currentHp: 7, maxHp: 7, size: 'Small' },
                { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 15, size: 'Medium' },
            ]);
        });
    });
});
