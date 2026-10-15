// @maintained-by-ai
// Pins telekineticThrustHandler.js's OWN implementation copy (manual thrust row):
// handle save-delegation, applyTelekineticThrust save flow, applyThrustEffect
// prone-add + storage.set + own log composition. Does NOT pin the CLA-355
// telekineticThrustUses uses gate (owned by psionicStrikeHandler.thrustRestGate
// .test.js — all handle tests run at implicit uses=1 with no spend assertions)
// nor the CLA-273 round latches (psionicStrikeHandler.test.js).
// FLAG (source duplication, for final report): applyTelekineticThrust/
// applyThrustEffect here are near-copies of psionicStrikeHandler.resolveThrustChain/
// knockThrustTargetProne — this suite deliberately pins THIS copy's wording
// ("knocked X Prone and pushed 10 feet away", not psionicStrike's "pushed X
// 10 feet away"). No test removals until the source is unified; after unification
// this suite and the gate lane's manual-row tests collapse onto one implementation.
import { handle, applyTelekineticThrust } from './telekineticThrustHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as conditionSaveService from '../../../combat/conditions/conditionSaveService.js';
import storage from '../../../../services/ui/storage.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../../../combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Telekinetic Thrust',
    automation: { type: 'telekinetic_thrust', saveType: 'STR', options: [], ...auto },
});

const makeActionWithOptions = (auto = {}) => ({
    name: 'Telekinetic Thrust',
    automation: { type: 'telekinetic_thrust', saveType: 'STR', options: [{ name: 'Push', effect: 'prone_and_push', value: 10 }], ...auto },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestHero',
    ...overrides,
});

function setupSaveMock(saveResult = { success: true, total: 15, roll: 12, saveBonus: 3 }) {
    savePrompt.createSaveListener.mockReturnValue({
        promptId: 'test-id',
        promise: Promise.resolve(saveResult),
    });
}

