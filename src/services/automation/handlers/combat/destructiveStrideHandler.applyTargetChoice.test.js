// @maintained-by-ai
// Destructive Stride — applyTargetChoice lane (second of quad; siblings cover
// handle / applyDamageTypeChoice / skipTargetChoice in their own files).
// Deterministic handler-contract tests over stable seams: target validation
// against the combat summary, the CLA-113 5-ft gate (isWithinRange) and the
// once-per-turn-per-creature {round, targets} latch, the damage-execution seam
// (1d<martialArtsDie> roll → applyDamageToTarget with lowercase type), the
// players filter, proximity note composition (gridless + measured lanes), the
// ability_use campaign log, and the automation_info popup consumed by
// CharActionModals.jsx / CharSpecialActions.jsx modal dispatch.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyTargetChoice } from './destructiveStrideHandler.js';
import * as combatData from '../../../encounters/combatData.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as logService from '../../../ui/logService.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// CLA-113: live 5-ft gate (isWithinRange, gridless-lenient), proximity advisory
// map reads, and the once-per-turn-per-creature latch store.
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => null),
}));
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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

const combatSummaryWithTargets = {
    creatures: [
        { name: 'TestMonk', type: 'player', currentHp: 50, maxHp: 50, size: 'Medium' },
        { name: 'Goblin', type: 'monster', currentHp: 7, maxHp: 7, size: 'Small' },
        { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 15, size: 'Medium' },
    ],
};

// Standard successful-choice args; tests spread over these defaults.
function strideArgs(overrides = {}) {
    return {
        action: makeAction(),
        playerStats: makePlayerStats(),
        campaignName,
        targetName: 'Goblin',
        chosenType: 'Fire',
        martialArtsDie: 6,
        ...overrides,
    };
}

function latchRound(round, targets) {
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_Destructive_Stride_usedRound') return { round, targets };
        return undefined;
    });
}

