import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isRayOfEnfeeblementActive } from './rayOfEnfeeblementHandler.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((auto, playerStats) => {
        if (auto.saveDc === 'ability') {
            const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
            const bonus = cha?.bonus || 0;
            const prof = playerStats.proficiency || 0;
            return 8 + bonus + prof;
        }
        return auto.saveDc || 10;
    }),
    createSaveListener: vi.fn((campaignName, config) => {
        const promptId = `test-prompt-${Math.random()}`;
        return { promptId, promise: Promise.resolve({ success: false, ...config }) };
    }),
}));

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

describe('rayOfEnfeeblementHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should trigger CON save and apply debuff on failed save', async () => {
        const playerStats = {
            name: 'Test Wizard',
            proficiency: 2,
            abilities: [{ name: 'Intelligence', bonus: 4 }],
        };
        const action = {
            name: 'Ray of Enfeeblement',
            automation: { targetName: 'Goblin' },
        };

        const result = await handle(action, playerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('failed the CON save');
        expect(result.payload.description).toContain('Disadvantage on Strength-based d20 tests');
        expect(result.payload.description).toContain('subtracts 1d8 from all damage rolls');
    });

    it('should apply next attack disadvantage on successful save', async () => {
        const { createSaveListener } = await import('../../common/savePrompt.js');
        createSaveListener.mockImplementation((campaignName, config) => {
            return {
                promptId: `test-prompt-${Math.random()}`,
                promise: Promise.resolve({ success: true, ...config }),
            };
        });

        const playerStats = {
            name: 'Test Wizard',
            proficiency: 2,
            abilities: [{ name: 'Intelligence', bonus: 4 }],
        };
        const action = {
            name: 'Ray of Enfeeblement',
            automation: { targetName: 'Goblin' },
        };

        const result = await handle(action, playerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('succeeded on the CON save');
        expect(result.payload.description).toContain('Disadvantage on the next attack roll');
    });

    it('should detect active Ray of Enfeeblement debuff', async () => {
        const { getRuntimeValue } = await import('../../../../hooks/useRuntimeState.js');
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'ray_of_enfeeble_debuff', source: 'Test Wizard' },
        ]);

        const result = isRayOfEnfeeblementActive('Goblin', 'Test Wizard', 'test-campaign');
        expect(result).toBe(true);
    });

    it('should return false when debuff is not active', async () => {
        const { getRuntimeValue } = await import('../../../../hooks/useRuntimeState.js');
        getRuntimeValue.mockReturnValue([]);

        const result = isRayOfEnfeeblementActive('Goblin', 'Test Wizard', 'test-campaign');
        expect(result).toBe(false);
    });
});
