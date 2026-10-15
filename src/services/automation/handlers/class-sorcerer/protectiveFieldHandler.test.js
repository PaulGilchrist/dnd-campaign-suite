// @maintained-by-ai
// Deterministic contract suite for protectiveFieldHandler (Psi Warrior protective field):
// psionicEnergy spend gate, die+INT reduction normalisation, defender healing via
// findLastAttack/getCombatContext, resource-tracking display, popup/log composition.
// All collaborators fully mocked; exact-key pins on runtime reads/writes; full-string
// pins on own-composed descriptions. Pure behaviour — no timers, no UI moving parts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './protectiveFieldHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageRollback from '../../common/damageRollback.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

const campaignName = 'test-campaign';
const playerName = 'TestHero';

function makeAction(overrides = {}) {
    return {
        name: 'Protective Field',
        automation: { type: 'protective_field', ...overrides.automation },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        _trackedResources: { psionicEnergy: { max: 6 } },
        ...overrides,
    };
}

describe('protectiveFieldHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(6);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        logService.addEntry.mockResolvedValue(undefined);
        automationService.evaluateAutoExpression.mockReturnValue(6);
        diceRoller.rollExpression.mockReturnValue({ total: 4 });
        damageUtils.getCombatContext.mockResolvedValue({
            players: [{ name: 'TestHero', hp: 50, maxHp: 50 }],
        });
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { targetName: 'TestHero', attackerName: 'Goblin' },
            attackerName: 'Goblin',
            targetName: 'TestHero',
            primaryDamage: 12,
            secondaryDamage: 0,
            totalDamage: 12,
            damageTypes: ['slashing'],
        });
    });

    describe('depleted energy', () => {
        it.each([0, -1])(
            'returns error popup and does not mutate state or log when uses are %d',
            async (uses) => {
                runtimeState.getRuntimeValue.mockReturnValue(uses);

                const result = await handle(makeAction(), makePlayerStats(), campaignName, 'my-map');

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Protective Field');
                expect(result.payload.description).toContain('No Psionic Energy remaining');
                expect(result.payload.description).toContain('Short or Long Rest');
                expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
                expect(logService.addEntry).not.toHaveBeenCalled();
                expect(diceRoller.rollExpression).not.toHaveBeenCalled();
                expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
            }
        );
    });

    describe('successful activation', () => {
        it('decrements psionic energy uses', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'psionicEnergy',
                5,
                campaignName,
            );
        });

        it('logs ability_use with full description', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Protective Field',
                description: 'TestHero used Protective Field to reduce damage by 7 '
                    + '(Rolled 6 for 4 + INT 3). Damage reduced to TestHero.',
            }));
        });

        it('returns popup with automation_info payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Protective Field');
            expect(result.payload.automationType).toBe('protective_field');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('passes campaign name to all runtime and log calls', async () => {
            await handle(makeAction(), makePlayerStats(), 'my-campaign', 'ignored-map');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(playerName, 'psionicEnergy', 'my-campaign');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'psionicEnergy', 5, 'my-campaign');
            expect(logService.addEntry).toHaveBeenCalledWith('my-campaign', expect.any(Object));
        });
    });

    describe('reduction calculation', () => {
        it('adds die roll total to intelligence modifier', async () => {
            // roll=4, intMod=3 => reduction=7
            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toBe(
                'Protective Field: Reduce damage by <strong>7</strong> (Rolled 6 for 4 + INT 3). '
                + 'Psionic Energy: 5/6. Damage to TestHero reduced.'
            );
        });

        it('uses psionicDieSize when die roll is null', async () => {
            diceRoller.rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            // dieValue=6 (fallback), intMod=3 => reduction=9
            expect(result.payload.description).toContain('Reduce damage by');
            expect(result.payload.description).toContain('<strong>9</strong>');
            expect(result.payload.description).toContain('Rolled 6 for 6');
        });

        it('uses psionicDieSize when die roll total is zero', async () => {
            diceRoller.rollExpression.mockReturnValue({ total: 0 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Reduce damage by');
            expect(result.payload.description).toContain('<strong>9</strong>');
        });

        it('applies negative intelligence modifier', async () => {
            const playerStats = makePlayerStats({ abilities: [{ name: 'Intelligence', bonus: -2 }] });

            const result = await handle(makeAction(), playerStats, campaignName);

            // dieValue=4, intMod=-2 => reduction=2
            expect(result.payload.description).toContain('Reduce damage by');
            expect(result.payload.description).toContain('<strong>2</strong>');
            expect(result.payload.description).toContain('+ INT -2');
        });

        it('treats missing intelligence ability as 0 modifier', async () => {
            const playerStats = makePlayerStats({ abilities: [] });

            const result = await handle(makeAction(), playerStats, campaignName);

            // dieValue=4, intMod=0 => reduction=4
            expect(result.payload.description).toContain('Reduce damage by');
            expect(result.payload.description).toContain('<strong>4</strong>');
            expect(result.payload.description).toContain('+ INT 0');
        });

        it('uses custom die size from evaluateAutoExpression', async () => {
            automationService.evaluateAutoExpression.mockReturnValue(8);
            diceRoller.rollExpression.mockReturnValue({ total: 5 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            // dieValue=5, intMod=3 => reduction=8
            expect(result.payload.description).toContain('Reduce damage by');
            expect(result.payload.description).toContain('<strong>8</strong>');
            expect(result.payload.description).toContain('Rolled 8 for 5');
        });
    });

    describe('healing', () => {
        it('applies healing when attack found and reduction is positive', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                'TestHero',
                7,
                campaignName,
            );
        });

        it('skips healing when no attack found', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                totalDamage: 0,
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('skips healing when reduction is zero', async () => {
            diceRoller.rollExpression.mockReturnValue({ total: 0 });
            automationService.evaluateAutoExpression.mockReturnValue(0);
            const playerStats = makePlayerStats({ abilities: [{ name: 'Intelligence', bonus: 0 }] });

            await handle(makeAction(), playerStats, campaignName);

            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('skips healing when getCombatContext returns null', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });
    });

    describe('resource tracking', () => {
        it('uses default max of 6 when _trackedResources is missing', async () => {
            const playerStats = makePlayerStats({ _trackedResources: undefined });

            const result = await handle(makeAction(), playerStats, campaignName);

            expect(result.payload.description).toContain('Psionic Energy: 5/6');
        });

        it('uses runtime value when null and falls back to default max', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Psionic Energy: 5/6');
        });

        it('uses custom max from _trackedResources', async () => {
            const playerStats = makePlayerStats({
                _trackedResources: { psionicEnergy: { max: 8 } },
            });

            const result = await handle(makeAction(), playerStats, campaignName);

            // currentUses=6 (from mock), decremented to 5, max=8
            expect(result.payload.description).toContain('Psionic Energy: 5/8');
        });

        it('decrements from runtime value even when it exceeds max', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'psionicEnergy', 9, campaignName,
            );
        });

        it('handles string-like numeric uses', async () => {
            runtimeState.getRuntimeValue.mockReturnValue('3');

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Psionic Energy: 2/6');
        });

        it('decrements to 0 when uses is 1', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'psionicEnergy', 0, campaignName,
            );
        });
    });

    describe('error handling', () => {
        it('handles addEntry rejection gracefully', async () => {
            logService.addEntry.mockRejectedValueOnce(new Error('log fail'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Reduce damage by');
            expect(result.payload.description).toContain('<strong>7</strong>');
        });

        it('throws when setRuntimeValue rejects (no catch in handler)', async () => {
            runtimeState.setRuntimeValue.mockRejectedValueOnce(new Error('write error'));

            await expect(
                handle(makeAction(), makePlayerStats(), campaignName)
            ).rejects.toThrow('write error');
        });
    });

    describe('action name fallback', () => {
        it('uses action name when provided', async () => {
            const result = await handle(makeAction({ name: 'Custom Name' }), makePlayerStats(), campaignName);

            expect(result.payload.name).toBe('Custom Name');
            expect(result.payload.description).toContain('Custom Name');
        });

        it('uses default name when action has no name', async () => {
            const action = { automation: { type: 'protective_field' } };
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.payload.name).toBe('Protective Field');
        });
    });
});
