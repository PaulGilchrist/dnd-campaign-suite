import { handle, processSlowRepeatSave } from './slowHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({
        promptId: 'test-prompt-1',
        promise: Promise.resolve({ success: false }),
    })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

describe('slowHandler', () => {
    const playerStats = {
        name: 'TestWizard',
        proficiency: 4,
        spellAbilities: { saveDc: 15 },
        abilities: [
            { name: 'Intelligence', bonus: 4 },
            { name: 'Wisdom', bonus: 2 },
        ],
    };

    const defaultCombatContext = {
        creatures: [
            { name: 'Goblin', type: 'npc' },
            { name: 'Orc', type: 'npc' },
        ],
    };

    function setupMocks(runtimeGetReturnValue = []) {
        vi.mocked(getCombatContext).mockResolvedValue(defaultCombatContext);
        vi.mocked(getRuntimeValue).mockImplementation((key) => {
            if (key === 'activeConditions') return runtimeGetReturnValue;
            if (key === 'targetEffects') return [];
            if (key.startsWith('_slow_')) return null;
            return null;
        });
    }

    describe('handle', () => {
        it('should return popup when no creatures in combat', async () => {
            vi.mocked(getCombatContext).mockResolvedValue({ creatures: [] });

            const result = await handle(
                { name: 'Slow', automation: { type: 'slow', saveType: 'WIS', saveDc: 15 } },
                playerStats,
                'TestCampaign',
                'TestMap'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No creatures in combat');
        });

        it('should prompt for WIS save on each target', async () => {
            setupMocks();
            const result = await handle(
                { name: 'Slow', automation: { type: 'slow', saveType: 'WIS', saveDc: 15 } },
                playerStats,
                'TestCampaign',
                'TestMap'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Slow');
            expect(result.payload.description).toContain('Slow affects');
        });

        it('should apply slow condition on failed save', async () => {
            setupMocks([]);
            await handle(
                { name: 'Slow', automation: { type: 'slow', saveType: 'WIS', saveDc: 15 } },
                playerStats,
                'TestCampaign',
                'TestMap'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['slow']),
                'TestCampaign'
            );
        });

        it('should set tracking for repeat save', async () => {
            setupMocks();
            await handle(
                { name: 'Slow', automation: { type: 'slow', saveType: 'WIS', saveDc: 15 } },
                playerStats,
                'TestCampaign',
                'TestMap'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_slow_Goblin',
                true,
                'TestCampaign'
            );
        });

        it('should add expiration for concentration', async () => {
            setupMocks();
            await handle(
                { name: 'Slow', automation: { type: 'slow', saveType: 'WIS', saveDc: 15 } },
                playerStats,
                'TestCampaign',
                'TestMap'
            );

            expect(addExpiration).toHaveBeenCalledWith(
                'TestWizard',
                'Goblin',
                expect.arrayContaining([
                    expect.objectContaining({ type: 'condition', condition: 'slow' }),
                ]),
                'TestCampaign',
                10
            );
        });

        it('should store target effects for slow debuffs', async () => {
            setupMocks();
            await handle(
                { name: 'Slow', automation: { type: 'slow', saveType: 'WIS', saveDc: 15 } },
                playerStats,
                'TestCampaign',
                'TestMap'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCampaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ effect: 'speed_halved' }),
                    expect.objectContaining({ effect: 'no_reactions' }),
                    expect.objectContaining({ effect: 'ac_penalty', value: -2 }),
                    expect.objectContaining({ effect: 'dex_save_disadvantage' }),
                    expect.objectContaining({ effect: 'action_limit' }),
                    expect.objectContaining({ effect: 'single_attack_limit' }),
                    expect.objectContaining({ effect: 'somatic_failure_chance', chance: 25 }),
                    expect.objectContaining({ effect: 'slow_repeat_save' }),
                ]),
                'TestCampaign'
            );
        });

        it('should log entries for save result', async () => {
            setupMocks();
            await handle(
                { name: 'Slow', automation: { type: 'slow', saveType: 'WIS', saveDc: 15 } },
                playerStats,
                'TestCampaign',
                'TestMap'
            );

            expect(addEntry).toHaveBeenCalledWith(
                'TestCampaign',
                expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-slow',
                    targetName: 'Goblin',
                    saveType: 'WIS',
                    success: false,
                })
            );
        });

        it('should post log entry for condition applied', async () => {
            setupMocks();
            await handle(
                { name: 'Slow', automation: { type: 'slow', saveType: 'WIS', saveDc: 15 } },
                playerStats,
                'TestCampaign',
                'TestMap'
            );

            expect(postLogEntry).toHaveBeenCalledWith(
                'TestCampaign',
                expect.objectContaining({
                    type: 'condition',
                    action: 'applied',
                    characterName: 'Goblin',
                    condition: 'Slow',
                    reason: 'Slow spell',
                })
            );
        });
    });

    describe('processSlowRepeatSave', () => {
        it('should return null when no tracking exists', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((_characterKey, propertyName) => {
                if (propertyName === '_slow_Goblin') return null;
                return null;
            });

            const result = await processSlowRepeatSave(
                'TestWizard',
                'Goblin',
                15,
                'TestCampaign'
            );

            expect(result).toBeNull();
        });

        it('should remove slow condition on successful repeat save', async () => {
            vi.mocked(createSaveListener).mockReturnValue({
                promptId: 'test-prompt-2',
                promise: Promise.resolve({ success: true }),
            });
            vi.mocked(getRuntimeValue).mockImplementation((_characterKey, propertyName) => {
                if (propertyName === '_slow_Goblin') return true;
                if (propertyName === 'activeConditions') return ['slow'];
                if (propertyName === 'targetEffects') return [];
                return null;
            });

            const result = await processSlowRepeatSave(
                'TestWizard',
                'Goblin',
                15,
                'TestCampaign'
            );

            expect(result).not.toBeNull();
            expect(result.payload.description).toContain('succeeded on WIS save');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.not.arrayContaining(['slow']),
                'TestCampaign'
            );
        });

        it('should continue tracking on failed repeat save', async () => {
            vi.mocked(createSaveListener).mockReturnValue({
                promptId: 'test-prompt-3',
                promise: Promise.resolve({ success: false }),
            });
            vi.mocked(getRuntimeValue).mockImplementation((_characterKey, propertyName) => {
                if (propertyName === '_slow_Goblin') return true;
                if (propertyName === 'activeConditions') return ['slow'];
                if (propertyName === 'targetEffects') return [];
                return null;
            });

            const result = await processSlowRepeatSave(
                'TestWizard',
                'Goblin',
                15,
                'TestCampaign'
            );

            expect(result).not.toBeNull();
            expect(result.payload.description).toContain('failed WIS save');
            expect(result.payload.description).toContain('Slow continues');
        });
    });
});
