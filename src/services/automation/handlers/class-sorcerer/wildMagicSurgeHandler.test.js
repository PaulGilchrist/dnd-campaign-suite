// @cleaned-by-ai
import {
    handle,
    handleTamedSurge,
    onTamedSurgeSelected,
    handleFeatsOfChaos,
    onDoubleRollSelected,
    onSurgeSelected,
    onFeatsOfChaosActivate,
    onFeatsOfChaosConsume,
} from './wildMagicSurgeHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: 1, activeCreatureName: 'TestSorcerer' })),
}));

const surgeTable = [
    { min: 1, max: 4, effect: 'Surge effect 1' },
    { min: 5, max: 8, effect: 'Surge effect 2' },
    { min: 9, max: 12, effect: 'Surge effect 3' },
    { min: 13, max: 16, effect: 'Surge effect 4' },
    { min: 17, max: 20, effect: 'Surge effect 5' },
    { min: 21, max: 24, effect: 'Surge effect 6' },
    { min: 25, max: 28, effect: 'Surge effect 7' },
    { min: 29, max: 32, effect: 'Surge effect 8' },
    { min: 33, max: 36, effect: 'Surge effect 9' },
    { min: 37, max: 40, effect: 'Surge effect 10' },
    { min: 41, max: 44, effect: 'Surge effect 11' },
    { min: 45, max: 48, effect: 'Surge effect 12' },
    { min: 49, max: 52, effect: 'Surge effect 13' },
    { min: 53, max: 56, effect: 'Surge effect 14' },
    { min: 57, max: 60, effect: 'Surge effect 15' },
    { min: 61, max: 64, effect: 'Surge effect 16' },
    { min: 65, max: 68, effect: 'Surge effect 17' },
    { min: 69, max: 72, effect: 'Surge effect 18' },
    { min: 73, max: 76, effect: 'Surge effect 19' },
    { min: 77, max: 80, effect: 'Surge effect 20' },
    { min: 81, max: 84, effect: 'Surge effect 21' },
    { min: 85, max: 88, effect: 'Surge effect 22' },
    { min: 89, max: 92, effect: 'Surge effect 23' },
    { min: 93, max: 96, effect: 'Surge effect 24' },
    { min: 97, max: 100, effect: 'Surge effect 25' },
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
        damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestSorcerer' });
    });

    describe('handle', () => {
        it('should return popup when already used this round', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestSorcerer' });
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'surgeUsedRound') return { round: 3, activeCreature: 'TestSorcerer' };
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('once per turn');
        });

        it('should return modal with controlled chaos when doubleRoll flag is true', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicDoubleRoll') return true;
                return null;
            });
            vi.spyOn(global.Math, 'random').mockReturnValue(0.99);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.mode).toBe('controlledChaos');
            expect(result.payload.roll1).toBeGreaterThan(0);
            expect(result.payload.roll1).toBeLessThanOrEqual(100);
            expect(result.payload.roll2).toBeGreaterThan(0);
            expect(result.payload.roll2).toBeLessThanOrEqual(100);
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
                { round: 1, activeCreature: 'TestSorcerer' },
                'campaign',
            );
        });

        it('should return info popup when roll is not 20', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            vi.spyOn(global.Math, 'random').mockReturnValue(0.5);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not a 20');
        });

        it('should return modal with roll mode when roll is 20 and table has matching entry', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            vi.spyOn(global.Math, 'random').mockReturnValue(0.99);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.mode).toBe('roll');
            expect(result.payload.roll).toBeGreaterThan(0);
            expect(result.payload.roll).toBeLessThanOrEqual(100);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                { round: 1, activeCreature: 'TestSorcerer' },
                'campaign',
            );
        });

        it('should return info popup when roll is 20 but no surge table', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            vi.spyOn(global.Math, 'random').mockReturnValue(0.99);

            const result = await handle(makeActionNoTable(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.surgeTable).toEqual([]);
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

        it('should return modal with tamedSurge mode', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.mode).toBe('tamedSurge');
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
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
            }));
        });
    });

    describe('onSurgeSelected', () => {
        it('should store last surge and log to campaign log', async () => {
            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect' }
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('SURGE');
            expect(result.payload.description).toContain('42');
            expect(result.payload.description).toContain('Test surge effect');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'lastWildMagicSurge',
                expect.objectContaining({
                    roll: 42,
                    effect: 'Test surge effect',
                }),
                'campaign',
                true,
            );
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: expect.stringContaining('42'),
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

        it('should return surge popup when matching entry found and reset runtime state', async () => {
            const action = { featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Big surge!' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('SURGE');
            expect(result.payload.description).toContain('Big surge');
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
                { round: 1, activeCreature: 'TestSorcerer' },
                'campaign',
            );
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
        it('should consume a use and deactivate when uses available', async () => {
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
