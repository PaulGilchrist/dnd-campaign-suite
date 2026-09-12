// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyTargetChoice } from './destructiveStrideHandler.js';
import * as combatData from '../../../encounters/combatData.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
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

describe('destructiveStrideHandler — applyTargetChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('target validation', () => {
        it('returns null when combatSummary is null', async () => {
            combatData.getCombatSummary.mockReturnValue(null);

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            expect(result).toBeNull();
        });

        it('returns null when target is not found in combatSummary', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'NonexistentCreature',
                'Fire',
                6,
            );

            expect(result).toBeNull();
        });

        it('returns null for empty string targetName', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                '',
                'Fire',
                6,
            );

            expect(result).toBeNull();
        });
    });

    describe('successful target choice', () => {
        it('rolls dice and returns popup with damage', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Goblin takes 4 Fire damage.');
        });

        it('uses martialArtsDie as damage when roll total is missing', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue(null);

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Orc',
                'Cold',
                6,
            );

            expect(result.payload.description).toBe('Orc takes 6 Cold damage.');
        });

        it('uses martialArtsDie when rollResult has no total', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ rolls: [3] });

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Orc',
                'Cold',
                6,
            );

            expect(result.payload.description).toBe('Orc takes 6 Cold damage.');
        });

        it('calls rollExpression with correct dice formula', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
        });

        it('calls applyDamageToTarget with correct parameters', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Thunder',
                6,
            );

            expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(combatSummaryWithTargets, 'Goblin', 3, ['thunder'], campaignName, expect.any(Array), { ignoreResistance: false, attackerName: 'TestMonk', suppressHpLog: false },);
        });

        it('passes damage type as lowercase array to applyDamageToTarget', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Lightning',
                6,
            );

            const args = applyDamage.applyDamageToTarget.mock.calls[0];
            expect(args[3]).toEqual(['lightning']);
        });

        it('passes player characters as characters array to applyDamageToTarget', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            const charactersArg = applyDamage.applyDamageToTarget.mock.calls[0][5];
            expect(charactersArg.length).toBe(1);
            expect(charactersArg[0].name).toBe('TestMonk');
        });
    });

    describe('popup payload structure', () => {
        it('includes automation in popup payload', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            const action = makeAction();
            const result = await applyTargetChoice(
                action,
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            expect(result.payload.automation).toEqual(action.automation);
        });

        it('includes automationType in popup payload', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            expect(result.payload.automationType).toBe('destructive_stride');
        });

        it('includes correct name in popup payload', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            expect(result.payload.name).toBe('Destructive Stride');
        });
    });

    describe('logging', () => {
        it('logs the ability use with target damage details', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestMonk',
                abilityName: 'Destructive Stride',
                targetName: 'Goblin',
                description: expect.stringContaining('Goblin takes 4 Fire damage (d6 roll: 4).'),
            }));
        });

        it('logs the roll result in description', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 2, rolls: [2] });

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Orc',
                'Acid',
                6,
            );

            const callArgs = logService.addEntry.mock.calls[0][1];
            expect(callArgs.description).toContain('roll: 2');
        });

        it('uses martialArtsDie as roll value when rollResult is null', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue(null);

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Orc',
                'Cold',
                6,
            );

            const callArgs = logService.addEntry.mock.calls[0][1];
            expect(callArgs.description).toContain('roll: 6');
        });

        it('catches and logs errors from addEntry without throwing', async () => {
            combatData.getCombatSummary.mockReturnValue(combatSummaryWithTargets);
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            logService.addEntry.mockRejectedValue(new Error('log failure'));

            const result = await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            expect(result.type).toBe('popup');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
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

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            const charactersArg = applyDamage.applyDamageToTarget.mock.calls[0][5];
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

            await applyTargetChoice(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'Goblin',
                'Fire',
                6,
            );

            const charactersArg = applyDamage.applyDamageToTarget.mock.calls[0][5];
            expect(charactersArg).toEqual([]);
        });
    });
});
