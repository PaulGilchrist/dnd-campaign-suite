// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './psionicStrikeHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as diceRoller from '../../../dice/diceRoller.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 14),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../../../../services/combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';

const { getRuntimeValue, setRuntimeValue } = runtimeState;
const { addEntry } = logService;
const { rollExpression } = diceRoller;

const DEFAULT_ACTION = {
    name: 'Psionic Strike',
    automation: {
        type: 'psionic_strike',
        resource: 'psionicEnergy',
        damageExpression: 'psionic_energy_die + INT modifier',
        damageType: 'Force',
        oncePerTurn: true,
        casting_time: '1 reaction, after attack',
    },
};

const DEFAULT_PLAYER_STATS = {
    name: 'Test Fighter',
    level: 12,
    _trackedResources: { psionicEnergy: { max: 8 } },
    abilities: [{ name: 'Intelligence', bonus: 3 }],
};

function makePlayerStats(overrides = {}) {
    return { ...DEFAULT_PLAYER_STATS, ...overrides };
}

function makeAction(overrides = {}) {
    return { ...DEFAULT_ACTION, ...overrides };
}

function makeRollResult(total, sides = 8) {
    return { total, rolls: [total], modifier: 0, formula: `1d${sides}` };
}

describe('psionicStrikeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue({ creatures: [] });
        getTargetFromAttacker.mockReturnValue({ name: 'Target Goblin' });
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        applyDamageToTarget.mockReturnValue(undefined);
    });

    describe('resource validation', () => {
        it('returns error popup when psionic energy is zero', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'psionicEnergy') return 0;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(result.payload.description).toContain('Short or Long Rest');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns error popup when psionic energy is negative', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'psionicEnergy') return -1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
        });

        it('uses default max when resources is null', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 3;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(4));
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(
                makeAction(),
                makePlayerStats({ _trackedResources: null }),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Psionic Energy: 2/6');
        });

        it('uses default max when resource key is missing from resources', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 3;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(4));
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(
                makeAction(),
                makePlayerStats({ _trackedResources: { otherResource: { max: 10 } } }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Psionic Energy: 2/6');
        });
    });

    describe('once-per-turn enforcement', () => {
        it('returns error popup when already used this turn', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return 'turn-1';
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Already used this turn');
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Test Fighter',
                'psionicEnergy',
                expect.any(Number),
                'test-campaign'
            );
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('does not enforce once-per-turn when oncePerTurn is false', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(4));
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(
                makeAction({ automation: { oncePerTurn: false } }),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Force damage');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'psionicEnergy',
                4,
                'test-campaign'
            );
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Test Fighter',
                'psionicStrikeUsedThisTurn',
                expect.any(String),
                'test-campaign'
            );
        });

        it('marks turn usage when oncePerTurn is true and not yet used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-3';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(6));
            setRuntimeValue.mockResolvedValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'psionicEnergy',
                4,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'psionicStrikeUsedThisTurn',
                'turn-3',
                'test-campaign'
            );
        });

        it('uses "unknown" as turn marker when currentTurn runtime value is missing', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return undefined;
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(6));
            setRuntimeValue.mockResolvedValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'psionicStrikeUsedThisTurn',
                'unknown',
                'test-campaign'
            );
        });
    });

    describe('damage calculation', () => {
        it('rolls die and calculates damage with INT modifier', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(rollExpression).toHaveBeenCalledWith('1d8');
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.anything(), 'Target Goblin', 8, ['Force'], 'test-campaign', [], false, 'Test Fighter'
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Force damage');
            expect(result.payload.description).toContain('Psionic Energy: 4/8');
            expect(result.payload.description).toContain('+ INT 3');
        });

        it('uses INT modifier of 0 when Intelligence ability is missing', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(
                makeAction(),
                makePlayerStats({ abilities: [] }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('+ INT 0');
        });

        it('applies negative INT modifier', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(
                makeAction(),
                makePlayerStats({ abilities: [{ name: 'Intelligence', bonus: -2 }] }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('+ INT -2');
            expect(result.payload.description).toContain('Psionic Energy: 4/8');
        });

        it('uses psionicDieSize as fallback when rollExpression returns null', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(null);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Rolled 8 for 8');
        });

        it('uses psionicDieSize as fallback when dieRoll.total is falsy', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue({ total: 0, rolls: [0] });
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Rolled 8 for 8');
        });
    });

    describe('die size by level', () => {
        function testDieSize(level, expectedDie) {
            it(`uses 1d${expectedDie} for level ${level}`, async () => {
                const playerStats = makePlayerStats({ level });
                getRuntimeValue.mockImplementation((player, key, _campaign) => {
                    if (player === 'characters' && key === 'characters') return [];
                    if (key === 'psionicEnergy') return 8;
                    if (key === 'psionicStrikeUsedThisTurn') return null;
                    if (key === 'currentTurn') return 'turn-1';
                    return null;
                });
                rollExpression.mockReturnValue(makeRollResult(7, expectedDie));
                setRuntimeValue.mockResolvedValue(undefined);

                await handle(makeAction(), playerStats, 'test-campaign');

                expect(rollExpression).toHaveBeenCalledWith(`1d${expectedDie}`);
            });
        }

        testDieSize(1, 6);
        testDieSize(3, 6);
        testDieSize(9, 8);
        testDieSize(17, 12);
    });

    describe('logging', () => {
        it('calls addEntry with ability_use log entry', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Fighter',
                abilityName: 'Psionic Strike',
                description: expect.stringContaining('Force damage'),
            }));
        });

        it('calls addEntry with damage_roll log entry', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'damage_roll',
                characterName: 'Test Fighter',
                targetName: 'Target Goblin',
                damageType: 'Force',
                total: 8,
            }));
        });

        it('handles addEntry failure gracefully', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);
            addEntry.mockRejectedValue(new Error('Network error'));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Force damage');
        });
    });

    describe('result structure', () => {
        it('returns popup with correct payload shape', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Psionic Strike');
            expect(result.payload.targetName).toBe('Target Goblin');
            expect(result.payload.automationType).toBe('psionic_strike');
            expect(result.payload.automation).toEqual(DEFAULT_ACTION.automation);
            expect(typeof result.payload.description).toBe('string');
        });
    });

    describe('target resolution', () => {
        it('returns error popup when no combat context exists', async () => {
            getCombatContext.mockResolvedValue(null);
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'psionicEnergy') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target available');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns error popup when no target found in combat', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'psionicEnergy') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target available');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns error popup when target name is missing', async () => {
            getTargetFromAttacker.mockReturnValue({ name: null });
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'psionicEnergy') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target available');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('telekinetic thrust integration', () => {
        function setupWithThrust(saveResult = { success: true, total: 15, roll: 12, saveBonus: 3 }) {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Target Goblin', conditions: [] }],
            });
            buildSaveDc.mockReturnValue(14);
            createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve(saveResult),
            });
        }

        const playerWithThrust = makePlayerStats({
            automation: {
                reactions: [{ type: 'telekinetic_thrust', saveType: 'STR', saveDc: 'ability', saveAbility: 'INT', options: [{ name: 'Prone + Push 10ft', effect: 'prone_and_push', value: 10 }] }],
            },
        });

        it('does nothing when player lacks telekinetic_thrust automation', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                return null;
            });
            rollExpression.mockReturnValue(makeRollResult(5));
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).not.toContain('saved');
            expect(result.payload.description).not.toContain('failed');
        });

        it('creates save listener when telekinetic_thrust is present', async () => {
            setupWithThrust();

            await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                targetName: 'Target Goblin',
                saveType: 'STR',
                saveDc: 14,
            }));
        });

        it('reports success in description when save passes', async () => {
            setupWithThrust();

            const result = await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(result.payload.description).toContain('saved vs Telekinetic Adept');
        });

        it('applies prone condition when save fails', async () => {
            setupWithThrust({ success: false, total: 10, roll: 6, saveBonus: 4 });

            await handle(makeAction(), playerWithThrust, 'test-campaign');

            const storageModule = await import('../../../../services/ui/storage.js');
            const storageCalls = storageModule.default.set.mock.calls.filter(
                call => call[0] === 'combatSummary'
            );
            expect(storageCalls.length).toBeGreaterThan(0);

            const { addCondition } = await import('../../../../services/combat/conditions/conditionSaveService.js');
            expect(addCondition).toHaveBeenCalled();
            const addConditionCall = addCondition.mock.calls[0];
            expect(addConditionCall[1]).toBe('Target Goblin');
            expect(addConditionCall[2].key).toBe('prone');
        });

        it('does not duplicate prone when already present', async () => {
            setupWithThrust({ success: false, total: 10, roll: 6, saveBonus: 4 });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Target Goblin', conditions: [{ key: 'prone', source: 'other' }] }],
            });

            await handle(makeAction(), playerWithThrust, 'test-campaign');

            const storageModule = await import('../../../../services/ui/storage.js');
            const storageCalls = storageModule.default.set.mock.calls.filter(
                call => call[0] === 'combatSummary'
            );
            expect(storageCalls.length).toBe(0);

            const { addCondition } = await import('../../../../services/combat/conditions/conditionSaveService.js');
            expect(addCondition).not.toHaveBeenCalled();
        });

        it('stores targetEffects when save fails', async () => {
            setupWithThrust({ success: false, total: 10, roll: 6, saveBonus: 4 });
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                if (key === 'targetEffects') return [];
                return null;
            });

            await handle(makeAction(), playerWithThrust, 'test-campaign');

            const effectsCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            expect(effectsCalls.length).toBeGreaterThan(0);
            expect(effectsCalls[0][2]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Target Goblin',
                        source: 'Telekinetic Adept',
                        effect: 'push',
                        value: 10,
                        duration: 'until_start_of_next_turn',
                    }),
                ])
            );
        });

        it('logs a roll entry for the save prompt', async () => {
            setupWithThrust();

            await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                targetName: 'Target Goblin',
                saveType: 'STR',
                saveDc: 14,
            }));
        });

        it('reports failure in description when save fails', async () => {
            setupWithThrust({ success: false, total: 10, roll: 6, saveBonus: 4 });

            const result = await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(result.payload.description).toContain('Prone + pushed 10ft');
            expect(result.payload.description).toContain('failed');
        });

        it('handles missing combat context gracefully on save fail', async () => {
            setupWithThrust({ success: false, total: 10, roll: 6, saveBonus: 4 });
            getCombatContext
                .mockResolvedValueOnce({
                    creatures: [{ name: 'Target Goblin', conditions: [] }],
                })
                .mockResolvedValueOnce(null);
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'psionicEnergy') return 5;
                if (key === 'psionicStrikeUsedThisTurn') return null;
                if (key === 'currentTurn') return 'turn-1';
                if (key === 'targetEffects') return [];
                return null;
            });

            const result = await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('failed');
        });
    });
});
