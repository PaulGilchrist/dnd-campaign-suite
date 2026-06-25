// @improved-by-ai
import { handle, applyTelekineticThrust } from './telekineticThrustHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as savePrompt from '../../common/savePrompt.js';

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

describe('telekineticThrustHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockReturnValue(null);
        savePrompt.buildSaveDc.mockReturnValue(13);
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    describe('handle', () => {
        it('should return info popup when no options available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('ready');
        });

        it('should return modal when options are available', async () => {
            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('telekineticThrust');
            expect(result.payload.saveDc).toBe(13);
            expect(result.payload.saveType).toBe('STR');
        });

        it('should include targetName in modal payload when combat context provides a target', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                attacker: { nextTargetAttacking: 'Goblin' },
            });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.targetName).toBe('Goblin');
        });

        it('should pass null targetName when no combat context exists', async () => {
            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.targetName).toBeNull();
        });

        it('should add campaign log entry for ability use', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Telekinetic Thrust',
            }));
        });

        it('should include target name in log description when target exists', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                attacker: { nextTargetAttacking: 'Goblin' },
            });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                description: expect.stringContaining('against Goblin'),
            }));
        });

        it('should omit target from log description when no target exists', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                description: expect.stringContaining('Telekinetic Thrust used'),
            }));
        });

        it('should use custom saveType when specified in automation', async () => {
            const result = await handle(makeActionWithOptions({ saveType: 'DEX' }), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.saveType).toBe('DEX');
        });

        it('should default saveType to STR when not specified', async () => {
            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.saveType).toBe('STR');
        });

        it('should call buildSaveDc with automation and playerStats', async () => {
            await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'telekinetic_thrust' }),
                expect.objectContaining({ name: 'TestHero' })
            );
        });

        it('should pass action and playerStats in modal payload', async () => {
            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('campaign');
        });
    });

    describe('applyTelekineticThrust', () => {
        it('should return null when no options available', async () => {
            const result = await applyTelekineticThrust(makeAction(), makePlayerStats(), 'campaign', 'Goblin', 13, 'STR');

            expect(result).toBeNull();
        });

        it('should return null when options array is empty', async () => {
            const result = await applyTelekineticThrust(
                makeActionWithOptions({ options: [] }),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            expect(result).toBeNull();
        });

        it('should clear pendingRiderChoice before processing', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: true, total: 15, roll: 12, saveBonus: 3 }),
            });

            await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'pendingRiderChoice',
                null,
                'campaign'
            );
        });

        it('should return popup with no-target message when targetName is null', async () => {
            const result = await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                null,
                13,
                'STR'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should create a save listener and wait for the result', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 8, saveBonus: 2 }),
            });

            await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            expect(savePrompt.createSaveListener).toHaveBeenCalledWith('campaign', {
                targetName: 'Goblin',
                saveType: 'STR',
                saveDc: 13,
            });
        });

        it('should log a roll entry when a target is present', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 8, saveBonus: 2 }),
            });

            await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                targetName: 'Goblin',
                saveDc: 13,
                saveType: 'STR',
            }));
        });

        it('should log a second roll entry with the save result', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 8, saveBonus: 2 }),
            });

            await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            // Second call to addEntry should contain the save result
            const calls = logService.addEntry.mock.calls;
            const resultEntry = calls.find(
                (call) => call[1].saveResult === 'failure'
            );
            expect(resultEntry).toBeDefined();
            expect(resultEntry[1]).toEqual(expect.objectContaining({
                type: 'roll',
                saveResult: 'failure',
                total: 10,
                rolls: [8],
                bonus: 2,
                formula: '1d20+2',
            }));
        });

        it('should return a popup indicating success when save passes', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: true, total: 15, roll: 12, saveBonus: 3 }),
            });

            const result = await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Success');
            expect(result.payload.description).toContain('No effect applied');
        });

        it('should return a popup indicating failure and apply effect when save fails', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 8, saveBonus: 2 }),
            });

            const result = await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Failure');
            expect(result.payload.description).toContain('Push');
        });

        it('should store targetEffects when save fails', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 8, saveBonus: 2 }),
            });
            runtimeState.getRuntimeValue.mockReturnValue([]);

            await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            const calls = runtimeState.setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects'
            );
            expect(calls.length).toBeGreaterThan(0);
            expect(calls[0][2]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Telekinetic Thrust',
                        effect: 'prone_and_push',
                        value: 10,
                        duration: 'until_start_of_next_turn',
                    }),
                ])
            );
        });

        it('should apply prone condition to target when not already present', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 8, saveBonus: 2 }),
            });
            runtimeState.getRuntimeValue.mockReturnValue([]);
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', conditions: [] }],
            });

            await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            const combatContextCalls = runtimeState.setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'combatContext'
            );
            expect(combatContextCalls.length).toBeGreaterThan(0);
        });

        it('should not duplicate prone condition when target already has it', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 8, saveBonus: 2 }),
            });
            runtimeState.getRuntimeValue.mockReturnValue([]);
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', conditions: [{ key: 'prone', source: 'other' }] }],
            });

            await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            const combatContextCalls = runtimeState.setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'combatContext'
            );
            expect(combatContextCalls.length).toBe(0);
        });

        it('should handle missing combatContext gracefully on failure', async () => {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 8, saveBonus: 2 }),
            });
            runtimeState.getRuntimeValue.mockReturnValue([]);
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await applyTelekineticThrust(
                makeActionWithOptions(),
                makePlayerStats(),
                'campaign',
                'Goblin',
                13,
                'STR'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Failure');
        });
    });
});

// end of file
