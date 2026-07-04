// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);

import { handle } from './useMagicDeviceHandler.js';

function makeAction(overrides = {}) {
    return {
        name: 'Use Magic Device',
        automation: {
            type: 'use_magic_device',
            attunementLimit: 4,
            chargeReroll: '1d6',
            chargeRerollSuccess: 6,
            scrollAbility: 'INT',
            scrollCheckDC: '10 + spell_level',
            scrollDisintegratesOnFail: true,
            casting_time: 'passive',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        level: 13,
        ...overrides,
    };
}

describe('useMagicDeviceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('activates the feature and returns info popup when not already active', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'activeBuffs' ? [] : undefined
            );

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Use Magic Device');
            expect(result.payload.automationType).toBe('use_magic_device');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('4 magic items');
            expect(result.payload.description).toContain('roll 1d6');
            expect(result.payload.description).toContain('6 use without expending');
            expect(result.payload.description).toContain('Intelligence');
            expect(result.payload.description).toContain('Arcana check DC 10 + spell level');
            expect(result.payload.description).toContain('scroll disintegrates');

            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Use Magic Device',
                        effect: 'use_magic_device',
                        duration: '1_minute',
                        hasAutomation: true,
                    }),
                ]),
                'test-campaign'
            );
        });

        it('deactivates the feature and returns info popup when already active', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'activeBuffs'
                    ? [{ name: 'Use Magic Device', effect: 'use_magic_device' }]
                    : undefined
            );

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Use Magic Device');
            expect(result.payload.automationType).toBe('use_magic_device');
            expect(result.payload.description).toContain('ended');

            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                [],
                'test-campaign'
            );
        });

        it('preserves other buffs when activating', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'activeBuffs'
                    ? [{ name: 'Other Buff', effect: 'other' }]
                    : undefined
            );

            await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Other Buff' }),
                    expect.objectContaining({ name: 'Use Magic Device' }),
                ]),
                'test-campaign'
            );
        });

        it('preserves other buffs when deactivating', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'activeBuffs'
                    ? [
                          { name: 'Other Buff', effect: 'other' },
                          { name: 'Use Magic Device', effect: 'use_magic_device' },
                      ]
                    : undefined
            );

            await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                [expect.objectContaining({ name: 'Other Buff' })],
                'test-campaign'
            );
        });

        it('uses custom attunementLimit and chargeRerollSuccess from automation config', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'activeBuffs' ? [] : undefined
            );

            const action = makeAction({
                automation: { attunementLimit: 6, chargeRerollSuccess: 5 },
            });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('6 magic items');
            expect(result.payload.description).toContain('5 use without expending');
        });

        it('uses custom duration from automation config', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'activeBuffs' ? [] : undefined
            );

            const action = makeAction({ automation: { duration: '10_minutes' } });
            await handle(action, makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '10_minutes' }),
                ]),
                'test-campaign'
            );
        });

        it('uses playerStats name and campaignName for runtime state keys', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'activeBuffs' ? [] : undefined
            );

            await handle(
                makeAction(),
                makePlayerStats({ name: 'CustomPlayer' }),
                'custom-campaign'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'CustomPlayer',
                'activeBuffs',
                expect.any(Array),
                'custom-campaign'
            );
        });
    });
});
