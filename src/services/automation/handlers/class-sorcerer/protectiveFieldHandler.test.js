import { handle } from './protectiveFieldHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as diceRoller from '../../../dice/diceRoller.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
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
        it('should return popup when no psionic energy remaining', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should return popup with reduction value when psionic energy available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Reduce damage by');
            expect(result.payload.description).toContain('7');
            expect(result.payload.description).toContain('Psionic Energy: 5/6');
        });

        it('should decrement psionic energy uses', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'psionicEnergy',
                5,
                'campaign'
            );
        });

        it('should add campaign log entry', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Protective Field',
            }));
        });

        it('should use default max when resources not provided', async () => {
            const playerStats = { name: 'TestHero', abilities: [] };
            runtimeState.getRuntimeValue.mockReturnValue(6);

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Psionic Energy: 5/6');
        });

        it('should use default max from playerStats.resources when runtime value not set', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const playerStats = {
                name: 'TestHero',
                abilities: [{ name: 'Intelligence', bonus: 2 }],
                resources: { psionicEnergy: { max: 8 } },
            };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Psionic Energy: 7/8');
        });

        it('should handle missing intelligence ability', async () => {
            const playerStats = { name: 'TestHero', abilities: [] };
            runtimeState.getRuntimeValue.mockReturnValue(6);

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Reduce damage by');
            expect(result.payload.description).toContain('+ INT 0');
        });

        it('should handle dieRoll returning null', async () => {
            diceRoller.rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Reduce damage by');
        });

        it('should use custom psionic die size from evaluateAutoExpression', async () => {
            automationService.evaluateAutoExpression.mockReturnValue(8);
            diceRoller.rollExpression.mockReturnValue({ total: 5 });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Rolled 8');
        });
    });
});
