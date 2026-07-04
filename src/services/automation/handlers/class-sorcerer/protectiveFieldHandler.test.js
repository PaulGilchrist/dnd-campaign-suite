// @cleaned-by-ai
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
    findLastAttack: vi.fn().mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
    }),
}));

const makeAction = (auto = {}) => ({
    name: 'Protective Field',
    automation: { type: 'protective_field', ...auto },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestHero',
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    ...overrides,
});

describe('protectiveFieldHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(6);
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

    describe('handle', () => {
        it('returns popup with automation_info type and recharger message when no psionic energy remaining', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Protective Field');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(result.payload.description).toContain('Short or Long Rest');
        });

        it('does not mutate runtime state when psionic energy is depleted', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not log ability_use when psionic energy is depleted', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('computes reduction as die roll result plus intelligence modifier', async () => {
            // dieRoll.total=4, intMod=3 => reduction=7
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('7');
            expect(result.payload.description).toContain('+ INT 3');
        });

        it('decrements psionic energy uses after successful activation', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'psionicEnergy',
                5,
                'campaign'
            );
        });

        it('logs ability_use with full description on successful activation', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Protective Field',
                description: expect.stringMatching(/reduce damage by 7.*Rolled 6.*INT 3/),
            }));
        });

        it('uses default max of 6 when resources object is missing', async () => {
            const playerStats = { name: 'TestHero', abilities: [{ name: 'Intelligence', bonus: 3 }] };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Psionic Energy: 5/6');
        });

        it('uses default max from playerStats.resources when runtime value is null or undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'TestHero',
                abilities: [{ name: 'Intelligence', bonus: 2 }],
                _trackedResources: { psionicEnergy: { max: 8 } },
            };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Psionic Energy: 7/8');
        });

        it('handles missing intelligence ability by treating bonus as 0', async () => {
            const playerStats = { name: 'TestHero', abilities: [] };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('+ INT 0');
        });

        it('falls back to die size when dieRoll returns null or missing total', async () => {
            diceRoller.rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            // dieRoll=null => dieValue=psionicDieSize=6, intMod=3 => reduction=9
            expect(result.payload.description).toContain('9');
            expect(result.payload.description).toContain('Rolled 6');
            expect(result.payload.description).toContain('for 6');
        });

        it('uses custom psionic die size from evaluateAutoExpression', async () => {
            automationService.evaluateAutoExpression.mockReturnValue(8);
            diceRoller.rollExpression.mockReturnValue({ total: 5 });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            // dieSize=8, roll=5, intMod=3 => reduction=8
            expect(result.payload.description).toContain('8');
            expect(result.payload.description).toContain('Rolled 8');
            expect(result.payload.description).toContain('for 5');
        });

        it('handles negative psionic energy uses as depleted', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(-1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('handles string-like numeric psionic energy uses', async () => {
            runtimeState.getRuntimeValue.mockReturnValue('3');

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Psionic Energy: 2/6');
        });

        it('uses campaign name for runtime state and logging', async () => {
            await handle(makeAction(), makePlayerStats(), 'my-campaign', 'my-map');

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('TestHero', 'psionicEnergy', 'my-campaign');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHero', 'psionicEnergy', 5, 'my-campaign');
            expect(logService.addEntry).toHaveBeenCalledWith('my-campaign', expect.any(Object));
        });

        it('applies healing to target for reduction amount when attack found', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                'TestHero',
                7,
                'campaign'
            );
        });

        it('does not apply healing when no attack found', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                totalDamage: 0,
            });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('does not apply healing when reduction is zero', async () => {
            diceRoller.rollExpression.mockReturnValue({ total: 0 });
            automationService.evaluateAutoExpression.mockReturnValue(0);
            const playerStats = { name: 'TestHero', abilities: [{ name: 'Intelligence', bonus: 0 }] };

            await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('includes defender name in popup and log entry when attack found', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Damage to TestHero reduced.');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                description: expect.stringContaining('Damage reduced to TestHero.'),
            }));
        });
    });
});
