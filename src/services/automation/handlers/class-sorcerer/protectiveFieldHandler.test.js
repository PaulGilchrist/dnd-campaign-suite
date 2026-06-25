// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './protectiveFieldHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as diceRoller from '../../../dice/diceRoller.js';

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
    });

    describe('handle', () => {
        it('returns popup with automation_info type when no psionic energy remaining', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Protective Field');
        });

        it('includes rechargerecovery message when psionic energy is depleted', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

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

        it('returns popup with reduction value when psionic energy is available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Protective Field');
            expect(result.payload.description).toContain('Reduce damage by');
        });

        it('computes reduction as die roll result plus intelligence modifier', async () => {
            // dieRoll.total=4, intMod=3 => reduction=7
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

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

        it('passes automation object through to the popup payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.automation).toEqual({ type: 'protective_field' });
        });

        it('passes automationType through to the popup payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.automationType).toBe('protective_field');
        });

        it('uses default max of 6 when resources object is missing', async () => {
            const playerStats = { name: 'TestHero', abilities: [{ name: 'Intelligence', bonus: 3 }] };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Psionic Energy: 5/6');
        });

        it('uses default max from playerStats.resources when runtime value is not set', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'TestHero',
                abilities: [{ name: 'Intelligence', bonus: 2 }],
                resources: { psionicEnergy: { max: 8 } },
            };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Psionic Energy: 7/8');
        });

        it('uses default max from playerStats.resources when runtime value is undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);

            const playerStats = {
                name: 'TestHero',
                abilities: [{ name: 'Intelligence', bonus: 2 }],
                resources: { psionicEnergy: { max: 10 } },
            };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Psionic Energy: 9/10');
        });

        it('handles missing intelligence ability by treating bonus as 0', async () => {
            const playerStats = { name: 'TestHero', abilities: [] };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('+ INT 0');
        });

        it('handles missing abilities array by treating intelligence bonus as 0', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(6);

            const playerStats = { name: 'TestHero' };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('+ INT 0');
        });

        it('falls back to die size when dieRoll returns null', async () => {
            diceRoller.rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            // dieRoll=null => dieValue=psionicDieSize=6, intMod=3 => reduction=9
            expect(result.payload.description).toContain('9');
            expect(result.payload.description).toContain('Rolled 6');
            expect(result.payload.description).toContain('for 6');
        });

        it('falls back to die size when dieRoll returns object without total', async () => {
            diceRoller.rollExpression.mockReturnValue({});

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            // dieRoll.total=undefined => dieValue=psionicDieSize=6, intMod=3 => reduction=9
            expect(result.payload.description).toContain('9');
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
    });
});