describe('destructiveStrideHandler — applyTargetChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks clears call history but keeps implementations — reset
        // the latch reader to its undefined default so per-test routers never
        // leak into later tests.
        runtimeState.getRuntimeValue.mockImplementation(() => undefined);
    });

    describe('target validation', () => {
        it('returns null when combatSummary is null', async () => {
            combatData.getCombatSummary.mockReturnValue(null);

            const result = await applyTargetChoice(strideArgs());

            expect(result).toBeNull();
        });

        it('returns null when target is not in combat (missing or empty name)', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            expect(await applyTargetChoice(strideArgs({ targetName: 'NonexistentCreature' }))).toBeNull();
            expect(await applyTargetChoice(strideArgs({ targetName: '' }))).toBeNull();
        });
    });

    describe('successful target choice', () => {
        it('gates on 5 ft, rolls 1d<martialArtsDie>, and returns the full automation_info popup', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            const action = makeAction();
            const result = await applyTargetChoice(strideArgs({ action }));

            expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('TestMonk', 'Goblin', 5);
            expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Destructive Stride',
                    automationType: 'destructive_stride',
                    description: 'Goblin takes 5 Fire damage.',
                    automation: action.automation,
                },
            });
        });

        it('calls applyDamageToTarget with correct parameters', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            await applyTargetChoice(strideArgs({ chosenType: 'Thunder' }));

            expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(combatSummaryWithTargets, 'Goblin', 3, ['thunder'], { campaignName, characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestMonk', suppressHpLog: false });
        });

        it('falls back to martialArtsDie in popup and log when the roll is unavailable', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue(null);

            const result = await applyTargetChoice(strideArgs({ targetName: 'Orc', chosenType: 'Cold', martialArtsDie: 8 }));

            expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
            expect(result.payload.description).toBe('Orc takes 8 Cold damage.');
            expect(logService.addEntry.mock.calls[0][1].description).toBe('Destructive Stride — Orc takes 8 Cold damage (1d8 roll: 8; gridless — GM-enforced 5 ft proximity).');
        });
    });

    describe('campaign logging', () => {
        it('logs the ability use with full damage details (gridless proximity note)', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

            await applyTargetChoice(strideArgs());

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestMonk',
                abilityName: 'Destructive Stride',
                targetName: 'Goblin',
                description: 'Destructive Stride — Goblin takes 4 Fire damage (1d6 roll: 4; gridless — GM-enforced 5 ft proximity).',
            }));
        });

        it('records measured token distance in the log note when a map with positions is active', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
            runtimeState.getRuntimeValue.mockImplementation((name) => {
                if (name === '__campaign__') return campaignName;
                if (name === '__map__') return 'Battlemap';
                return undefined;
            });
            mapsService.loadMapData.mockResolvedValueOnce({
                players: [
                    { name: 'TestMonk', gridX: 0, gridY: 0 },
                    { name: 'Goblin', gridX: 1, gridY: 0 },
                ],
            });
            rangeValidation.getDistanceFeet.mockReturnValueOnce(5);

            const result = await applyTargetChoice(strideArgs());

            expect(logService.addEntry.mock.calls[0][1].description).toBe('Destructive Stride — Goblin takes 4 Fire damage (1d6 roll: 4; token distance 5 ft).');
            expect(result.payload.description).toBe('Goblin takes 4 Fire damage.');
        });

        it('catches and logs errors from addEntry without throwing', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            logService.addEntry.mockRejectedValueOnce(new Error('log failure'));

            const result = await applyTargetChoice(strideArgs());

            expect(result.type).toBe('popup');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('CLA-113: once-per-turn-per-creature latch + 5 ft gate', () => {
        it('refuses a second Destructive Stride hit on the SAME creature in the SAME round — zero damage', async () => {
            combatData.getCombatSummary.mockReturnValue({ ...combatSummaryWithTargets, round: 3 });
            latchRound(3, ['Goblin']);

            const result = await applyTargetChoice(strideArgs());

            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Goblin has already taken Destructive Stride damage this turn — refused (once per turn per creature).');
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'destructive_stride_refused',
                automationDetail: 'already_damaged_this_turn',
            }));
        });

        it('re-arms next round and allows a fresh hit; stamps {round, targets} latch', async () => {
            combatData.getCombatSummary.mockReturnValue({ ...combatSummaryWithTargets, round: 4 });
            diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });
            latchRound(3, ['Goblin']);

            const result = await applyTargetChoice(strideArgs());

            expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
            expect(result.payload.description).toBe('Goblin takes 7 Fire damage.');
            const latchWrite = runtimeState.setRuntimeValue.mock.calls.find(a => a[1] === '_Destructive_Stride_usedRound');
            expect(latchWrite[2]).toEqual({ round: 4, targets: ['Goblin'] });
        });

        it('tracks multiple creatures independently within the round', async () => {
            combatData.getCombatSummary.mockReturnValue({ ...combatSummaryWithTargets, round: 2 });
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
            latchRound(2, ['Goblin']);

            await applyTargetChoice(strideArgs({ targetName: 'Orc' }));

            expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
            const latchWrite = runtimeState.setRuntimeValue.mock.calls.find(a => a[1] === '_Destructive_Stride_usedRound');
            expect(latchWrite[2]).toEqual({ round: 2, targets: ['Goblin', 'Orc'] });
        });

        it('refuses out-of-range targets (measured grid) — zero damage + refused log', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            rangeCheck.isWithinRange.mockResolvedValueOnce(false);

            const result = await applyTargetChoice(strideArgs());

            expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
            expect(result.payload.description).toBe('Goblin is beyond 5 feet — Destructive Stride refused (no damage).');
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                automationType: 'destructive_stride_refused',
                automationDetail: 'out_of_range_5ft',
            }));
        });
    });

    describe('players filter in combatSummary', () => {
        it('filters player characters from combatSummary creatures', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'TestMonk', type: 'player', currentHp: 50, maxHp: 50, size: 'Medium' },
                    { name: 'AllySorcerer', type: 'player', currentHp: 30, maxHp: 30, size: 'Medium' },
                    { name: 'Goblin', type: 'monster', currentHp: 7, maxHp: 7, size: 'Small' },
                ],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            await applyTargetChoice(strideArgs());

            const charactersArg = applyDamage.applyDamageToTarget.mock.calls[0][4].characters;
            expect(charactersArg.length).toBe(2);
            expect(charactersArg[0].name).toBe('TestMonk');
            expect(charactersArg[1].name).toBe('AllySorcerer');
        });

        it('passes empty array when no player creatures exist', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Goblin', type: 'monster', currentHp: 7, maxHp: 7, size: 'Small' },
                ],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            await applyTargetChoice(strideArgs());

            const charactersArg = applyDamage.applyDamageToTarget.mock.calls[0][4].characters;
            expect(charactersArg).toEqual([]);
        });
    });
});
