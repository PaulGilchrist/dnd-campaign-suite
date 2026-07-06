import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './largeFormHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';
const playerName = 'Test Character';

function makeAction(overrides = {}) {
    return {
        name: 'Large Form',
        automation: {
            type: 'large_form',
            duration: '10_minutes',
            casting_time: '1_bonus_action',
            resourceCost: 'long_rest',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 5,
        class: { name: 'Giant' },
        ...overrides,
    };
}

describe('largeFormHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns info popup when character level is below 5', async () => {
            const stats = makePlayerStats({ level: 3 });
            const result = await handle(makeAction(), stats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Large Form requires character level 5.');
            expect(result.payload.automationType).toBe('large_form');
        });

        it('ends large form when already active and removes buff', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'largeFormActive') return true;
                if (key === 'activeBuffs') return [{ name: 'Large Form', effect: 'large_form' }];
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Large Form ended.');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'largeFormActive', false, campaignName
            );
        });

        it('removes large form buff while preserving other buffs', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'largeFormActive') return true;
                if (key === 'activeBuffs') return [
                    { name: 'Large Form', effect: 'large_form' },
                    { name: 'Other Buff', effect: 'other' },
                ];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            const buffsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffsCalls).toHaveLength(1);
            const newBuffs = buffsCalls[0][2];
            expect(newBuffs).toHaveLength(1);
            expect(newBuffs[0].name).toBe('Other Buff');
        });

        it('blocks activation when long rest mark is set', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'largeFormActive') return false;
                if (key === 'largeFormActive_restUsed') return true;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Large Form has been used and cannot be used again until a Long Rest.',
            );
        });

        it('adds buff and preserves other buffs on activation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'largeFormActive') return false;
                if (key === 'activeBuffs') return [
                    { name: 'Other Buff', effect: 'other' },
                ];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            const buffsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffsCalls).toHaveLength(1);
            const newBuffs = buffsCalls[0][2];
            expect(newBuffs).toHaveLength(2);
            expect(newBuffs.map(b => b.name)).toEqual(['Other Buff', 'Large Form']);
        });

        it('does not duplicate buff when it already exists', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'largeFormActive') return false;
                if (key === 'activeBuffs') return [
                    { name: 'Large Form', effect: 'large_form' },
                ];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            const buffsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffsCalls).toHaveLength(1);
            const newBuffs = buffsCalls[0][2];
            expect(newBuffs).toHaveLength(1);
            expect(newBuffs[0].name).toBe('Large Form');
        });

        it('returns popup with full payload structure on activation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'largeFormActive') return false;
                if (key === 'activeBuffs') return [];
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload).toMatchObject({
                type: 'automation_info',
                name: 'Large Form',
                automationType: 'large_form',
                description: expect.stringContaining('activated'),
            });
            expect(result.payload.automation).toEqual(makeAction().automation);
        });
    });
});
