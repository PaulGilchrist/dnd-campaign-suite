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
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('campaign');
            expect(result.payload.saveDc).toBe(13);
            expect(result.payload.saveType).toBe('STR');
        });

        it('should add campaign log entry', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Telekinetic Thrust',
            }));
        });

        it('should include target name in log when available', async () => {
            damageUtils.getCombatContext.mockReturnValue({
                attacker: { nextTargetAttacking: 'Goblin' },
            });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                description: expect.stringContaining('against Goblin'),
            }));
        });

        it('should use custom saveType when specified', async () => {
            const result = await handle(makeActionWithOptions({ saveType: 'DEX' }), { name: 'TestHero' }, 'campaign', 'map');

            expect(result.payload.saveType).toBe('DEX');
        });

        it('should default saveType to STR', async () => {
            const result = await handle(makeActionWithOptions(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.saveType).toBe('STR');
        });
    });

    describe('applyTelekineticThrust', () => {
        it('should return null when no options available', async () => {
            const result = await applyTelekineticThrust(makeAction(), makePlayerStats(), 'campaign', 'Goblin', 13, 'STR');

            expect(result).toBeNull();
        });

        it('should return popup when no target', async () => {
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

        it('should return popup with success message when save succeeds', async () => {
            savePrompt.createSaveListener.mockReturnValue({
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

        it('should apply effect when save fails', async () => {
            savePrompt.createSaveListener.mockReturnValue({
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

        it('should clear pendingRiderChoice', async () => {
            savePrompt.createSaveListener.mockReturnValue({
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

        it('should add roll entry for save', async () => {
            savePrompt.createSaveListener.mockReturnValue({
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
    });
});

// end of file
