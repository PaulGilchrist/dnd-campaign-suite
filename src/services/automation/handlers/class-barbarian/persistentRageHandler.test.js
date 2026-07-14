import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './persistentRageHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({ id: 1, timestamp: Date.now() }),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

describe('persistentRageHandler', () => {
    const campaignName = 'test-campaign';
    const playerStats = {
        name: 'TestBarbarian',
        level: 15,
        class: {
            name: 'Barbarian',
            class_levels: [{ level: 15, rages: 4 }],
        },
        automation: {
            passives: [],
            actions: [],
        },
    };
    const action = {
        name: 'Persistent Rage',
        automation: {
            type: 'passive_rule',
            effect: 'persistent_rage',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('restores rage points to max when below max', async () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'ragePoints') return 1;
            return null;
        });

        const result = await handle(action, playerStats, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'ragePoints',
            4,
            campaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'persistentRageUsed',
            true,
            campaignName
        );
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestBarbarian',
            abilityName: 'Persistent Rage',
        }));
    });

    it('returns popup when rage points already at max', async () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'ragePoints') return 4;
            return null;
        });

        const result = await handle(action, playerStats, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian',
            'ragePoints',
            expect.any(Number),
            campaignName
        );
    });

    it('returns popup when no rage uses at this level', async () => {
        const stats = {
            ...playerStats,
            class: {
                ...playerStats.class,
                class_levels: [{ level: 2, rages: 2 }],
            },
        };

        const result = await handle(action, stats, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No rage uses available');
    });

    it('blocks use when already used this long rest', async () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'ragePoints') return 1;
            if (key === 'persistentRageUsed') return true;
            return null;
        });

        const result = await handle(action, playerStats, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Already used');
        expect(result.payload.description).toContain('Long Rest');
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian',
            'ragePoints',
            expect.any(Number),
            campaignName
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian',
            'persistentRageUsed',
            expect.any(Boolean),
            campaignName
        );
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('logs to campaign log with details', async () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'ragePoints') return 2;
            return null;
        });

        await handle(action, playerStats, campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestBarbarian',
            abilityName: 'Persistent Rage',
            description: expect.stringContaining('2 -> 4'),
        }));
    });
});
