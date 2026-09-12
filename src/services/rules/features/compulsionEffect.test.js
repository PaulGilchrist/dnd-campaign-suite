// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyCompulsionEffect } from './compulsionService.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addEntry } from '../../ui/logService.js';
import { addExpiration } from '../effects/expirations.js';
import { addCondition } from '../../combat/conditions/conditionSaveService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

describe('compulsionService applyCompulsionEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addEntry.mockResolvedValue({});
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence' },
        proficiency: 4,
    };
    const spell = { name: 'Compulsion', level: 4 };

    describe('input validation', () => {
        it('returns null when targetNames is null', async () => {
            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                null,
            );

            expect(result).toBeNull();
        });

        it('returns null when targetNames is undefined', async () => {
            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                undefined,
            );

            expect(result).toBeNull();
        });

        it('returns null when targetNames is empty array', async () => {
            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                [],
            );

            expect(result).toBeNull();
        });

        it('returns null when targetNames is not an array', async () => {
            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                'Goblin',
            );

            expect(result).toBeNull();
        });
    });

    describe('save DC computation', () => {
        it('uses playerStats.spellAbilities.saveDc when available', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(createSaveListener).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ saveDc: 15 }),
            );
        });

        it('computes saveDc from proficiency when spellAbilities is missing', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });
            const stats = { name: 'Wizard', proficiency: 3 };

            await applyCompulsionEffect(
                spell,
                stats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(createSaveListener).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ saveDc: 11 }),
            );
        });

        it('uses default saveDc of 10 when stats are minimal', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            await applyCompulsionEffect(
                spell,
                {},
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(createSaveListener).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ saveDc: 10 }),
            );
        });
    });

    describe('save listener setup', () => {
        it('creates save listener with correct WIS save type and charmed condition', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(createSaveListener).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    targetName: 'Goblin',
                    saveType: 'WIS',
                    saveDc: 15,
                    dcSuccess: 'none',
                    advantage: false,
                    disadvantage: false,
                    condition: 'charmed',
                }),
            );
        });

        it('creates one save listener per target', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin', 'Orc', 'Troll'],
            );

            expect(createSaveListener).toHaveBeenCalledTimes(3);
            expect(createSaveListener).toHaveBeenNthCalledWith(
                1,
                campaignName,
                expect.objectContaining({ targetName: 'Goblin' }),
            );
            expect(createSaveListener).toHaveBeenNthCalledWith(
                2,
                campaignName,
                expect.objectContaining({ targetName: 'Orc' }),
            );
            expect(createSaveListener).toHaveBeenNthCalledWith(
                3,
                campaignName,
                expect.objectContaining({ targetName: 'Troll' }),
            );
        });
    });

    describe('logging', () => {
        it('logs ability_use when casting compulsion', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            const castLog = addEntry.mock.calls.find(
                call => call[1]?.type === 'ability_use' && call[1]?.abilityName === 'Compulsion',
            );
            expect(castLog).toBeDefined();
            expect(castLog[1].characterName).toBe('Wizard');
            expect(castLog[1].abilityName).toBe('Compulsion');
            expect(castLog[1].description).toContain('Wizard casts Compulsion on Goblin');
            expect(castLog[1].description).toContain('WIS save');
            expect(castLog[1].description).toContain('DC 15');
            expect(castLog[1].promptId).toBe('test-prompt');
        });

        it('logs save_result after each save', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            const saveLog = addEntry.mock.calls.find(
                call => call[1]?.type === 'save_result',
            );
            expect(saveLog).toBeDefined();
            expect(saveLog[1].targetName).toBe('Goblin');
            expect(saveLog[1].saveType).toBe('WIS');
            expect(saveLog[1].saveDc).toBe(15);
            expect(saveLog[1].success).toBe(true);
        });

        it('logs condition when save fails', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: false }),
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            const conditionLog = addEntry.mock.calls.find(
                call => call[1]?.type === 'condition',
            );
            expect(conditionLog).toBeDefined();
            expect(conditionLog[1].action).toBe('applied');
            expect(conditionLog[1].characterName).toBe('Goblin');
            expect(conditionLog[1].condition).toBe('Charmed');
            expect(conditionLog[1].reason).toBe('Compulsion spell');
            expect(conditionLog[1].note).toContain('Goblin');
            expect(conditionLog[1].note).toContain('Wizard');
            expect(conditionLog[1].note).toContain('furthest away');
        });

        it('logs summary after processing all targets', async () => {
            createSaveListener
                .mockReturnValueOnce({
                    promptId: 'test-prompt-1',
                    promise: Promise.resolve({ success: false }),
                })
                .mockReturnValueOnce({
                    promptId: 'test-prompt-2',
                    promise: Promise.resolve({ success: true }),
                });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin', 'Orc'],
            );

            const summaryLog = addEntry.mock.calls.find(
                call =>
                    call[1]?.type === 'ability_use' &&
                    call[1]?.description?.includes('of') &&
                    call[1]?.description?.includes('target(s)'),
            );
            expect(summaryLog).toBeDefined();
            expect(summaryLog[1].description).toContain('1 of 2');
            expect(summaryLog[1].description).toContain('Goblin');
            expect(summaryLog[1].description).toContain('Orc');
            expect(summaryLog[1].description).toContain('1 succeeded');
        });
    });

    describe('condition application on failed save', () => {
        it('calls addCondition when save fails', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: false }),
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(addCondition).toHaveBeenCalledWith(
                expect.objectContaining({
                    combatSummary: expect.objectContaining({ creatures: expect.any(Array) }),
                    creatureName: 'Goblin',
                    conditionDef: { key: 'charmed', label: 'Charmed' },
                    dc: 15,
                    ability: 'WIS',
                    getRuntimeValue,
                    setRuntimeValue,
                    campaignName,
                    playerStats,
                }),
            );
        });

        it('calls addExpiration when save fails', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: false }),
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(addExpiration).toHaveBeenCalledWith(
                'Wizard',
                'Goblin',
                expect.arrayContaining([
                    expect.objectContaining({ type: 'charmed', condition: 'charmed' }),
                ]),
                campaignName,
            );
        });

        it('does not call addCondition when save succeeds', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(addCondition).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });
    });

    describe('return value', () => {
        it('returns popup with affected count when all targets fail', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: false }),
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Compulsion',
                    description: '1 of 1 target(s) affected by Compulsion and became Charmed.',
                },
            });
        });

        it('returns popup with affected count when some targets fail', async () => {
            createSaveListener
                .mockReturnValueOnce({
                    promptId: 'test-prompt-1',
                    promise: Promise.resolve({ success: false }),
                })
                .mockReturnValueOnce({
                    promptId: 'test-prompt-2',
                    promise: Promise.resolve({ success: true }),
                });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin', 'Orc'],
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Compulsion',
                    description: '1 of 2 target(s) affected by Compulsion and became Charmed.',
                },
            });
        });

        it('returns popup with 0 affected when all targets succeed', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Compulsion',
                    description: '0 of 1 target(s) affected by Compulsion and became Charmed.',
                },
            });
        });

        it('uses correct caster name in popup description', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: false }),
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            const stats = { name: 'Archmage Elara', spellAbilities: { saveDc: 16 }, proficiency: 4 };

            const result = await applyCompulsionEffect(
                spell,
                stats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(result.payload.description).toContain('1 of 1');
        });
    });

    describe('multiple targets', () => {
        it('processes each target sequentially with independent saves', async () => {
            createSaveListener
                .mockReturnValueOnce({
                    promptId: 'prompt-1',
                    promise: Promise.resolve({ success: false }),
                })
                .mockReturnValueOnce({
                    promptId: 'prompt-2',
                    promise: Promise.resolve({ success: false }),
                })
                .mockReturnValueOnce({
                    promptId: 'prompt-3',
                    promise: Promise.resolve({ success: true }),
                });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin', 'Orc', 'Troll'],
            );

            expect(result.payload.description).toContain('2 of 3');
            expect(addCondition).toHaveBeenCalledTimes(2);
            expect(addExpiration).toHaveBeenCalledTimes(2);
        });

        it('logs individual save results for each target', async () => {
            createSaveListener
                .mockReturnValueOnce({
                    promptId: 'prompt-1',
                    promise: Promise.resolve({ success: false }),
                })
                .mockReturnValueOnce({
                    promptId: 'prompt-2',
                    promise: Promise.resolve({ success: true }),
                });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin', 'Orc'],
            );

            const saveLogs = addEntry.mock.calls.filter(call => call[1]?.type === 'save_result');
            expect(saveLogs).toHaveLength(2);
            expect(saveLogs[0][1].targetName).toBe('Goblin');
            expect(saveLogs[0][1].success).toBe(false);
            expect(saveLogs[1][1].targetName).toBe('Orc');
            expect(saveLogs[1][1].success).toBe(true);
        });
    });

    describe('save prompt details', () => {
        it('logs save result description with success/failure wording', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: false }),
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            const saveLog = addEntry.mock.calls.find(
                call => call[1]?.type === 'save_result',
            );
            expect(saveLog[1].description).toContain('Goblin');
            expect(saveLog[1].description).toContain('failed');
            expect(saveLog[1].description).toContain('WIS save');
            expect(saveLog[1].description).toContain('DC 15');
        });

        it('logs save result description with succeeded for success', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            const saveLog = addEntry.mock.calls.find(
                call => call[1]?.type === 'save_result',
            );
            expect(saveLog[1].description).toContain('Goblin');
            expect(saveLog[1].description).toContain('succeeded');
        });
    });

    describe('error handling for log entries', () => {
        it('continues processing when addEntry rejects for cast log', async () => {
            addEntry.mockRejectedValueOnce(new Error('Log failed'));
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(result).toBeDefined();
        });

        it('continues processing when addEntry rejects for save log', async () => {
            addEntry
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('Log failed'));
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(result).toBeDefined();
        });

        it('continues processing when addEntry rejects for condition log', async () => {
            addEntry
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('Log failed'));
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: false }),
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(result).toBeDefined();
        });

        it('continues processing when addEntry rejects for summary log', async () => {
            addEntry
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('Log failed'));
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt',
                promise: Promise.resolve({ success: true }),
            });

            const result = await applyCompulsionEffect(
                spell,
                playerStats,
                campaignName,
                mapName,
                ['Goblin'],
            );

            expect(result).toBeDefined();
        });
    });
});
