// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import {
    handle,
    handleTamedSurge,
    onTamedSurgeSelected,
    handleFeatsOfChaos,
    onDoubleRollSelected,
    onSurgeSelected,
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

function mockMathRandom(value) {
    vi.spyOn(global.Math, 'random').mockReturnValue(value);
}

function makeAction(auto = {}) {
    return {
        name: 'Wild Magic Surge',
        automation: { type: 'wild_magic_surge', ...auto },
        wildMagicSurgeTable: surgeTable,
    };
}

function makeActionNoTable(auto = {}) {
    return {
        name: 'Wild Magic Surge',
        automation: { type: 'wild_magic_surge', ...auto },
    };
}

function makeFoCAction(auto = {}) {
    return {
        name: 'Feats of Chaos',
        automation: { type: 'feats_of_chaos', ...auto },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        ...overrides,
    };
}

describe('wildMagicSurgeHandler', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
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
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('once per turn');
        });

        it('should return modal with controlled chaos when doubleRoll flag is true', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicDoubleRoll') return true;
                return null;
            });
            mockMathRandom(0.99);

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

        it('should return info popup when d20 roll is not 20', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            mockMathRandom(0.5);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('not a 20');
        });

        it('should log the d20 roll to campaign log when roll is not 20 (CLA-389)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            mockMathRandom(0.5);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: expect.stringContaining('not a 20'),
            }));
            expect(logService.addEntry.mock.calls[0][1].description).toContain('Rolled 11');
        });

        it('should log once-per-turn refusal to campaign log (CLA-389)', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestSorcerer' });
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'surgeUsedRound') return { round: 3, activeCreature: 'TestSorcerer' };
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Wild Magic Surge',
                description: expect.stringContaining('already used this turn'),
            }));
        });

        it('should return modal with roll mode when d20 roll is exactly 20 and table exists', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            // Math.floor(0.99 * 20) + 1 = 20
            mockMathRandom(0.99);

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

        it('should return modal with empty surgeTable when no table on playerStats', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            mockMathRandom(0.99);

            const result = await handle(makeActionNoTable(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.surgeTable).toEqual([]);
        });

        it('should skip once-per-turn check when autoSurge is true', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestSorcerer' });
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'surgeUsedRound') return { round: 3, activeCreature: 'TestSorcerer' };
                return null;
            });
            mockMathRandom(0.5);

            const result = await handle(
                { ...makeAction({ autoSurge: true }), name: 'Wild Magic Surge' },
                makePlayerStats(),
                'campaign',
                'map',
            );

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('roll');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                expect.anything(),
                'campaign',
            );
        });

        it('should skip marking surgeUsedRound when autoSurge is true in roll and doubleRoll paths', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            mockMathRandom(0.99);

            // Roll path: autoSurge should not mark surgeUsedRound
            const rollResult = await handle(
                { ...makeAction({ autoSurge: true }), name: 'Wild Magic Surge' },
                makePlayerStats(),
                'campaign',
                'map',
            );

            expect(rollResult.type).toBe('modal');
            expect(rollResult.payload.mode).toBe('roll');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                expect.anything(),
                'campaign',
            );

            vi.clearAllMocks();
            runtimeState.getRuntimeValue.mockReturnValue(null);

            // Double roll path: autoSurge should not mark surgeUsedRound
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicDoubleRoll') return true;
                return null;
            });
            mockMathRandom(0.99);

            const doubleResult = await handle(
                { ...makeAction({ autoSurge: true }), name: 'Wild Magic Surge' },
                makePlayerStats(),
                'campaign',
                'map',
            );

            expect(doubleResult.type).toBe('modal');
            expect(doubleResult.payload.mode).toBe('controlledChaos');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'surgeUsedRound',
                expect.anything(),
                'campaign',
            );
        });

        it('should detect hasRollOnTableEffect from active effects and show roll modal', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicSurgeEffects') {
                    return [{ effect: 'Roll on the surge table at the start of each turn' }];
                }
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('roll');
        });

        it('should use passives array to trigger double roll instead of runtime flag', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            mockMathRandom(0.99);

            const playerStats = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'auto_effect', effect: 'wild_magic_double_roll' },
                    ],
                },
            });

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('controlledChaos');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicDoubleRoll',
                false,
                'campaign',
                true,
            );
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
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should return modal with tamedSurge mode when uses available', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const playerStats = makePlayerStats({ wildMagicSurgeTable: surgeTable });
            const result = await handleTamedSurge(makeAction(), playerStats, 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('wildMagicSurge');
            expect(result.payload.mode).toBe('tamedSurge');
            expect(result.payload.surgeTable).toEqual(surgeTable);
        });

        it('should default to 1 use when runtime value is null/undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('tamedSurge');
        });

        it('should treat negative uses as no uses remaining', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return -1;
                return null;
            });

            const result = await handleTamedSurge(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should pass empty surgeTable when playerStats has no wildMagicSurgeTable', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const result = await handleTamedSurge(makeActionNoTable(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.surgeTable).toEqual([]);
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
            expect(result.payload.type).toBe('automation_info');
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

        it('should use default automation when action.automation is null', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const action = { name: 'Tamed Surge', automation: null };
            const result = await onTamedSurgeSelected(action, makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(result.type).toBe('popup');
            expect(result.payload.automation.type).toBe('wild_magic_tamed');
        });

        it('should return null when uses is null/undefined or negative', async () => {
            // null/undefined defaults to 1 use, so it proceeds
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'tamedSurgeUses',
                0,
                'campaign',
                true,
            );

            vi.clearAllMocks();
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return -3;
                return null;
            });

            const negResult = await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', { effect: 'Test effect' });

            expect(negResult).toBeNull();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should include duration from selectedSurge in surge effect', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'tamedSurgeUses') return 1;
                return null;
            });

            const selectedSurge = { effect: 'Test effect', duration: '1 round' };
            await onTamedSurgeSelected(makeAction(), makePlayerStats(), 'campaign', selectedSurge);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        roll: 'tamed',
                        effect: 'Test effect',
                        duration: '1 round',
                    }),
                ]),
                'campaign',
                true,
            );
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
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('SURGE');
            expect(result.payload.description).toContain('42');
            expect(result.payload.description).toContain('Test surge effect');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        roll: 42,
                        effect: 'Test surge effect',
                    }),
                ]),
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

        it('should return null when surge already applied with same roll and effect', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicSurgeEffects') {
                    return [
                        { roll: 42, effect: 'Test surge effect', duration: null, timestamp: 1000 },
                    ];
                }
                return null;
            });

            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect' }
            );

            expect(result).toBeNull();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should allow same roll with different effect', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'wildMagicSurgeEffects') {
                    return [
                        { roll: 42, effect: 'Different effect', duration: null, timestamp: 1000 },
                    ];
                }
                return null;
            });

            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'New effect' }
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('New effect');
        });

        it('should use default auto type when featureName is falsy', async () => {
            const result = await onSurgeSelected(
                null,
                makePlayerStats(),
                'campaign',
                50,
                { min: 49, max: 52, effect: 'Another effect' }
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('SURGE');
            expect(result.payload.automation.type).toBe('wild_magic_surge');
        });

        it('should include duration from surgeEntry when present or null when absent', async () => {
            const result = await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect', duration: '2 rounds' }
            );

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        duration: '2 rounds',
                    }),
                ]),
                'campaign',
                true,
            );

            vi.clearAllMocks();

            await onSurgeSelected(
                'Wild Magic Surge',
                makePlayerStats(),
                'campaign',
                42,
                { min: 41, max: 44, effect: 'Test surge effect' }
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        duration: null,
                    }),
                ]),
                'campaign',
                true,
            );
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
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should return popup with advantage description when uses available', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 1;
                return null;
            });

            const result = await handleFeatsOfChaos(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Advantage');
            expect(result.payload.description).toContain('Wild Magic Surge');
        });

        it('should activate FoC when using dedicated FoC action', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 1;
                return null;
            });

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Feats of Chaos');
            expect(result.payload.description).toContain('Advantage on next D20 test');
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
                true,
                'campaign',
                true,
            );
        });

        it('should show no uses when already exhausted', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 0;
                return null;
            });

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should default uses to 1 when runtime value is null/undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Advantage');
        });

        it('should treat negative uses as no uses remaining and decrement from higher values', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return -2;
                return null;
            });

            const result = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');

            vi.clearAllMocks();
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 2;
                return null;
            });

            const decResult = await handleFeatsOfChaos(makeFoCAction(), makePlayerStats(), 'campaign', 'map');

            expect(decResult.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                1,
                'campaign',
                true,
            );
        });
    });

    describe('onFeatsOfChaosConsume', () => {
        it('should deactivate FoC and return true flag when uses are 0', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 0;
                return null;
            });

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.featsOfChaosConsumed).toBe(true);
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
                expect.anything(),
                'campaign',
                true,
            );
        });

        it('should decrement uses when > 0 and deactivate FoC', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'featsOfChaosUses') return 2;
                return null;
            });

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.featsOfChaosConsumed).toBe(true);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                1,
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

        it('should default uses to 0 when runtime value is null/non-numeric', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.featsOfChaosConsumed).toBe(true);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosActive',
                false,
                'campaign',
                true,
            );

            vi.clearAllMocks();
            runtimeState.getRuntimeValue.mockReturnValue('not-a-number');

            const nanResult = await onFeatsOfChaosConsume(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(nanResult.featsOfChaosConsumed).toBe(true);
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'TestSorcerer',
                'featsOfChaosUses',
                expect.anything(),
                'campaign',
                true,
            );
        });
    });

    describe('onDoubleRollSelected', () => {
        it('should return info popup when no surge table', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Wild Magic Surge table');
        });

        it('should return info popup when no matching surge entry', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [{ min: 1, max: 5, effect: 'Surge 1' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no matching surge effect');
        });

        it('should return surge popup when matching entry found and reset runtime state', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Big surge!' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
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

        it('should fall back to default automation when action.automation is null', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Surge!' }], automation: null };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(result.payload.automation.type).toBe('wild_magic_surge');
        });

        it('should include duration from matching surge entry', async () => {
            const action = { name: 'Wild Magic Surge', featureName: 'Wild Magic Surge', surgeTable: [{ min: 18, max: 20, effect: 'Surge!', duration: '1 round' }] };
            runtimeState.getRuntimeValue.mockReturnValue(null);

            await onDoubleRollSelected(action, makePlayerStats(), 'campaign', 20);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'wildMagicSurgeEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        duration: '1 round',
                    }),
                ]),
                'campaign',
                true,
            );
        });
    });
});
