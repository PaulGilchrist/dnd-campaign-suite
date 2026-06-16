import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isLastStandAvailable, getLastStandUsed } from './boonOfRecoveryHandler.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

describe('boonOfRecoveryHandler', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'TestMap';
    const playerName = 'TestCharacter';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return a popup when Last Stand has not been used', async () => {
        const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
        getRuntimeValue.mockReturnValue(undefined);

        const action = {
            name: 'Boon Of Recovery',
            automation: {
                type: 'survive_and_heal',
                trigger: 'reduced_to_0_hp',
                effect: 'survive_and_heal',
                minHp: 1,
                healExpression: 'half_max_hp',
                recharge: 'long_rest',
            },
        };
        const playerStats = {
            name: playerName,
            hitPoints: { max: 40 },
        };

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Last Stand');
        expect(result.payload.description).toContain('20');
    });

    it('should return a popup when Last Stand has been used this long rest', async () => {
        const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
        getRuntimeValue.mockImplementation((_charName, runtimeKey) => {
            if (runtimeKey === 'boonOfRecoveryLastStandUsed') return true;
            if (runtimeKey === 'boonOfRecoveryLastStandRestTimestamp') return Date.now() - 3600000;
            return undefined;
        });

        const action = {
            name: 'Boon Of Recovery',
            automation: {
                type: 'survive_and_heal',
                trigger: 'reduced_to_0_hp',
                effect: 'survive_and_heal',
                minHp: 1,
                healExpression: 'half_max_hp',
                recharge: 'long_rest',
            },
        };
        const playerStats = {
            name: playerName,
            hitPoints: { max: 40 },
        };

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already been used');
    });

    it('should calculate heal amount as half max HP', async () => {
        const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
        getRuntimeValue.mockReturnValue(undefined);

        const action = {
            name: 'Boon Of Recovery',
            automation: { type: 'survive_and_heal', healExpression: 'half_max_hp' },
        };
        const playerStats = {
            name: playerName,
            hitPoints: { max: 50 },
        };

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.description).toContain('25');
    });

    it('should calculate heal amount as half max HP for odd values', async () => {
        const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
        getRuntimeValue.mockReturnValue(undefined);

        const action = {
            name: 'Boon Of Recovery',
            automation: { type: 'survive_and_heal', healExpression: 'half_max_hp' },
        };
        const playerStats = {
            name: playerName,
            hitPoints: { max: 47 },
        };

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.description).toContain('23');
    });

    it('should report Last Stand as available when never used', async () => {
        const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
        getRuntimeValue.mockReturnValue(undefined);

        const playerStats = { name: playerName };
        expect(isLastStandAvailable(playerStats, campaignName)).toBe(true);
    });

    it('should report Last Stand as available after long rest', async () => {
        const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
        getRuntimeValue.mockImplementation((_charName, runtimeKey) => {
            if (runtimeKey === 'boonOfRecoveryLastStandUsed') return true;
            if (runtimeKey === 'boonOfRecoveryLastStandRestTimestamp') return Date.now() - 90000000;
            return undefined;
        });

        const playerStats = { name: playerName };
        expect(isLastStandAvailable(playerStats, campaignName)).toBe(true);
    });

    it('should report Last Stand as unavailable within long rest', async () => {
        const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
        getRuntimeValue.mockImplementation((_charName, runtimeKey) => {
            if (runtimeKey === 'boonOfRecoveryLastStandUsed') return true;
            if (runtimeKey === 'boonOfRecoveryLastStandRestTimestamp') return Date.now() - 1000;
            return undefined;
        });

        const playerStats = { name: playerName };
        expect(isLastStandAvailable(playerStats, campaignName)).toBe(false);
    });

    it('should return getLastStandUsed value', async () => {
        const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
        getRuntimeValue.mockReturnValue(true);

        const playerStats = { name: playerName };
        expect(getLastStandUsed(playerStats, campaignName)).toBe(true);
    });
});