describe('telekineticThrustHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockResolvedValue(null);
        savePrompt.buildSaveDc.mockReturnValue(13);
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    describe('handle', () => {
        it('returns info popup when no options available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('ready');
            expect(result.payload.description).toContain('Psionic Strike');
        });

        it.each([
            [true, 'Goblin'],
            [false, null],
        ])('adds campaign log entry with %s description when target exists', async (hasTarget, targetName) => {
            if (hasTarget) {
                damageUtils.getCombatContext.mockResolvedValue({
                    attacker: { nextTargetAttacking: targetName },
                });
                damageUtils.getTargetFromAttacker.mockReturnValue({ name: targetName });
            }

            await handle(makeAction(), makePlayerStats(), 'test-campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Telekinetic Thrust',
                description: expect.stringContaining(hasTarget ? `against ${targetName}` : 'Telekinetic Thrust used'),
            }));
        });

        it.each([
            ['STR', 'STR'],
            ['DEX', 'DEX'],
        ])('uses %s saveType when specified in automation', async (autoSaveType, expectedType) => {
            setupSaveMock();
            damageUtils.getCombatContext.mockResolvedValue({
                attacker: { nextTargetAttacking: 'Goblin' },
            });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await handle(makeActionWithOptions({ saveType: autoSaveType }), makePlayerStats(), 'test-campaign', 'map');

            expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: expectedType,
                saveDc: 13,
            });
        });

        it('handles addEntry rejection gracefully in handle()', async () => {
            logService.addEntry.mockRejectedValue(new Error('log error'));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('ready');
        });
    });

    describe('applyTelekineticThrust', () => {
        it('returns null when no options available', async () => {
            const result = await applyTelekineticThrust({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    targetName: 'Goblin',
    saveDc: 13,
    saveType: 'STR',
});

            expect(result).toBeNull();
        });

        it('returns popup with no-target message when targetName is null', async () => {
            const result = await applyTelekineticThrust({
                    action: makeActionWithOptions(),
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: null,
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('creates a save listener and waits for the result', async () => {
            setupSaveMock({ success: false, total: 10, roll: 8, saveBonus: 2 });

            await applyTelekineticThrust({
                    action: makeActionWithOptions(),
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'STR',
                saveDc: 13,
            });
        });

        it('returns a popup indicating success when save passes', async () => {
            setupSaveMock({ success: true, total: 15, roll: 12, saveBonus: 3 });

            const result = await applyTelekineticThrust({
                    action: makeActionWithOptions(),
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Success');
            expect(result.payload.description).toContain('No effect applied');
        });

        it('returns a popup indicating failure and applies effect when save fails', async () => {
            setupSaveMock({ success: false, total: 10, roll: 8, saveBonus: 2 });

            const result = await applyTelekineticThrust({
                    action: makeActionWithOptions(),
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Failure');
            expect(result.payload.description).toContain('Push');
        });

        it('applies prone condition and push when save fails and target is not already prone', async () => {
            setupSaveMock({ success: false, total: 10, roll: 8, saveBonus: 2 });

            const combatContext = {
                creatures: [
                    { name: 'Goblin', conditions: [] },
                ],
            };
            damageUtils.getCombatContext.mockResolvedValue(combatContext);

            const result = await applyTelekineticThrust({
                    action: makeActionWithOptions(),
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Failure');
            expect(conditionSaveService.addCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    combatSummary: combatContext,
                    creatureName: 'Goblin',
                    conditionDef: { key: 'prone', label: 'Prone' },
                    dc: 13,
                    ability: 'STR',
                    getRuntimeValue: expect.any(Function),
                    setRuntimeValue: expect.any(Function),
                    campaignName: 'test-campaign',
                    playerStats: expect.any(Object),
                })
            );
            expect(storage.set).toHaveBeenCalledWith('combatSummary', combatContext, 'test-campaign');
            // Full-string own-copy pin: psionicStrike's near-copy logs "pushed X 10 feet
            // away" (no "knocked ... Prone and"), so this cannot silently pass on that copy.
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                description: 'TestHero knocked Goblin Prone and pushed 10 feet away.',
            }));
        });

        it('skips prone condition when target is already prone', async () => {
            setupSaveMock({ success: false, total: 10, roll: 8, saveBonus: 2 });

            const combatContext = {
                creatures: [
                    { name: 'Goblin', conditions: [{ key: 'prone' }] },
                ],
            };
            damageUtils.getCombatContext.mockResolvedValue(combatContext);

            const result = await applyTelekineticThrust({
                    action: makeActionWithOptions(),
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Failure');
            expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
        });

        it('uses option name in result message for unknown effect types', async () => {
            setupSaveMock({ success: false, total: 10, roll: 8, saveBonus: 2 });

            const combatContext = {
                creatures: [
                    { name: 'Goblin', conditions: [] },
                ],
            };
            damageUtils.getCombatContext.mockResolvedValue(combatContext);

            const actionWithUnknownEffect = {
                name: 'Telekinetic Thrust',
                automation: {
                    type: 'telekinetic_thrust',
                    saveType: 'STR',
                    options: [{ name: 'Unique Effect', effect: 'custom_effect', value: 15 }],
                },
            };

            const result = await applyTelekineticThrust({
                    action: actionWithUnknownEffect,
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Failure');
            expect(result.payload.description).toContain('Unique Effect');
        });

        it('handles missing target creature gracefully on failure', async () => {
            setupSaveMock({ success: false, total: 10, roll: 8, saveBonus: 2 });

            const combatContext = {
                creatures: [],
            };
            damageUtils.getCombatContext.mockResolvedValue(combatContext);

            const result = await applyTelekineticThrust({
                    action: makeActionWithOptions(),
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Failure');
            expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
        });

        it('handles addEntry rejection gracefully', async () => {
            setupSaveMock({ success: true, total: 15, roll: 12, saveBonus: 3 });
            logService.addEntry.mockRejectedValueOnce(new Error('log error')).mockResolvedValue(undefined);

            const result = await applyTelekineticThrust({
                    action: makeActionWithOptions(),
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Success');
        });

        it('uses default push value when option has no value property', async () => {
            setupSaveMock({ success: false, total: 10, roll: 8, saveBonus: 2 });

            const combatContext = {
                creatures: [
                    { name: 'Goblin', conditions: [] },
                ],
            };
            damageUtils.getCombatContext.mockResolvedValue(combatContext);

            const actionWithoutValue = {
                name: 'Telekinetic Thrust',
                automation: {
                    type: 'telekinetic_thrust',
                    saveType: 'STR',
                    options: [{ name: 'Push', effect: 'prone_and_push' }],
                },
            };

            await applyTelekineticThrust({
                    action: actionWithoutValue,
                    playerStats: makePlayerStats(),
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                    saveDc: 13,
                    saveType: 'STR',
                });

            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: 'TestHero knocked Goblin Prone and pushed 10 feet away.',
            }));
        });

        it('rejects when save listener promise rejects', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.reject(new Error('save failed')),
            });

            await expect(
                applyTelekineticThrust({
                        action: makeActionWithOptions(),
                        playerStats: makePlayerStats(),
                        campaignName: 'test-campaign',
                        targetName: 'Goblin',
                        saveDc: 13,
                        saveType: 'STR',
                    })
            ).rejects.toThrow('save failed');
        });
    });
});
