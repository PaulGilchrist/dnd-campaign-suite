import { handle } from './stinkingCloudHandler.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({
        promptId: 'test-prompt',
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

describe('Stinking Cloud handler', () => {
    const mockPlayerStats = {
        name: 'Caster',
        proficiency: 4,
        spellAbilities: { saveDc: 15 },
        immunities: [],
        allFeatures: [],
        automation: { passives: [] },
    };

    it('should return info popup when no creatures in combat', async () => {
        const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(
            {
                name: 'Stinking Cloud',
                automation: { type: 'stinking_cloud', saveDc: 15, saveType: 'CON' },
                spell: { name: 'Stinking Cloud', level: 3 },
                spellSlotLevel: 3,
            },
            mockPlayerStats,
            'TestCampaign',
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Stinking Cloud',
                description: 'No creatures in combat. Stinking Cloud has no effect.',
            },
        });
    });

    it('should apply poisoned condition on failed save', async () => {
        const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Target1', immunities: [] },
            ],
        });

        const result = await handle(
            {
                name: 'Stinking Cloud',
                automation: { type: 'stinking_cloud', saveDc: 15, saveType: 'CON' },
                spell: { name: 'Stinking Cloud', level: 3 },
                spellSlotLevel: 3,
            },
            mockPlayerStats,
            'TestCampaign',
        );

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Stinking Cloud');
    });

    it('should handle multiple targets with poison immunity', async () => {
        const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Target1', immunities: [] },
                { name: 'Target2', immunities: ['poison'] },
            ],
        });

        const result = await handle(
            {
                name: 'Stinking Cloud',
                automation: { type: 'stinking_cloud', saveDc: 15, saveType: 'CON' },
                spell: { name: 'Stinking Cloud', level: 3 },
                spellSlotLevel: 3,
            },
            mockPlayerStats,
            'TestCampaign',
        );

        expect(result).toBeDefined();
        expect(result.payload.type).toBe('automation_info');
    });
});
