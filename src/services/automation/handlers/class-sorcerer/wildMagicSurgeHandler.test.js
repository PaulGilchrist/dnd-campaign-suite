// @improved-by-ai
import {
    handle,
    handleTamedSurge,
    onTamedSurgeSelected,
    handleFeatsOfChaos,
    onDoubleRollSelected,
    onFeatsOfChaosActivate,
    onFeatsOfChaosConsume,
} from './wildMagicSurgeHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../../services/encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

const surgeTable = [
    { min: 1, max: 5, effect: 'Surge effect 1' },
    { min: 6, max: 10, effect: 'Surge effect 2' },
    { min: 11, max: 15, effect: 'Surge effect 3' },
    { min: 16, max: 20, effect: 'Surge effect 4' },
];

const makeAction = (auto = {}) => ({
    name: 'Wild Magic Surge',
    automation: { type: 'wild_magic_surge', ...auto },
    wildMagicSurgeTable: surgeTable,
});

const makeActionNoTable = (auto = {}) => ({
    name: 'Wild Magic Surge',
    automation: { type: 'wild_magic_surge', ...auto },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestSorcerer',
    ...overrides,
});

describe('wildMagicSurgeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
        combatData.getCurrentCombatRound.mockReturnValue(1);
    });

    describe('handle', () => {
        it('should return popup when already used this round', async () => {
            combatData.getCurrentCombatRound.mockReturnValue(3);
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'surgeUsedRound') return 3;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('once per round');
        });

        it('should return modal with double roll when doubleRoll flag is true', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicDoubleRoll') return true;
                return null;
            });
            const randomValues = [0.99, 0.5];
            let randomIndex = 0;
            vi.spyOn(global.Math, 'random').mockImplementation(() => randomValues[randomIndex++]);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicDoubleRoll');
            expect(result.payload.roll1).toBe(20);
            expect(result.payload.roll2).toBeGreaterThanOrEqual(1);
            expect(result.payload.roll2).toBeLessThanOrEqual(20);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicDoubleRoll',
                false,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                1,
                'campaign',
                true,
            );
        });

        it('should return info popup when roll is not 20', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            vi.spyOn(global.Math, 'random').mockReturnValue(0.5);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not a 20');
        });

        it('should return surge popup when roll is 20 and table has matching entry', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            vi.spyOn(global.Math, 'random').mockReturnValue(19 / 20);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('SURGE');
            expect(result.payload.description).toContain('Surge effect');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                1,
                'campaign',
                true,
            );
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
            }));
        });

        it('should return info popup when roll is 20 but no surge table', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            vi.spyOn(global.Math, 'random').mockReturnValue(19 / 20);

            const result = await handle(makeActionNoTable(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Wild Magic Surge table');
        });

        it('should return info popup when roll is 20 but no matching surge entry', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            vi.spyOn(global.Math, 'random').mockReturnValue(19 / 20);
            const action = {
                name: 'Wild Magic Surge',
                automation: { type: 'wild_magic_surge' },
                wildMagicSurgeTable: [{ min: 1, max: 5, effect: 'Surge 1' }],
            };

            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No matching surge effect');
        });
    });

    describe('handleTamedSurge', () => {
        it('should return info popup when no uses remaining', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 0;
                return null;
            });

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should return info popup when no surge table', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const result = await handleTamedSurge(makeActionNoTable(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Wild Magic Surge table');
        });

        it('should return modal with available surges excluding roll 20 entries', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicTamed');
            expect(result.payload.availableSurges.length).toBe(3);
            expect(result.payload.availableSurges.every(s => s.max < 20)).toBe(true);
        });

        it('should default to 0 uses when no stored value', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('onTamedSurgeSelected', () => {
        it('should return null when no uses remaining', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 0;
                return null;
            });

            const result = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(result).toBeNull();
        });

        it('should decrement uses and return popup with selected effect', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const result = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Tamed Surge');
            expect(result.payload.description).toContain('Test effect');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'tamedSurgeUses',
                0,
                'campaign',
                true,
            );
        });

        it('should add campaign log entry', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
            }));
        });
    });

    describe('handleFeatsOfChaos', () => {
        it('should return info popup when no uses remaining', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 0;
                return null;
            });

            const result = await handleFeatsOfChaos(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should return popup with advantage description when uses available', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 1;
                return null;
            });

            const result = await handleFeatsOfChaos(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Advantage');
            expect(result.payload.description).toContain('Wild Magic Surge');
        });

        it('should default to 0 uses when no stored value', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handleFeatsOfChaos(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('onDoubleRollSelected', () => {
        it('should return info popup when no surge table', async () => {
            const action = { featureName: 'Wild Magic Surge', surgeTable: [] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Wild Magic Surge table');
        });

        it('should return info popup when no matching surge entry', async () => {
            const action = { featureName: 'Wild Magic Surge', surgeTable: [{ min: 1, max: 5, effect: 'Surge 1' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no matching surge effect');
        });

        it('should return surge popup when matching entry found', async () => {
            const action = { featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Big surge!' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('SURGE');
            expect(result.payload.description).toContain('Big surge');
        });

        it('should reset wildMagicDoubleRoll flag and set surgeUsedRound', async () => {
            const action = { featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Big surge!' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicDoubleRoll',
                false,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                1,
                'campaign',
                true,
            );
        });

        it('should add campaign log entry', async () => {
            const action = { featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Big surge!' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
            }));
        });
    });

    describe('onFeatsOfChaosActivate', () => {
        it('should set featsOfChaosActive to true', async () => {
            const result = await onFeatsOfChaosActivate(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toEqual({ featsOfChaosActive: true });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosActive',
                true,
                'campaign',
                true,
            );
        });
    });

    describe('onFeatsOfChaosConsume', () => {
        it('should consume a use and deactivate', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 1;
                return null;
            });

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toEqual({ featsOfChaosConsumed: true });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                0,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosActive',
                false,
                'campaign',
                true,
            );
        });

        it('should still deactivate when no uses remaining', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 0;
                return null;
            });

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign');

            expect(result).toEqual({ featsOfChaosConsumed: true });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosActive',
                false,
                'campaign',
                true,
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                expect.any(Number),
                'campaign',
                true,
            );
        });
    });
});
