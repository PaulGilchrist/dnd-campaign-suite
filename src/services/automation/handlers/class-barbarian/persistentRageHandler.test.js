import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './persistentRageHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({ id: 1, timestamp: Date.now() }),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

describe('persistentRageHandler', () => {
    const campaignName = 'test-campaign';
    const playerName = 'TestBarbarian';

    function makePlayerStats(overrides = {}) {
        return {
            name: playerName,
            level: 15,
            class: {
                name: 'Barbarian',
                class_levels: [{ level: 15, rages: 4 }],
            },
            automation: { passives: [], actions: [] },
            ...overrides,
        };
    }

    function makeAction(overrides = {}) {
        return {
            name: 'Persistent Rage',
            automation: {
                type: 'passive_rule',
                effect: 'persistent_rage',
                ...overrides,
            },
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'ragePoints') return null;
            if (key === 'persistentRageUsed') return null;
            return null;
        });
    });

    describe('validation', () => {
        it('returns info popup when rage count at class level is zero', async () => {
            const stats = makePlayerStats({
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1, rages: 0 }],
                },
            });
            const action = makeAction();

            const result = await handle(action, stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No rage uses available');
            expect(getRuntimeValue).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('already at max rage', () => {
        it('returns info popup when rage points equal max', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'ragePoints') return 4;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('already at maximum');
            expect(result.payload.description).toContain('4/4');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('already used this long rest', () => {
        it('blocks and returns info popup when persistentRageUsed is true', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'ragePoints') return 1;
                if (key === 'persistentRageUsed') return true;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Already used');
            expect(result.payload.description).toContain('Long Rest');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('successful restoration', () => {
        it('restores rage points to max when below max', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'ragePoints') return 1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Rage points restored to 4/4');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                playerName,
                'ragePoints',
                4,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                playerName,
                'persistentRageUsed',
                true,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Persistent Rage',
                description: expect.stringContaining('1 -> 4'),
            }));
        });

        it('restores from partial rage with different values', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'ragePoints') return 2;
                return null;
            });
            const stats = makePlayerStats({
                level: 10,
                class: { name: 'Barbarian', class_levels: [{ level: 10, rages: 3 }] },
            });

            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, 'ragePoints', 3, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, 'persistentRageUsed', true, campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: expect.stringContaining('2 -> 3'),
            }));
        });
    });

    describe('error handling', () => {
        it('handles addEntry rejection gracefully and still returns success popup', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'ragePoints') return 1;
                return null;
            });
            addEntry.mockRejectedValue(new Error('Log service unavailable'));

            const spy = vi.spyOn(console, 'error').mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Rage points restored');
            // setRuntimeValue calls happen before addEntry, so they should still be called
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'ragePoints', 4, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'persistentRageUsed', true, campaignName);

            spy.mockRestore();
        });
    });

});
