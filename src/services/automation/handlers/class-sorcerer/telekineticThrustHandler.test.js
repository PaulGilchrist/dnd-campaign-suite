// @cleaned-by-ai
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

vi.mock('../../../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../../../../services/combat/conditions/conditionSaveService.js', () => ({
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

describe('telekineticThrustHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockReturnValue(null);
        savePrompt.buildSaveDc.mockReturnValue(13);
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    describe('handle', () => {
        function setupSaveMock() {
            savePrompt.createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: true, total: 15, roll: 12, saveBonus: 3 }),
            });
        }

        beforeEach(() => {
            runtimeState.getRuntimeValue.mockReturnValue([]);
        });

        it('should return info popup when no options available', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('ready');
        });

        it('should return no-target popup when options exist but no target', async () => {
            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should create save listener when options exist and target is present', async () => {
            setupSaveMock();
            damageUtils.getCombatContext.mockReturnValue({
                attacker: { nextTargetAttacking: 'Goblin' },
            });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(savePrompt.createSaveListener).toHaveBeenCalledWith('campaign', {
                targetName: 'Goblin',
                saveType: 'STR',
                saveDc: 13,
            });
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
            setupSaveMock();
            damageUtils.getCombatContext.mockReturnValue({
                attacker: { nextTargetAttacking: 'Goblin' },
            });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await handle(makeActionWithOptions({ saveType: 'DEX' }), makePlayerStats(), 'campaign', 'map');

            expect(savePrompt.createSaveListener).toHaveBeenCalledWith('campaign', {
                targetName: 'Goblin',
                saveType: 'DEX',
                saveDc: 13,
            });
        });

        it('should return a popup with save result when target exists and save resolves', async () => {
            setupSaveMock();
            damageUtils.getCombatContext.mockReturnValue({
                attacker: { nextTargetAttacking: 'Goblin' },
            });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Success');
        });
    });

    describe('applyTelekineticThrust', () => {
        it('should return null when no options available', async () => {
            const result = await applyTelekineticThrust(makeAction(), makePlayerStats(), 'campaign', 'Goblin', 13, 'STR');

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
