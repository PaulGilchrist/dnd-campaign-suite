// @improved-by-ai
import { handle } from './psychicTeleportationHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as automationExpressions from '../../../combat/automation/automationExpressions.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Rogue',
    level: 9,
    abilities: [
        { name: 'Dexterity', bonus: 4 },
        { name: 'Intelligence', bonus: 3 },
    ],
    proficiency: 3,
    _trackedResources: { psionicEnergy: { max: 8 } },
    ...overrides,
});

const makeAction = (auto = {}) => ({
    name: 'Soul Blades',
    automation: {
        type: 'auto_effect',
        effect: 'psychic_teleportation',
        trigger: 'psychic_teleportation',
        uses: '1',
        recharge: 'short_rest',
        ...auto,
    },
});

describe('psychicTeleportationHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when psionic energy is available', () => {
        it('returns popup with teleport description including distance and remaining energy', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => 5);
            automationExpressions.evaluateAutoExpression.mockReturnValue(8);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Soul Blades');
            expect(result.payload.description).toContain('Psionic Energy');
            expect(result.payload.description).toContain('Teleport');
            expect(result.payload.description).toMatch(/\d+ feet/);
            expect(result.payload.description).toContain('4/8');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('uses action name fallback when action has no name', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => 5);
            automationExpressions.evaluateAutoExpression.mockReturnValue(8);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            const action = { automation: makeAction().automation };
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Psychic Teleportation');
            expect(result.payload.description).toContain('Psychic Teleportation');
        });

        it('uses default max of 6 when runtime value is undefined and resources config is missing', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => undefined);
            automationExpressions.evaluateAutoExpression.mockReturnValue(8);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            const playerStats = makePlayerStats({ _trackedResources: undefined });
            const result = await handle(makeAction(), playerStats, 'test-campaign', null);

            expect(result.payload.description).toContain('5/6');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Rogue',
                'psionicEnergy',
                5,
                'test-campaign',
            );
        });

        it('uses tracked resource max when runtime value is undefined', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => undefined);
            automationExpressions.evaluateAutoExpression.mockReturnValue(8);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('7/8');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Rogue',
                'psionicEnergy',
                7,
                'test-campaign',
            );
        });
    });

    describe('when psionic energy is zero', () => {
        it('returns popup indicating no energy remaining', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => 0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(result.payload.description).toContain('Recharges on a Short or Long Rest');
        });
    });

    describe('when addEntry fails', () => {
        it('does not throw (fire-and-forget logging)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_player, _key, _campaign) => 5);
            automationExpressions.evaluateAutoExpression.mockReturnValue(8);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);
            const testError = new Error('Log service unavailable');
            logService.addEntry.mockRejectedValue(testError);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });
    });
});

// @cleaned-by-ai
